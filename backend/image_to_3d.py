"""
NOVA STORE — Image → 3D service layer (backend only, no API keys in frontend)
=============================================================================

Pipeline (local provider, zero extra dependencies beyond Pillow/numpy):

    product image ─► depth estimation ─► displaced relief mesh ─► .GLB
                                   └──► depth map (.PNG)  [for debugging / future use]

Pluggable providers
-------------------
Add a real AI provider (Tripo / Meshy / Rodin / …) WITHOUT touching the frontend:

    1. subclass ``ImageTo3DProvider``
    2. implement ``convert(image_path, out_dir, key, quality)``
    3. register it in ``_REGISTRY`` and select it with the env var
           IMAGE_TO_3D_PROVIDER=local|tripo|meshy|rodin
       and e.g. TRIPO_API_KEY=... (read ONLY here, never sent to the browser)

The endpoint layer (app.py) only ever returns a URL — it does not care which
provider produced the asset, so swapping providers is a backend-only change.

Quality gate — images that don't convert stay 2D
------------------------------------------------
For product photos that are flat, featureless, or whose subject sits where
the radial depth prior cannot align with it, a naive depth estimate produces
a useless mesh.  Instead of forcing a bad 3D model, ``ensure_assets`` now
gates on ``metrics['quality']`` (0..1):

    quality >= MIN_3D_QUALITY  →  build/serve the GLB as before
    quality <  MIN_3D_QUALITY  →  return None, drop any stale GLB and leave
                                  the original image EXACTLY as it is —
                                  full quality, 2.5D fallback in the frontend

The original product image is never re-encoded, resized or rewritten by this
pipeline (read-only access), so skipping the conversion can never lower the
image quality.  For accepted images the GLB texture is written at 1280px /
JPEG 95 (near-lossless) so the 3D view does not degrade either.

The public contract of ``ensure_assets`` is unchanged: {glb, depth, provider}
or None, and it never throws.
"""
from __future__ import annotations

import io
import json
import os
import struct
import traceback
from typing import Optional

import numpy as np
from PIL import Image, ImageFilter, ImageOps

MAX_DEPTH_SIZE = 512
TEXTURE_MAX_SIZE = 1280
TEXTURE_JPEG_QUALITY = 95
DEFAULT_GRID = 140
DEPTH_SCALE = 0.26
MIN_3D_QUALITY = 0.55
RELIGHT_STRONG = 0.9
NORMAL_SMALL = 0.16
AUDIO_LEVEL = 0.55

GLB_GENERATOR = "NOVA STORE image_to_3d"
VERSION = 5


def _gauss(arr: np.ndarray, radius: float) -> np.ndarray:
    """Gaussian blur a float array in [0,1] via Pillow (fast, C-backed)."""
    if radius <= 0:
        return arr
    img = Image.fromarray(np.clip(arr * 255.0, 0, 255).astype(np.uint8), mode="L")
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img, dtype=np.float32) / 255.0


def estimate_depth(image_path: str) -> np.ndarray:
    """
    Produce a normalized (0..1) per-pixel depth map.

    Heuristic fusion that works well for product photos:
      • radial "center" prior   — subjects are usually centered
      • local contrast/saliency — textured subject pops from flat background
      • alpha object prior      — transparent PNGs give a perfect silhouette
      • vertical gradient       — bottom of frame reads slightly closer    Returns (depth, metrics) where metrics describes how faithful the estimate
    is for a relief mesh.  ``metrics['quality']`` = 0..1, where ~1 is a
    confident map and low values mean "no structure / flat image / subject not
    where the radial prior expects it".  ``ensure_assets`` uses it as a gate:
    images below MIN_3D_QUALITY are NOT converted — they stay untouched,
    full-quality 2D photos (the frontend falls back to 2.5D).
    """
    with Image.open(image_path) as im:
        im = im.convert("RGBA")
        im.thumbnail((MAX_DEPTH_SIZE, MAX_DEPTH_SIZE), Image.LANCZOS)
        rgba = np.asarray(im, dtype=np.float32) / 255.0

    h, w = rgba.shape[:2]
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

    contrast = np.abs(lum - _gauss(lum, max(4.0, min(h, w) / 48.0)))
    contrast = _gauss(contrast, 3.0)
    raw_c = float(contrast.mean())
    cmax = float(contrast.max()) or 1.0
    contrast = contrast / cmax

    has_alpha = bool((alpha < 0.95).any()) and bool((alpha > 0.05).any())
    if has_alpha:
        mask = alpha > 0.5
        ys, xs = np.nonzero(mask)
        cx, cy = float(xs.mean()) / w, float(ys.mean()) / h
        obj = _gauss(mask.astype(np.float32), 4.0)
    else:
        cx = cy = 0.5
        obj = np.zeros((h, w), dtype=np.float32)

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx / max(w - 1, 1) - cx) * 1.15
    ny = (yy / max(h - 1, 1) - cy) * 1.15
    r2 = nx * nx + ny * ny
    center = np.exp(-r2 / (2.0 * 0.44 ** 2))

    vgrad = (yy / max(h - 1, 1))

    depth = (0.50 * center + 0.24 * contrast + 0.11 * vgrad + 0.15 * obj)

    depth = _gauss(depth, 2.5)
    lo, hi = np.percentile(depth, 1.0), np.percentile(depth, 99.0)
    if hi - lo < 1e-6:
        hi = lo + 1e-6
    depth = np.clip((depth - lo) / (hi - lo), 0.0, 1.0)

    flat = depth.ravel()
    contrast_sigma = float(flat.std())
    pct_span = float(np.percentile(flat, 99) - np.percentile(flat, 1))
    hist, _ = np.histogram(flat, bins=64)
    tiny_bands = int(np.sum(hist > 0.02 * flat.size) * 0.5)

    lh, _ = np.histogram(lum, bins=64, range=(0.0, 1.0))
    prob = lh / max(int(lh.sum()), 1)
    nz = prob[prob > 0]
    entropy = float(-(nz * np.log2(nz)).sum()) if nz.size else 0.0

    content = (0.45 * min(raw_c / 0.010, 1.0)
               + 0.30 * min(float(lum.std()) / 0.06, 1.0)
               + 0.25 * min(entropy / 3.0, 1.0))
    if has_alpha:
        content = max(content, 0.80)

    sal = float(contrast.sum())
    if sal > 1e-9:
        cx_s = float((contrast * xx).sum() / sal) / w
        cy_s = float((contrast * yy).sum() / sal) / h
        sal_off = float(((cx_s - 0.5) ** 2 + (cy_s - 0.5) ** 2) ** 0.5)
    else:
        sal_off = 0.0
    centering = max(0.0, 1.0 - sal_off / 0.35)
    quality = float(content * (0.5 + 0.5 * centering))

    metrics = {
        "std": contrast_sigma,
        "pct_span": pct_span,
        "tiny_bands": tiny_bands,
        "has_alpha": has_alpha,
        "h": h,
        "w": w,
        "quality": quality,
        "raw_c": raw_c,
        "entropy": entropy,
        "sal_offset": sal_off,
    }
    return depth.astype(np.float32), metrics


def save_depth_png(depth: np.ndarray, path: str) -> None:
    img = Image.fromarray((depth * 255.0).astype(np.uint8), mode="L")
    img.save(path, format="PNG")


def _pad(data: bytes, alignment: int = 4, filler: bytes = b"\x00") -> bytes:
    rem = len(data) % alignment
    return data if rem == 0 else data + filler * (alignment - rem)


def build_glb(image_path: str, depth: np.ndarray, quality: float,
              out_path: str, grid: int = DEFAULT_GRID) -> str:
    """
    Write a relief-mesh GLB (textured, lit-friendly normals) to ``out_path``.

    ``quality`` = how faithful the depth is (0..1).  Images below
    MIN_3D_QUALITY never reach this writer — ``ensure_assets`` keeps them as
    plain full-quality photos.  For accepted images a mid-range quality still
    enriches the mesh (ambient occlusion, gentle normal perturbation) so the
    product reads well in 3D.
    """
    with Image.open(image_path) as im:
        im = im.convert("RGB")
        w0, h0 = im.size
        if max(im.size) > TEXTURE_MAX_SIZE:
            im.thumbnail((TEXTURE_MAX_SIZE, TEXTURE_MAX_SIZE), Image.LANCZOS)
        tex_buf = io.BytesIO()
        im.save(tex_buf, format="JPEG", quality=TEXTURE_JPEG_QUALITY, optimize=True)
        tex_bytes = tex_buf.getvalue()

    aspect = w0 / max(h0, 1)
    plane_w, plane_h = (1.0, 1.0 / aspect) if aspect >= 1 else (aspect, 1.0)

    nx = grid if aspect >= 1 else max(24, int(round(grid * aspect)))
    ny = grid if aspect < 1 else max(24, int(round(grid / aspect)))
    nx = int(min(max(nx, 24), 180))
    ny = int(min(max(ny, 24), 180))

    d_img = Image.fromarray((depth * 255.0).astype(np.uint8), mode="L")
    d_img = d_img.resize((nx + 1, ny + 1), Image.BILINEAR)
    d = np.asarray(d_img, dtype=np.float32) / 255.0

    du, dv = plane_w / nx, plane_h / ny
    xs = (np.arange(nx + 1, dtype=np.float32) / nx - 0.5) * plane_w
    ys = (0.5 - np.arange(ny + 1, dtype=np.float32) / ny) * plane_h
    pos_x = np.tile(xs[None, :], (ny + 1, 1))
    pos_y = np.tile(ys[:, None], (1, nx + 1))
    base_z = (d - 0.5) * DEPTH_SCALE * (0.45 + 0.55 * quality)

    dz_dj, dz_di = np.gradient(base_z)
    dzdx = dz_di / du
    dzdy = -dz_dj / dv
    n = np.stack([-dzdx, -dzdy, np.ones_like(dzdx)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)

    if quality < 0.5:
        v = np.linspace(0.0, 1.0, ny + 1, dtype=np.float32)
        v = np.tile(v[None, :], (nx + 1, 1)).T
        tv = np.tile((np.arange(nx + 1, dtype=np.float32) / nx)[None, :], (ny + 1, 1))
        soft = np.clip(1.0 - v, 0, 1) * np.clip(1.0 - tv, 0, 1) * 0.85
        base_z = base_z + soft * (0.35 * (1.0 - quality)) * DEPTH_SCALE * 0.6
        base_z = base_z + (0.12 * (1.0 - quality)) * np.sin(np.clip(v, 0, 1) * np.pi * 0.5)

    positions = np.stack([pos_x, pos_y, base_z], axis=-1).astype(np.float32)
    normals = n.astype(np.float32)
    uvs = np.stack([
        np.tile((np.arange(nx + 1, dtype=np.float32) / nx)[None, :], (ny + 1, 1)),
        np.tile((np.arange(ny + 1, dtype=np.float32) / ny)[:, None], (1, nx + 1)),
    ], axis=-1).astype(np.float32)

    i_idx, j_idx = np.meshgrid(np.arange(nx, dtype=np.int64), np.arange(ny, dtype=np.int64))
    a = (j_idx * (nx + 1) + i_idx).ravel()
    b = a + 1
    c = a + (nx + 1)
    dd = c + 1
    tri = np.stack([np.stack([a, c, b], -1), np.stack([b, c, dd], -1)], axis=1)
    tri = tri.reshape(-1, 3)
    idx_dtype = np.uint16 if positions.shape[0] * positions.shape[1] < 65536 else np.uint32
    indices = tri.astype(idx_dtype)

    blob = b""
    views = []

    def add_view(payload: bytes, target=None, extras=None):
        nonlocal blob
        payload = _pad(payload)
        views.append({"offset": len(blob), "length": len(payload),
                      "target": target, "extras": extras})
        blob += payload

    pos_bytes = positions.tobytes()
    add_view(pos_bytes, target=34962)
    add_view(normals.tobytes(), target=34962)
    add_view(uvs.tobytes(), target=34962)
    add_view(indices.tobytes(), target=34963)
    img_view = len(views)
    add_view(tex_bytes, target=None, extras={"mimeType": "image/jpeg"})

    vmin = positions.reshape(-1, 3).min(axis=0).tolist()
    vmax = positions.reshape(-1, 3).max(axis=0).tolist()
    n_verts = int(positions.shape[0] * positions.shape[1])

    gltf = {
        "asset": {"version": "2.0", "generator": GLB_GENERATOR},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "product_relief"}],
        "meshes": [{
            "primitives": [{
                "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                "indices": 3,
                "material": 0,
                "mode": 4,
            }]
        }],
        "materials": [{
            "name": "product_material",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0},
                "metallicFactor": 0.0,
                "roughnessFactor": 0.78 - 0.18 * quality,
            },
            "doubleSided": False,
        }],
        "textures": [{"sampler": 0, "source": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987,
                      "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": img_view, "mimeType": "image/jpeg"}],
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": v["offset"], "byteLength": v["length"],
             **({"target": v["target"]} if v["target"] else {})}
            for v in views
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": n_verts,
             "type": "VEC3", "min": vmin, "max": vmax},
            {"bufferView": 1, "componentType": 5126, "count": n_verts, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": n_verts, "type": "VEC2"},
            {"bufferView": 3,
             "componentType": 5123 if idx_dtype is np.uint16 else 5125,
             "count": int(indices.size), "type": "SCALAR"},
        ],
    }

    json_bytes = _pad(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), 4, b" ")
    bin_bytes = _pad(blob, 4, b"\x00")

    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(json_bytes), 0x4E4F534A)
    out += json_bytes
    out += struct.pack("<II", len(bin_bytes), 0x004E4942)
    out += bin_bytes

    with open(out_path, "wb") as f:
        f.write(out)
    return out_path


class ProviderError(RuntimeError):
    pass


class ImageTo3DProvider:
    """Interface every provider must implement."""
    name = "base"

    def available(self) -> bool:
        return True

    def convert(self, image_path: str, out_dir: str, key: str,
                quality: float) -> dict:
        """
        Must return:
            { 'glb': abs_path_or_url, 'depth': abs_path_or_url|None, 'provider': name }
        Paths starting with '/' are served by the web server as-is.
        ``quality`` is 0..1, the estimate fidelity for this image.
        """
        raise NotImplementedError


class LocalReliefProvider(ImageTo3DProvider):
    """Classical depth-relief GLB — fast (<1s), offline, no API key."""
    name = "local"

    def available(self) -> bool:
        return True

    def convert(self, image_path: str, out_dir: str, key: str,
                quality: float) -> dict:
        os.makedirs(out_dir, exist_ok=True)
        glb_path = os.path.join(out_dir, f"{key}.glb")
        depth_path = os.path.join(out_dir, f"{key}_depth.png")

        depth, metrics = estimate_depth(image_path)
        save_depth_png(depth, depth_path)

        build_glb(image_path, depth, quality, glb_path)

        out_prefix = os.path.basename(out_dir)
        parent_url = _url_prefix_for_dir(out_dir)
        return {
            "glb": f"{parent_url}/{out_prefix}/{key}.glb",
            "depth": f"{parent_url}/{out_prefix}/{key}_depth.png",
            "provider": self.name,
        }


class RemoteProviderStub(ImageTo3DProvider):
    """
    Skeleton for a real AI image-to-3D service.

    Subclass and override ``convert`` with the vendor's REST flow, e.g.:

        Tripo  : POST https://api.tripo3d.ai/v2/openapi/task   (image → GLB)
        Meshy  : POST https://api.meshy.ai/openapi/v2/image-to-3d
        Rodin  : POST https://hyper3d.rosyfountain.com/api/...

    IMPORTANT: the generated model must end up somewhere the browser can
    reach — either download it into ``out_dir`` (recommended, like the local
    provider) or return an absolute public URL in ``glb``.
    The frontend only consumes the URL returned by /api/products/:id/model3d,
    so no frontend change is ever needed when you switch vendors.
    """
    name = "remote"
    env_key = "PROVIDER_API_KEY"

    def available(self) -> bool:
        return bool(os.getenv(self.env_key))

    def convert(self, image_path: str, out_dir: str, key: str,
                quality: float) -> dict:
        raise ProviderError(
            f"{self.name} provider selected but not implemented yet. "
            f"Implement {self.__class__.__name__}.convert() in "
            f"backend/image_to_3d.py (API key env: {self.env_key})."
        )


class TripoProvider(RemoteProviderStub):
    name = "tripo"
    env_key = "TRIPO_API_KEY"


class MeshyProvider(RemoteProviderStub):
    name = "meshy"
    env_key = "MESHY_API_KEY"


class RodinProvider(RemoteProviderStub):
    name = "rodin"
    env_key = "RODIN_API_KEY"


_REGISTRY = {
    "local": LocalReliefProvider,
    "tripo": TripoProvider,
    "meshy": MeshyProvider,
    "rodin": RodinProvider,
}


def get_provider() -> ImageTo3DProvider:
    name = (os.getenv("IMAGE_TO_3D_PROVIDER") or "local").strip().lower()
    cls = _REGISTRY.get(name, LocalReliefProvider)
    provider = cls()
    if not provider.available():
        return LocalReliefProvider()
    return provider


def _url_prefix_for_dir(out_dir: str) -> str:
    norm = os.path.normpath(out_dir).replace("\\", "/")
    if "/uploads" in norm:
        return "/uploads"
    return "/images"


def resolve_image_path(image_url: str) -> Optional[str]:
    """Map an image URL (/uploads/x.jpg, /images/x.jpg) to a file on disk."""
    if not image_url or not image_url.startswith("/"):
        return None
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if image_url.startswith("/uploads/"):
        rel = image_url[len("/uploads/"):]
        path = os.path.join(base_dir, "frontend", "uploads", rel.replace("/", os.sep))
    elif image_url.startswith("/images/"):
        rel = image_url[len("/images/"):]
        path = os.path.join(base_dir, "images", rel.replace("/", os.sep))
    else:
        return None
    path = os.path.normpath(path)
    if not path.startswith(os.path.normpath(base_dir)):
        return None
    return path if os.path.isfile(path) else None


def _out_dir_for(image_path: str) -> str:
    return os.path.join(os.path.dirname(image_path), "3d")


def ensure_assets(image_url: str, force: bool = False,
                   info: Optional[dict] = None) -> Optional[dict]:
    """
    Make sure a 3D asset exists for this image; build it if needed.

    Returns {'glb','depth','provider','image_url'} or None when:
      * the image is missing, or
      * the image is NOT suitable for a faithful 3D conversion (quality gate):
        nothing is generated or served — the original photo stays exactly as
        it is, untouched and at full quality; the frontend keeps showing it
        (2.5D fallback).

    ``info`` (optional out-dict) is filled with {'reason','quality'} where
    reason = 'missing_image' | 'low_quality' | 'error'.
    """
    if info is None:
        info = {}
    try:
        image_path = resolve_image_path(image_url)
        if not image_path:
            info["reason"] = "missing_image"
            return None

        key = os.path.splitext(os.path.basename(image_path))[0]
        out_dir = _out_dir_for(image_path)
        glb_abs = os.path.join(out_dir, f"{key}.glb")
        depth_abs = os.path.join(out_dir, f"{key}_depth.png")
        meta_abs = os.path.join(out_dir, f"{key}.3d.json")

        prefix = _url_prefix_for_dir(out_dir)
        img_mtime = os.path.getmtime(image_path)

        meta = None
        try:
            if os.path.isfile(meta_abs):
                with open(meta_abs, "r", encoding="utf-8") as fh:
                    meta = json.load(fh)
        except Exception:
            meta = None

        def write_meta(payload: dict) -> None:
            try:
                os.makedirs(out_dir, exist_ok=True)
                with open(meta_abs, "w", encoding="utf-8") as fh:
                    json.dump(payload, fh)
            except Exception:
                pass

        def drop_stale() -> None:
            for stale in (glb_abs, depth_abs):
                try:
                    if os.path.isfile(stale):
                        os.remove(stale)
                except OSError:
                    pass

        def cached_result(qual: Optional[float]) -> dict:
            return {
                "glb": f"{prefix}/3d/{key}.glb",
                "depth": f"{prefix}/3d/{key}_depth.png" if os.path.isfile(depth_abs) else None,
                "provider": get_provider().name,
                "image_url": image_url,
                "cached": True,
                "depth_quality": round(float(qual), 3) if qual is not None else None,
            }

        if (meta and meta.get("version") == VERSION
                and meta.get("image_mtime") == img_mtime):
            if meta.get("rejected"):
                info["reason"] = "low_quality"
                info["quality"] = meta.get("quality", 0.0)
                return None
            if (not force and os.path.isfile(glb_abs)
                    and os.path.getmtime(glb_abs) >= img_mtime):
                return cached_result(meta.get("quality"))

        depth, metrics = estimate_depth(image_path)
        quality = float(metrics.get("quality", 0.0))

        if quality < MIN_3D_QUALITY:
            drop_stale()
            write_meta({"version": VERSION, "image_mtime": img_mtime,
                        "rejected": True, "quality": round(quality, 3)})
            info["reason"] = "low_quality"
            info["quality"] = round(quality, 3)
            return None

        if (not force and os.path.isfile(glb_abs)
                and os.path.getmtime(glb_abs) >= img_mtime):
            write_meta({"version": VERSION, "image_mtime": img_mtime,
                        "rejected": False, "quality": round(quality, 3)})
            return cached_result(quality)

        provider = get_provider()
        result = provider.convert(image_path, out_dir, key, quality)
        result["image_url"] = image_url
        result["image_depth_metrics"] = metrics
        result["depth_quality"] = round(quality, 3)
        write_meta({"version": VERSION, "image_mtime": img_mtime,
                    "rejected": False, "quality": round(quality, 3)})
        return result
    except Exception:
        traceback.print_exc()
        info["reason"] = "error"
        return None

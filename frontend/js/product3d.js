const Product3D = (() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = { three: null, loading: false };
    const Providers = {
        async resolve(product) {
            const custom = window.PRODUCT_3D_PROVIDER;
            if (custom && typeof custom.resolve === 'function') {
                try {
                    return await custom.resolve(product);
                } catch (e) {  }
            }
            const url = product.model3d_url || product.model_url || product.glb_url;
            if (url) return { type: 'gltf', url, relief: true };
            if (product.id) {
                const status = await Providers._query(product.id);
                if (status && status.status === 'ready' && status.glb) {
                    return {
                        type: 'gltf',
                        url: status.glb,
                        depth: status.depth || null,
                        provider: status.provider || 'local',
                        relief: (status.provider || 'local') === 'local'
                    };
                }
                if (status && status.status === 'processing') {
                    await new Promise(r => setTimeout(r, 1400));
                    const again = await Providers._query(product.id);
                    if (again && again.status === 'ready' && again.glb) {
                        return { type: 'gltf', url: again.glb, relief: true };
                    }
                }
            }
            return null;
        },
        async _query(productId) {
            try {
                const r = await fetch(`/api/products/${productId}/model3d`, { credentials: 'include' });
                if (!r.ok) return null;
                return await r.json();
            } catch (e) { return null; }
        },
        async requestConversion(productId) {
            const custom = window.PRODUCT_3D_PROVIDER;
            if (custom && typeof custom.requestConversion === 'function') {
                return custom.requestConversion(productId);
            }
            try {
                const r = await fetch(`/api/products/${productId}/model3d`, {
                    method: 'POST', credentials: 'include'
                });
                return r.ok ? await r.json() : null;
            } catch (e) { return null; }
        }
    };
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    async function ensureThree() {
        if (state.three) return state.three;
        if (state.loading) return null;
        if (!window.WebGLRenderingContext) return null;
        state.loading = true;
        try {
            if (!window.THREE) {
                await loadScript('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js');
            }
            if (!window.THREE) throw new Error('THREE unavailable');
            const loaderReady = () => !!(window.GLTFLoader || (window.THREE && window.THREE.GLTFLoader));
            if (!loaderReady()) {
                await loadScript('https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js');
            }
            state.three = window.THREE;
        } catch (e) {
            state.three = null;
        }
        state.loading = false;
        return state.three;
    }
    function mount2D5(container, product) {
        container.classList.add('pv-stage');
        container.innerHTML = `
            <div class="pv-rings" aria-hidden="true"><span></span><span></span><span></span></div>
            <div class="pv-floor" aria-hidden="true"></div>
            ${product.image_url ? `<img class="pv-img" src="${product.image_url}" alt="${product.name}">` : `<div class="pv-hint">تصویری موجود نیست</div>`}
            <span class="pv-hint">🖱️ موس را حرکت دهید</span>
        `;
        const img = container.querySelector('.pv-img');
        if (!img) return;
        const onMove = (e) => {
            const r = container.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            img.style.transform = `
                rotateY(${(x * 16).toFixed(2)}deg)
                rotateX(${(-y * 10).toFixed(2)}deg)
                translateZ(30px)
                translateX(${(x * 14).toFixed(2)}px)`;
        };
        const onOrient = (e) => {
            const x = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
            const y = Math.max(-1, Math.min(1, ((e.beta || 90) - 90) / 45));
            img.style.transform = `
                rotateY(${(x * 14).toFixed(2)}deg)
                rotateX(${(-y * 8).toFixed(2)}deg)
                translateZ(24px)`;
        };
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            container.addEventListener('mousemove', onMove, { passive: true });
            container.addEventListener('mouseleave', () => { img.style.transform = ''; });
        } else {
            window.addEventListener('deviceorientation', onOrient, { passive: true });
        }
    }
    async function mount3D(container, product, modelInfo) {
        const modelUrl = typeof modelInfo === 'string' ? modelInfo : modelInfo.url;
        const relief = !!(modelInfo && modelInfo.relief);
        const THREE = await ensureThree();
        const GLTFLoaderCtor = THREE && (window.GLTFLoader || THREE.GLTFLoader);
        if (!THREE || !GLTFLoaderCtor) {
            mount2D5(container, product);
            return '2.5d';
        }
        try {
            container.classList.add('pv-stage');
            container.innerHTML = `
                <span class="pv-3d-badge">✦ 3D</span>
                <span class="pv-hint">بچرخانید • اسکرول = زوم</span>
                <div class="pv-floor" aria-hidden="true"></div>`;
            const width = container.clientWidth || 480;
            const height = container.clientHeight || 480;
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
            renderer.setSize(width, height);
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.1;
            container.prepend(renderer.domElement);
            scene.add(new THREE.HemisphereLight(0x9db8ff, 0x0a0e20, 0.9));
            const key = new THREE.DirectionalLight(0x7fb0ff, 1.6);
            key.position.set(2.5, 3, 2.5);
            scene.add(key);
            const rim = new THREE.DirectionalLight(0x22d3ee, 1.1);
            rim.position.set(-3, 1.2, -2.5);
            scene.add(rim);
            const loader = new GLTFLoaderCtor();
            const gltf = await loader.loadAsync(modelUrl);
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            model.scale.setScalar(2.6 / maxDim);
            model.position.copy(center).multiplyScalar(-(2.6 / maxDim));
            scene.add(model);
            let autoRotate = !prefersReduced;
            let targetRotY = 0, currentRotY = 0;
            let targetRotX = 0, currentRotX = 0;
            let camDist = relief ? 3.4 : 4.2, targetDist = camDist;
            let isDragging = false, lastX = 0;
            const clamp = (v, m) => Math.max(-m, Math.min(m, v));
            const canvas = renderer.domElement;
            canvas.style.cursor = 'grab';
            canvas.style.touchAction = 'pan-y';
            canvas.addEventListener('pointerdown', (e) => { isDragging = true; lastX = e.clientX; autoRotate = false; canvas.style.cursor = 'grabbing'; });
            window.addEventListener('pointerup', () => { isDragging = false; canvas.style.cursor = 'grab'; });
            canvas.addEventListener('pointerleave', () => { autoRotate = !prefersReduced; });
            canvas.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                targetRotY += (e.clientX - lastX) * 0.01;
                lastX = e.clientX;
                if (relief) targetRotY = clamp(targetRotY, 0.62);
            });
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                targetDist = Math.min(8, Math.max(2.2, targetDist + e.deltaY * 0.002));
            }, { passive: false });
            if (relief && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                container.addEventListener('mousemove', (e) => {
                    const r = container.getBoundingClientRect();
                    const x = (e.clientX - r.left) / r.width - 0.5;
                    const y = (e.clientY - r.top) / r.height - 0.5;
                    autoRotate = false;
                    targetRotY = clamp(x * 1.1, 0.62);
                    targetRotX = clamp(-y * 0.7, 0.38);
                }, { passive: true });
            } else if (relief) {
                window.addEventListener('deviceorientation', (e) => {
                    if (e.gamma == null) return;
                    autoRotate = false;
                    targetRotY = clamp((e.gamma || 0) / 45 * 0.55, 0.62);
                    targetRotX = clamp(-((e.beta || 90) - 90) / 45 * 0.3, 0.38);
                }, { passive: true });
            }
            const onResize = () => {
                const w = container.clientWidth || width, h = container.clientHeight || height;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            };
            window.addEventListener('resize', onResize);
            const clock = new THREE.Clock();
            let disposed = false;
            container._pvDispose = () => {
                disposed = true;
                window.removeEventListener('resize', onResize);
                renderer.dispose();
            };
            const render = () => {
                if (disposed) return;
                requestAnimationFrame(render);
                const dt = clock.getDelta();
                const t = clock.elapsedTime;
                if (relief) {
                    if (autoRotate) {
                        targetRotY = Math.sin(t * 0.55) * 0.30;
                        targetRotX = Math.sin(t * 0.40) * 0.09 + 0.03;
                    }
                    currentRotY += (targetRotY - currentRotY) * 0.07;
                    currentRotX += (targetRotX - currentRotX) * 0.07;
                    model.rotation.y = currentRotY;
                    model.rotation.x = currentRotX;
                    model.position.y = prefersReduced ? 0 : Math.sin(t * 0.9) * 0.035;
                    camDist += (targetDist - camDist) * 0.1;
                    camera.position.set(0, 0.25, camDist);
                } else {
                    if (autoRotate) targetRotY += dt * 0.25;
                    currentRotY += (targetRotY - currentRotY) * 0.12;
                    camDist += (targetDist - camDist) * 0.12;
                    model.rotation.y = currentRotY;
                    camera.position.set(0, 0.6, camDist);
                }
                camera.lookAt(0, 0, 0);
                renderer.render(scene, camera);
            };
            render();
            return '3d';
        } catch (err) {
            console.warn('3D mount failed, using 2.5D fallback:', err);
            mount2D5(container, product);
            return '2.5d';
        }
    }
    async function mount(container, product) {
        if (!container) return 'none';
        if (!product) return 'none';
        mount2D5(container, product);
        return '2.5d';
    }
    return { mount, Providers, ensureThree, mount2D5 };
})();
window.Product3D = Product3D;

# ============================================================
# NOVA STORE — راهنمای نصب روی هاست
# ============================================================

## ۱) پیش‌نیازهای هاست
- Python 3.10 یا بالاتر (Flask + WSGI)
- MySQL 5.7+ / MariaDB 10.3+
- امکان نصب پکیج با pip (ترجیحاً virtualenv)

## ۲) آپلود فایل‌ها
کل محتوای این زیپ را روی هاست Extract کنید:

    backend/          → کد Flask (app.py + image_to_3d.py)
    frontend/         → صفحات HTML + css/ + js/ + uploads/
    images/           → عکس‌های محصولات
    database/         → schema.sql دیتابیس
    requirements.txt  → وابستگی‌های Python
    .env.example      → نمونه تنظیمات (به .env تغییر نام دهید)

## ۳) دیتابیس (دیتای کامل محصولات داخل زیپ هست)
یک دیتابیس MySQL بسازید (مثلاً `ecommerce_db`) و بعد دامپ کامل را ایمپورت کنید:

    mysql -u USER -p DBNAME < database/nova_full.sql

این فایل شامل **همه جدول‌ها + همه محصولات و کاربران فعلی** است، پس سایت
بلافاصله با همان محصولات و عکس‌هایی که لوکال داشتید بالا می‌آید.

- عکس‌های محصولات از پوشه `images/` داخل همین زیپ سرو می‌شوند (مسیر `/images/...`).
- `database/schema.sql` فقط ساختار جدول خالی است — لازم نیست اجرایش کنید.
- app.py هم در اولین اجرا جداول را چک و در صورت نبود می‌سازد و ادمین
  پیش‌فرض (ADMIN_USERNAME / ADMIN_PASSWORD از .env) را اضافه می‌کند.
- دقت کنید کاربر ادمین داخل دامپ رمز هش‌شده دارد؛ اگر رمزش را نمی‌دانید،
  کاربر را از دیتابیس حذف کنید تا app.py دوباره با رمز .env بسازدش.

## ۴) تنظیمات (.env)
فایل `.env.example` را به `.env` تغییر نام دهید و مقادیر را پر کنید:

    DB_HOST=localhost
    DB_USER=...
    DB_PASSWORD=...
    DB_NAME=...
    SECRET_KEY=یک-کلید-تصادفی-طولانی
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=رمز-قوی-ادمین

## ۵) نصب وابستگی‌ها و اجرا

    pip install -r requirements.txt
    python backend/app.py        # اجرای مستقیم (پورت 5000)

روی هاست cPanel/داکر بهتر است با gunicorn اجرا کنید:

    pip install gunicorn
    gunicorn -w 2 -b 0.0.0.0:8000 backend.app:app

نکته ویندوز: backend/app.py بدون پکیج gunicorn اجرا می‌شود؛ روی لینوکس
اگر پورت 5000 آزاد نبود، با `-b 0.0.0.0:PORT` پورت را عوض کنید.

## ۶) نکات مهم
- اگه عکس آپلودی دارید، محتوای `frontend/uploads/` همراه زیپ منتقل شده.
- مسیرهای `/uploads/...` و `/images/...` توسط خود Flask سرو می‌شوند.
- SSL/HTTPS را از پنل هاست فعال کنید و `SECRET_KEY` را حتماً عوض کنید.

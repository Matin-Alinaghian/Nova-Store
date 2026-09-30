from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from mysql.connector import Error
from datetime import datetime, timedelta
import os
import uuid
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

try:
    import image_to_3d as image_to_3d_service
except ImportError:
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import image_to_3d as image_to_3d_service

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
IMAGE_DIR = os.path.join(BASE_DIR, 'images')
UPLOAD_DIR = os.path.join(FRONTEND_DIR, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

app = Flask(__name__, 
            template_folder=FRONTEND_DIR, 
            static_folder=FRONTEND_DIR,
            static_url_path='')
CORS(app)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-here-change-in-production')

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'ecommerce_db')
}

def _log(msg: str) -> None:
    """Print without crashing on Windows console (cp1256) encoding."""
    try:
        print(msg)
    except Exception:
        pass


def _seed_products_from_sql_dump():
    """اگر جدول products خالی بود، دیتای کامل (محصولات + کاربران) از فایل دامپ ایمپورت می‌شود."""
    try:
        connection = get_db_connection()
        if not connection:
            return
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM products")
        count = cursor.fetchone()[0]
        cursor.close()
        connection.close()
        if count and int(count) > 0:
            return

        dump_path = os.path.join(BASE_DIR, 'database', 'nova_full.sql')
        if not os.path.isfile(dump_path):
            _log("⚠️ دیتای اولیه پیدا نشد (database/nova_full.sql)")
            return

        with open(dump_path, 'r', encoding='utf-8') as f:
            sql_text = f.read()

        statements = []
        for raw in sql_text.split(';'):
            stmt = raw.strip()
            if not stmt:
                continue
            head = stmt.lstrip('/*').strip().upper()
            if head.startswith(('DROP', 'CREATE', 'LOCK', 'UNLOCK')):
                continue
            if stmt.startswith('--'):
                continue
            statements.append(stmt)

        connection = get_db_connection()
        if not connection:
            return
        cursor = connection.cursor()
        try:
            cursor.execute("SET FOREIGN_KEY_CHECKS=0")
            imported = False
            for stmt in statements:
                try:
                    cursor.execute(stmt)
                    if stmt.upper().startswith('INSERT'):
                        imported = True
                except Error as se:
                    _log(f"  (skip) {str(se).split(':')[0]}")
            cursor.execute("SET FOREIGN_KEY_CHECKS=1")
            connection.commit()
            if imported:
                cursor.execute("SELECT COUNT(*) FROM products")
                _log(f"✅ دیتای اولیه ایمپورت شد — تعداد محصولات: {cursor.fetchone()[0]}")
            else:
                _log("⚠️ هیچ رکوردی از دامپ ایمپورت نشد؛ عجیب است، لاگ بالا را چک کنید.")
        finally:
            cursor.close()
            connection.close()
    except Exception as e:
        _log(f"⚠️ ایمپورت دیتای اولیه انجام نشد: {e}")


def get_db_connection():
    """اتصال به دیتابیس"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        _log(f"خطا در اتصال به دیتابیس: {e}")
        return None

def init_database():
    """ایجاد جداول دیتابیس"""
    connection = get_db_connection()
    if connection:
        cursor = connection.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
            AND COLUMN_NAME = 'last_login'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price FLOAT NOT NULL,
                image_url VARCHAR(255),
                quantity INT DEFAULT 0,
                category VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)

        for column, definition in (
            ('featured', 'BOOLEAN NOT NULL DEFAULT FALSE'),
            ('discount_price', 'FLOAT NULL DEFAULT NULL'),
            ('use_3d', 'BOOLEAN NOT NULL DEFAULT TRUE')
        ):
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
                AND COLUMN_NAME = %s
            """, (column,))
            if cursor.fetchone()[0] == 0:
                cursor.execute(f"ALTER TABLE products ADD COLUMN {column} {definition}")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                total_price FLOAT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                price FLOAT NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        """)
        
        connection.commit()
        cursor.close()
        connection.close()
        _log("✅ دیتابیس آماده شد")

        _seed_products_from_sql_dump()

        admin_username = os.getenv('ADMIN_USERNAME', 'admin')
        admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT id FROM users WHERE username = %s", (admin_username,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO users (username, email, password, is_admin) VALUES (%s, %s, %s, TRUE)",
                (admin_username, f'{admin_username}@local.test', generate_password_hash(admin_password))
            )
            connection.commit()
            _log(f"✅ ادمین پیش‌فرض ساخته شد: {admin_username}")
        cursor.close()
        connection.close()

@app.route('/api/register', methods=['POST'])
def register():
    """ثبت نام کاربر جدید"""
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    
    if not username or not email or not password:
        return jsonify({'error': 'تمام فیلدها الزامی هستند'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500
    
    try:
        cursor = connection.cursor()
        hashed_password = generate_password_hash(password)
        
        cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
            (username, email, hashed_password)
        )
        connection.commit()
        
        return jsonify({'message': 'کاربر با موفقیت ثبت شد'}), 201
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 400
    finally:
        cursor.close()
        connection.close()

@app.route('/api/login', methods=['POST'])
def login():
    """ورود کاربر"""
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'نام کاربری و رمز عبور الزامی است'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        
        if user and check_password_hash(user['password'], password):
            cursor.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s", (user['id'],))
            connection.commit()
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['is_admin'] = user['is_admin']
            
            return jsonify({
                'message': 'ورود موفق',
                'user_id': user['id'],
                'username': user['username'],
                'is_admin': user['is_admin']
            }), 200
        else:
            return jsonify({'error': 'نام کاربری یا رمز عبور اشتباه'}), 401
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/users', methods=['GET'])
def get_users():
    """دریافت فهرست کاربران برای ادمین"""
    if not session.get('is_admin'):
        return jsonify({'error': 'دسترسی رد شد'}), 403

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, username, email, is_admin,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at,
                   DATE_FORMAT(last_login, '%Y-%m-%d %H:%i') AS last_login
            FROM users ORDER BY created_at DESC
        """)
        return jsonify(cursor.fetchall()), 200
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/logout', methods=['POST'])
def logout():
    """خروج کاربر"""
    session.clear()
    return jsonify({'message': 'خروج موفق'}), 200

@app.route('/api/products', methods=['GET'])
def get_products():
    """دریافت تمام محصولات"""
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT *, ROUND((price - discount_price) / price * 100, 0) AS discount_percent FROM products")
        products = cursor.fetchall()
        return jsonify(products), 200
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """دریافت یک محصول"""
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT *, ROUND((price - discount_price) / price * 100, 0) AS discount_percent FROM products WHERE id = %s", (product_id,))
        product = cursor.fetchone()
        
        if product:
            return jsonify(product), 200
        else:
            return jsonify({'error': 'محصول یافت نشد'}), 404
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/products', methods=['POST'])
def add_product():
    """اضافه کردن محصول (فقط ادمین)"""
    if not session.get('is_admin'):
        return jsonify({'error': 'دسترسی رد شد'}), 403
    
    data = request.get_json(silent=True) or {}
    required_fields = ('name', 'price', 'quantity', 'category')
    if any(data.get(field) in (None, '') for field in required_fields):
        return jsonify({'error': 'نام، قیمت، موجودی و دسته‌بندی الزامی هستند'}), 400
    try:
        price = float(data['price'])
        quantity = int(data['quantity'])
        if price < 0 or quantity < 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'قیمت و موجودی باید عدد مثبت باشند'}), 400
    discount_price = data.get('discount_price')
    if discount_price not in (None, ''):
        try:
            discount_price = float(discount_price)
            if discount_price < 0 or discount_price >= price:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({'error': 'قیمت تخفیفی باید کمتر از قیمت اصلی باشد'}), 400
    else:
        discount_price = None
    featured = bool(data.get('featured', False))
    use_3d = bool(data.get('use_3d', True))
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500
    
    try:
        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO products (name, description, price, discount_price, image_url, quantity, category, featured, use_3d)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data.get('name'),
            data.get('description'),
            price,
            discount_price,
            data.get('image_url'),
            quantity,
            data.get('category'),
            featured,
            use_3d
        ))
        connection.commit()
        product_id = cursor.lastrowid

        if data.get('image_url') and use_3d:
            try:
                image_to_3d_service.ensure_assets(data['image_url'])
            except Exception as e:
                print(f'3D conversion skipped: {e}')

        return jsonify({'message': 'محصول اضافه شد', 'id': product_id}), 201
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.route('/images/<path:filename>')
def catalog_image(filename):
    return send_from_directory(IMAGE_DIR, filename)

@app.route('/api/upload', methods=['POST'])
def upload_image():
    """آپلود تصویر محصول (فقط ادمین)"""
    if not session.get('is_admin'):
        return jsonify({'error': 'دسترسی رد شد'}), 403

    image = request.files.get('image')
    if not image or not image.filename:
        return jsonify({'error': 'فایل تصویر انتخاب نشده است'}), 400

    extension = image.filename.rsplit('.', 1)[-1].lower() if '.' in image.filename else ''
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({'error': 'فرمت تصویر مجاز نیست'}), 400

    filename = f'{uuid.uuid4().hex}.{extension}'
    image.save(os.path.join(UPLOAD_DIR, filename))

    model3d = None
    try:
        model3d = image_to_3d_service.ensure_assets(f'/uploads/{filename}')
    except Exception as e:
        print(f'3D conversion skipped: {e}')

    payload = {'image_url': f'/uploads/{filename}'}
    if model3d:
        payload['model3d'] = model3d
    return jsonify(payload), 201


@app.route('/api/products/<int:product_id>/model3d', methods=['GET'])
def product_model3d(product_id):
    """وضعیت مدل سه‌بعدی محصول — در صورت نیاز همان لحظه ساخته می‌شود"""
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 503
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT image_url, use_3d FROM products WHERE id = %s", (product_id,))
        row = cursor.fetchone()
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        try:
            cursor.close()
            connection.close()
        except Exception:
            pass

    if not row or not row.get('image_url'):
        return jsonify({'status': 'none'}), 200

    if not row.get('use_3d', True):
        return jsonify({'status': 'none', 'mode': 'normal'}), 200

    assets = image_to_3d_service.ensure_assets(row['image_url'])
    if assets:
        return jsonify({'status': 'ready', **assets}), 200
    return jsonify({'status': 'none'}), 200


@app.route('/api/products/<int:product_id>/model3d', methods=['POST'])
def rebuild_product_model3d(product_id):
    """ساخت اجباری دوباره مدل سه‌بعدی (فقط ادمین)"""
    if not session.get('is_admin'):
        return jsonify({'error': 'دسترسی رد شد'}), 403
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 503
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT image_url, use_3d FROM products WHERE id = %s", (product_id,))
        row = cursor.fetchone()
    finally:
        cursor.close()
        connection.close()

    if not row or not row.get('image_url'):
        return jsonify({'status': 'none', 'error': 'تصویری برای این محصول ثبت نشده'}), 404

    if not row.get('use_3d', True):
        return jsonify({
            'status': 'none',
            'message': 'تیک «سه‌بعدی» برای این محصول فعال نیست؛ برای ساخت مدل، ابتدا آن را در ویرایش محصول روشن کنید.'
        }), 200

    info = {}
    assets = image_to_3d_service.ensure_assets(row['image_url'], force=True, info=info)
    if assets:
        return jsonify({'status': 'ready', **assets}), 200
    if info.get('reason') == 'low_quality':
        return jsonify({
            'status': 'none',
            'quality': info.get('quality'),
            'message': 'کیفیت تصویر برای ساخت مدل سه‌بعدی کافی نیست؛ تصویر مثل قبل با کیفیت کامل نمایش داده می‌شود.'
        }), 200
    if info.get('reason') == 'missing_image':
        return jsonify({'status': 'none', 'error': 'تصویری برای این محصول ثبت نشده'}), 404
    return jsonify({'status': 'error', 'error': 'ساخت مدل سه‌بعدی ناموفق بود'}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    """ویرایش محصول (فقط ادمین)"""
    if not session.get('is_admin'):
        return jsonify({'error': 'دسترسی رد شد'}), 403
    
    data = request.get_json(silent=True) or {}
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500

    try:
        price = float(data.get('price'))
        quantity = int(data.get('quantity'))
        discount_price = data.get('discount_price')
        discount_price = None if discount_price in (None, '') else float(discount_price)
        if price < 0 or quantity < 0 or (discount_price is not None and (discount_price < 0 or discount_price >= price)):
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'قیمت‌ها و موجودی را صحیح وارد کنید؛ تخفیف باید کمتر از قیمت اصلی باشد'}), 400
    
    try:
        cursor = connection.cursor()
        cursor.execute("""
            UPDATE products 
            SET name=%s, description=%s, price=%s, discount_price=%s, image_url=%s, quantity=%s, category=%s, featured=%s, use_3d=%s
            WHERE id=%s
        """, (
            data.get('name'),
            data.get('description'),
            price,
            discount_price,
            data.get('image_url'),
            quantity,
            data.get('category'),
            bool(data.get('featured', False)),
            bool(data.get('use_3d', True)),
            product_id
        ))
        connection.commit()

        if data.get('image_url') and bool(data.get('use_3d', True)):
            try:
                image_to_3d_service.ensure_assets(data['image_url'])
            except Exception as e:
                print(f'3D conversion skipped: {e}')

        return jsonify({'message': 'محصول به‌روز شد'}), 200
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    """حذف محصول (فقط ادمین)"""
    if not session.get('is_admin'):
        return jsonify({'error': 'دسترسی رد شد'}), 403
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500
    
    try:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM products WHERE id = %s", (product_id,))
        connection.commit()
        
        return jsonify({'message': 'محصول حذف شد'}), 200
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/orders', methods=['POST'])
def create_order():
    """ایجاد سفارش جدید — موجودی انبار در همین تراکنش کم می‌شود"""
    if 'user_id' not in session:
        return jsonify({'error': 'ابتدا وارد شوید'}), 401
    
    data = request.get_json(silent=True) or {}
    raw_items = data.get('items') or []
    if not isinstance(raw_items, list) or not raw_items:
        return jsonify({'error': 'سبد خرید خالی است'}), 400

    items = []
    for item in raw_items:
        try:
            pid = int(item.get('product_id'))
            qty = int(item.get('quantity', 1))
        except (TypeError, ValueError):
            return jsonify({'error': 'آیتم نامعتبر در سبد خرید'}), 400
        if pid <= 0 or qty <= 0:
            return jsonify({'error': 'آیتم نامعتبر در سبد خرید'}), 400
        items.append({'product_id': pid, 'quantity': qty})

    merged = {}
    for it in items:
        merged[it['product_id']] = merged.get(it['product_id'], 0) + it['quantity']

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500
    
    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("START TRANSACTION")
        cursor.execute(
            "SELECT id, name, price, discount_price, quantity FROM products WHERE id IN (" +
            ",".join(['%s'] * len(merged)) + ") FOR UPDATE",
            tuple(merged.keys())
        )
        rows = {r['id']: r for r in cursor.fetchall()}

        shortages = []
        total_price = 0
        for pid, qty in merged.items():
            row = rows.get(pid)
            if not row:
                shortages.append({'product_id': pid, 'error': 'یافت نشد'})
                continue
            unit_price = row['price']
            if row.get('discount_price') is not None and 0 < row['discount_price'] < row['price']:
                unit_price = row['discount_price']
            if row['quantity'] < qty:
                shortages.append({
                    'product_id': pid,
                    'name': row['name'],
                    'requested': qty,
                    'available': row['quantity']
                })
            else:
                total_price += unit_price * qty

        if shortages:
            connection.rollback()
            return jsonify({
                'error': 'موجودی برخی محصولات کافی نیست',
                'shortages': shortages
            }), 409

        cursor.execute("""
            INSERT INTO orders (user_id, total_price)
            VALUES (%s, %s)
        """, (session['user_id'], total_price))
        
        order_id = cursor.lastrowid
        
        for pid, qty in merged.items():
            row = rows[pid]
            unit_price = row['price']
            if row.get('discount_price') is not None and 0 < row['discount_price'] < row['price']:
                unit_price = row['discount_price']
            cursor.execute("""
                INSERT INTO order_items (order_id, product_id, quantity, price)
                VALUES (%s, %s, %s, %s)
            """, (order_id, pid, qty, unit_price))
            cursor.execute("""
                UPDATE products
                SET quantity = quantity - %s
                WHERE id = %s
            """, (qty, pid))
        
        connection.commit()
        
        return jsonify({'message': 'سفارش ایجاد شد', 'order_id': order_id}), 201
    except Error as e:
        try:
            connection.rollback()
        except Exception:
            pass
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        try:
            cursor.close()
            connection.close()
        except Exception:
            pass

@app.route('/api/orders', methods=['GET'])
def get_orders():
    """دریافت سفارش‌ها: ادمین همه سفارش‌ها را می‌بیند، کاربر فقط سفارش‌های خودش را"""
    if 'user_id' not in session:
        return jsonify({'error': 'ابتدا وارد شوید'}), 401

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500

    try:
        cursor = connection.cursor(dictionary=True)
        if session.get('is_admin'):
            cursor.execute("""
                SELECT o.id, o.user_id, o.total_price, o.status,
                       DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i') AS created_at,
                       u.username AS user_name,
                       GROUP_CONCAT(CONCAT(oi.product_id, ':', oi.quantity) SEPARATOR ',') as items
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN users u ON o.user_id = u.id
                GROUP BY o.id, o.user_id, o.total_price, o.status, o.created_at, u.username
                ORDER BY o.created_at DESC
            """)
        else:
            cursor.execute("""
                SELECT o.*,
                       GROUP_CONCAT(CONCAT(oi.product_id, ':', oi.quantity) SEPARATOR ',') as items
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = %s
                GROUP BY o.id
                ORDER BY o.created_at DESC
            """, (session['user_id'],))

        orders = cursor.fetchall()
        return jsonify(orders), 200
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order_detail(order_id):
    """جزئیات یک سفارش: مشخصات مشتری + فهرست اقلام با نام، تعداد و قیمت"""
    if not session.get('is_admin'):
        return jsonify({'error': 'دسترسی رد شد'}), 403

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT o.id, o.user_id, o.total_price, o.status,
                   DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i') AS created_at,
                   u.username, u.email
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            return jsonify({'error': 'سفارش یافت نشد'}), 404

        cursor.execute("""
            SELECT oi.product_id, oi.quantity, oi.price,
                   COALESCE(p.name, '') AS name,
                   COALESCE(p.image_url, '') AS image_url,
                   COALESCE(p.category, '') AS category
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = %s
            ORDER BY oi.id
        """, (order_id,))
        items = cursor.fetchall()
        total_qty = 0
        for it in items:
            it['price'] = float(it['price'])
            it['quantity'] = int(it['quantity'])
            it['line_total'] = round(it['price'] * it['quantity'], 2)
            total_qty += it['quantity']

        order['total_price'] = float(order['total_price'] or 0)
        order['items'] = items
        order['items_count'] = total_qty
        return jsonify(order), 200
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        try:
            cursor.close()
            connection.close()
        except Exception:
            pass


@app.route('/api/my-orders', methods=['GET'])
def get_my_orders():
    """سفارش‌های کاربر لاگین‌شده با جزئیات آیتم‌ها (نام، تصویر، قیمت واحد)"""
    if 'user_id' not in session:
        return jsonify({'error': 'ابتدا وارد شوید'}), 401

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'خطا در اتصال به دیتابیس'}), 500

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT o.id, o.total_price, o.status,
                   DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i') AS created_at,
                   GROUP_CONCAT(
                       CONCAT(oi.product_id, ':', oi.quantity, ':', oi.price, ':',
                              COALESCE(p.name, ''), ':', COALESCE(p.image_url, ''))
                       SEPARATOR '||'
                   ) AS items_raw
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.user_id = %s
            GROUP BY o.id, o.total_price, o.status, o.created_at
            ORDER BY o.created_at DESC
        """, (session['user_id'],))

        orders = []
        for row in cursor.fetchall():
            items = []
            for chunk in (row.get('items_raw') or '').split('||'):
                if not chunk:
                    continue
                parts = chunk.split(':')
                if len(parts) < 3:
                    continue
                try:
                    pid, qty, price = int(parts[0]), int(parts[1]), float(parts[2])
                except ValueError:
                    continue
                name = parts[3] if len(parts) > 3 else ''
                image = parts[4] if len(parts) > 4 else ''
                items.append({
                    'product_id': pid,
                    'quantity': qty,
                    'price': price,
                    'name': name,
                    'image_url': image
                })
            orders.append({
                'id': row['id'],
                'total_price': row['total_price'],
                'status': row['status'],
                'created_at': row['created_at'],
                'items': items
            })
        return jsonify(orders), 200
    except Error as e:
        return jsonify({'error': f'خطا: {str(e)}'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/admin')
def admin():
    if not session.get('is_admin'):
        return redirect(url_for('login_page'))
    return render_template('admin.html')

@app.route('/products')
def products_page():
    return render_template('products.html')

@app.route('/cart')
def cart_page():
    return render_template('cart.html')

@app.route('/orders')
def orders_page():
    """صفحه سفارش‌های من (خود کاربر فقط سفارش‌هایش را می‌بیند)"""
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('orders.html')

@app.route('/product')
def product_detail_page():
    """صفحه جزئیات محصول (فقط UI جدید؛ از همان API های موجود استفاده می‌کند)"""
    return render_template('product.html')

@app.route('/about')
def about_page():
    """صفحه درباره ما (صفحه جدید — هیچ API یا منطق موجودی تغییر نکرده)"""
    return render_template('about.html')

if __name__ == '__main__':
    init_database()
    app.run(debug=True, port=5000)

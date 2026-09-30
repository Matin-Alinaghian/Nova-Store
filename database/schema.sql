CREATE DATABASE IF NOT EXISTS ecommerce_db;
USE ecommerce_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price FLOAT NOT NULL,
    image_url VARCHAR(255),
    quantity INT DEFAULT 0,
    category VARCHAR(100),
    featured BOOLEAN DEFAULT FALSE,
    discount_price FLOAT NULL DEFAULT NULL,
    use_3d BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_name (name)
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_price FLOAT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price FLOAT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id)
);

INSERT INTO users (username, email, password, is_admin) 
VALUES ('admin', 'admin@example.com', 'hashed_password_here', TRUE);

INSERT INTO products (name, description, price, quantity, category, image_url) VALUES
('لپ‌تاپ HP', 'لپ‌تاپ قدرتمند برای کار و بازی', 15000000, 5, 'الکترونیک', ''),
('ماوس بی‌سیم', 'ماوس راحت و پایدار', 500000, 20, 'تجهیزات', ''),
('کیبورد مکانیکی', 'کیبورد با کلیدهای مکانیکی', 2000000, 10, 'تجهیزات', ''),
('مانیتور 4K', 'صفحه‌نمایش با کیفیت 4K', 8000000, 3, 'الکترونیک', ''),
('هدفون بی‌سیم', 'صدای عالی و راحتی بیشتر', 3000000, 15, 'صوتی', '');

CREATE INDEX idx_order_created_at ON orders(created_at);
CREATE INDEX idx_product_created_at ON products(created_at);

COMMIT;

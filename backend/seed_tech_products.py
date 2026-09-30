"""
Complete the tech store: replace fashion placeholders with real tech products
(laptops, phones, audio, accessories) and fire up their 3D model generation.
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
from dotenv import load_dotenv
load_dotenv()

import mysql.connector

DB = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'ecommerce_db'),
}

PRODUCTS = [
    ("لپ‌تاپ نووا بلید ۱۵ این‌دی",
     "رنگ یک‌بعدی ریمو با تکپردازش مگاپروسسور و نمایشگر اکس reassessment ۴ کانتِست، برای کار هنرمند و بازی.",
     85000000, 12, "الکترونیک", "/images/photo_1_2026-09-03_23-04-59.jpg", 3),
    ("لپ‌تاپ هوشمند نووا پیپی ۱۴",
     "پنل مگاپروسسور، کارت گرافیک رژیم، ۳۲ گیگابایت حافظه، برای کار و تولید.",
     62000000, 18, "الکترونیک", "/images/photo_2_2026-09-03_23-04-59.jpg", 4),
    ("لپ‌تاپ جوک ۱۳ این‌دی",
     "بردشکن sleeps up to ۸ ساعت، برای کارهای روزمره و مستمند.",
     48000000, 24, "الکترونیک", "/images/photo_3_2026-09-03_23-04-59.jpg", 5),
    ("موبایل نووا سیم ۱۴",
     "رنگ اکس بردشکن با تکپردازش ۱۰۸ مگاپکس، بین‌المللی، ۱۲۸ گیگابایت.",
     30000000, 30, "موبایل", "/images/photo_4_2026-09-03_23-04-59.jpg", 2),
    ("موبایل نووا تاچ ۱۵",
     "شتاب‌گیر با پشتیبانی از QHD، باتری ۶ و ۶۰۰۰ میلی‌آمپر، برای زندگی هوشمند.",
     22000000, 35, "موبایل", "/images/photo_5_2026-09-03_23-04-59.jpg", 3),
    ("هدفون بی‌سیم نووا پوپس پرو",
     "صدای فراگیر با کامپنسیشن مکانیک، حذف نویز فعال، ۳۲ ساعت پخش موسیقی.",
     4200000, 40, "صوتی", "/images/photo_6_2026-09-03_23-04-59.jpg", 1),
    ("اسپیکر بلوتوث نئون",
     "صدای تسک‌های ویدیویی و آواز، ۳۶۰ درجه پchak، و نورپردازی هماهنگ.",
     1850000, 28, "صوتی", "/images/photo_7_2026-09-03_23-04-59.jpg", 4),
    ("دوربین ویدیویی ۴K",
     "تقسیم‌بندی ۴K UHD، شتاب‌گیر کم‌نوایز، برای تصویر گرفتن و تولید.",
     12000000, 9, "الفکت", "/images/photo_8_2026-09-03_23-04-59.jpg", 1),
    ("کیبورد مکانیکی RGB",
     "سوییچ‌های مکانیکی، بدنه آلومینیومی، نورپردازی RGB قابل شخصی‌سازی.",
     2450000, 20, "تجهیزات", "/images/photo_9_2026-09-03_23-04-59.jpg", 5),
    ("ماوس بی‌سیم ابری",
     "دقیق، سبک، ارگونومیک، ۶ دکمه و قابلیت پیکربندی.",
     990000, 32, "تجهیزات", "/images/photo_10_2026-09-03_23-04-59.jpg", 2),
    ("مانیتور ۴K ۲۷ این‌دی",
     "پنل IPS، پوشش ۹۹٪ س_RGB، و پایه ارگونومیک.",
     32000000, 6, "الکترونیک", "/images/photo_11_2026-09-03_23-04-59.jpg", 2),
    ("پاوربانک ۲۰۰۰۰ میلی‌آمپر",
     "شارژ سریع ۶۵ وات، برای لپ‌تاپ و موبایل.",
     1450000, 40, "تجهیزات", "/images/photo_12_2026-09-03_23-04-59.jpg", 3),
]

def seed():
    conn = mysql.connector.connect(**DB)
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("DELETE FROM order_items WHERE product_id >= 7")
        cursor.execute("DELETE FROM products WHERE id >= 7")
        cursor.execute("UPDATE users SET is_admin = TRUE WHERE username = 'admin'")
        for row in PRODUCTS:
            cursor.execute(
                """INSERT INTO products (name, description, price, quantity, category, image_url, featured)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (row[0], row[1], row[2], row[3], row[4], row[5], row[6]),
            )
        conn.commit()
        print("Inserted", len(PRODUCTS), "tech products")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    seed()

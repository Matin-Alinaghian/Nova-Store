
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `price` float NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `quantity`, `price`) VALUES (8,7,24,1,2890000),(9,7,34,1,1450000),(10,8,25,1,2980000),(11,9,25,1,2980000),(18,16,24,1,2890000),(19,17,24,1,2890000),(20,18,25,1,2980000),(21,18,24,1,2890000),(22,18,26,1,2150000);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;


DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `total_price` float NOT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_order_created_at` (`created_at`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` (`id`, `user_id`, `total_price`, `status`, `created_at`) VALUES (1,1,890000,'pending','2026-09-03 20:52:16'),(2,4,2316500,'pending','2026-09-03 20:54:29'),(3,3,1290000,'pending','2026-09-04 14:07:09'),(4,1,926500,'pending','2026-09-04 19:36:53'),(5,1,890000,'pending','2026-09-05 08:04:54'),(6,1,890000,'pending','2026-09-05 08:28:06'),(7,3,4340000,'pending','2026-09-26 16:35:09'),(8,3,2980000,'pending','2026-09-26 16:38:00'),(9,3,2980000,'pending','2026-09-26 16:38:13'),(16,3,2890000,'pending','2026-09-27 17:59:05'),(17,3,2890000,'pending','2026-09-27 17:59:25'),(18,3,8020000,'pending','2026-09-27 18:00:50');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;


DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` float NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `quantity` int DEFAULT '0',
  `category` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `featured` tinyint(1) NOT NULL DEFAULT '0',
  `discount_price` float DEFAULT NULL,
  `use_3d` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_name` (`name`),
  KEY `idx_product_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` (`id`, `name`, `description`, `price`, `image_url`, `quantity`, `category`, `created_at`, `updated_at`, `featured`, `discount_price`, `use_3d`) VALUES (24,'کت تک‌زیپ مشکی کلاسیک مردانه','کت تک‌زیپ مشکی با برش کلاسیک و پارچه نرم پاییزی؛ روی تیشرت مشکی و شلوار پارچه‌ای مشکی با کفش جیر، یک ست کامل مینیمال و رسمی می‌سازد. مناسب محیط کار و مهمانی.',3450000,'/images/photo_1_2026-09-03_23-04-59.jpg',11,'کت و ژاکت','2026-09-26 05:18:32','2026-09-27 18:59:02',1,2890000,1),(25,'کت جین کرم بویفرند مردانه','کت بویفرند کرم استون با یقه جین، دوخت تمیز و فیت راحت؛ ترکیب‌شدنی روی تیشرت مشکی با شلوار پارچه‌ای مشکی و کفش لوفر. انتخاب اول استایل کژوال-اسمارت.',2980000,'/images/photo_2_2026-09-03_23-04-59.jpg',9,'کت و ژاکت','2026-09-26 05:18:32','2026-09-27 18:00:50',4,NULL,1),(26,'ست راحتی پیراهن مشکی و شلوار سفید','ست دو تکه شامل پیراهن آستین‌بلند مشکی و شلوار جوگر سفید نخی؛ به‌همراه کتنی سفید و اکسسوری، یک ست تابستانی راحت و شیک برای دورهمی و گشت‌وگذار.',2450000,'/images/photo_3_2026-09-03_23-04-59.jpg',7,'ست مردانه','2026-09-26 05:18:32','2026-09-27 18:00:50',5,2150000,1),(27,'پیراهن آستین‌بلند مشکی اورسایز','پیراهن آستین‌بلند مشکی با فیت اورسایز و پارچه نخ پنبه‌ای؛ روی تیشرت سفید و شلوار مشکی با کفش اسلیپ‌ان، استایلی مدرن و تمام‌سیاه می‌سازد.',1290000,'/images/photo_4_2026-09-03_23-04-59.jpg',18,'پیراهن و اورشرت','2026-09-26 05:18:32','2026-09-26 15:14:41',2,NULL,1),(28,'کت جین سفید مردانه','کت جین سفید با جیب سینه و دوخت محکم؛ روی پیراهن مشکی و شلوار مشکی باکتنی سفید، کنتراستی تمیز و تابستانی می‌سازد. پارچه جین سبک و قابل‌شست‌وشو.',2650000,'/images/photo_5_2026-09-03_23-04-59.jpg',12,'کت و ژاکت','2026-09-26 05:18:32','2026-09-26 15:14:41',3,2390000,1),(29,'پیراهن قهوه‌ای یقه‌اسکی‌ریس','پیراهن یقه‌اسکی‌ریس (هانلی) قهوه‌ای شکلاتی با پارچه نرم کش‌دار؛ همراه شلوار سفید وکتنی سفید، یک ست گرم و پاییزی با حال‌وهوای مینیمال.',1180000,'/images/photo_6_2026-09-03_23-04-59.jpg',20,'پیراهن و اورشرت','2026-09-26 05:18:32','2026-09-26 15:14:41',1,NULL,1),(30,'کت پشمی زیتونی مخمل‌کبک','کت مخمل‌کبک (کوردوری) زیتونی با جیب‌های بزرگ و دکمه فلزی؛ روی تیشرت مشکی و شلوار مشکی با کفش چرم، استایلی گرم و باکیفیت برای پاییز.',3250000,'/images/photo_7_2026-09-03_23-04-59.jpg',9,'کت و ژاکت','2026-09-26 05:18:32','2026-09-26 15:14:41',4,2870000,1),(31,'اورشرت جین سبز جنگلی','اورشرت جین سبز جنگلی با جیب‌های دوتایی و فیت استاندارد؛ قابل‌استفاده به‌تنهایی یا روی تیشرت مشکی. پارچه جین نرم با رنگ ثابت.',1850000,'/images/photo_8_2026-09-03_23-04-59.jpg',15,'پیراهن و اورشرت','2026-09-26 05:18:32','2026-09-26 15:14:41',1,NULL,1),(32,'کت پشمی قهوه‌ای طرح‌دار','کت شیپورت پشمی قهوه‌ای تیره با بافت طرح‌دار؛ گزینه‌ای لکس و گرم برای پاییز و زمستان. روی شلوار مشکی و کفش چرم، یک ست کامل رسمی-کژوال.',3590000,'/images/photo_9_2026-09-03_23-04-59.jpg',7,'کت و ژاکت','2026-09-26 05:18:32','2026-09-26 15:14:41',5,3150000,1),(33,'اورشرت جین طوسی مردانه','اورشرت جین طوسی روشن با یقه اسپرت و جیب سینه؛ فیت راحت و پارچه سبک مناسب تمام فصول. روی تیشرت مشکی با شلوار مشکی و کتنی سفید بستنی می‌شود.',1780000,'/images/photo_10_2026-09-03_23-04-59.jpg',16,'پیراهن و اورشرت','2026-09-26 05:18:32','2026-09-26 15:14:41',2,NULL,1),(34,'اورشرت مشکی جیب‌دار','اورشرت مشکی با جیب سینه و پارچه نخ ضخیم؛ هم به‌عنوان پیراهن و هم روپوش سبک. ست‌شدنی با تیشرت سفید و شلوار مشکی برای یک استایل تمام‌مشکی تمیز.',1690000,'/images/photo_11_2026-09-03_23-04-59.jpg',17,'پیراهن و اورشرت','2026-09-26 05:18:32','2026-09-26 15:14:41',2,1450000,1),(35,'کت جیر عسلی تک‌زیپ','کت جیر (سوئد) عسلی با زیپ فلزی و یقه ایستاده‌نما؛ لایه‌ی بیرونی ایده‌آل پاییز. روی تیشرت مشکی با شلوار مشکی و لوفر، ست گرم و خوش‌رنگی می‌سازد.',3150000,'/images/photo_12_2026-09-03_23-04-59.jpg',11,'کت و ژاکت','2026-09-26 05:18:32','2026-09-26 15:14:41',3,NULL,1);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;


DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `is_admin` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `username`, `email`, `password`, `is_admin`, `created_at`, `last_login`) VALUES (1,'admin','admin@example.com','scrypt:32768:8:1$3MklI4PESKgVjfSW$6b59896978037a4fe51e1f39815bfcdb80e8d3dcc5dd05f11930cf4bdb672de91ae711b34bd8d5ce6a0814ad7fda7a21406978c19a1899efc21b4ace5979078e',1,'2026-09-02 10:14:11','2026-09-27 18:46:24'),(3,'Matin141312','matinmatin11111385@gmail.com','scrypt:32768:8:1$xjNM3ViL8FlmroYR$a10f11ab56213d25044c4bf9b43d1174a03b16b91f1ff6062c58483cbc854dbb8e0dfe6b7b1c61b28d1af1e19bfbf8b8a3839bbf651c0474ae2b0ce4e23e3998',0,'2026-09-03 19:41:04','2026-09-27 19:09:06'),(4,'matin','matinalinghian@gmail.com','scrypt:32768:8:1$XNhyIWp7nTkD2Fb8$70c61f96677f17f9804424f4f95cbac48151717ff774fe92375f275885f805b175c55e1f3b51d4d0b9ff4ed3a697941852ec542bca27d253ceb1bec07b744917',0,'2026-09-03 20:53:22','2026-09-03 20:53:44'),(9,'متین','mat11111385@gmail.com','scrypt:32768:8:1$0xWk7YbNswtK8Gl9$a984e137faa512baea712c7648c3b141ad42db3924f2057c4a6f80587bc6b8837bc25bba7f6a36e286473b9f345c5178a7555668aba40b83c0265bccfc97b947',0,'2026-09-27 18:04:27','2026-09-27 18:04:48');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

SET NAMES utf8mb4;

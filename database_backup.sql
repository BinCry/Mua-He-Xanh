-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: binhloi_tourism
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `analytics`
--

DROP TABLE IF EXISTS `analytics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `analytics` (
  `id` varchar(36) NOT NULL,
  `session_id` varchar(36) DEFAULT NULL,
  `event` varchar(100) NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `analytics_event` (`event`),
  KEY `analytics_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `analytics`
--

LOCK TABLES `analytics` WRITE;
/*!40000 ALTER TABLE `analytics` DISABLE KEYS */;
INSERT INTO `analytics` VALUES ('11a76d55-e18e-48f6-a786-419ea48f0385','4291f409-d3e0-4abf-93ce-00302545f07a','journey_start_intent','{}','2026-05-03 02:45:02','2026-05-03 02:45:02'),('66b3888b-8a88-4386-92fc-9ef07a985979','90a37ab8-ddc3-4ac7-9f75-6db1aeb8626f','journey_start_intent','{}','2026-05-03 02:49:47','2026-05-03 02:49:47');
/*!40000 ALTER TABLE `analytics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `badges`
--

DROP TABLE IF EXISTS `badges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `badges` (
  `id` varchar(36) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `icon` varchar(10) NOT NULL,
  `mood` varchar(50) NOT NULL,
  `points` int(11) DEFAULT 0,
  `condition` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`condition`)),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `badges`
--

LOCK TABLES `badges` WRITE;
/*!40000 ALTER TABLE `badges` DISABLE KEYS */;
INSERT INTO `badges` VALUES ('1a6436a9-2f7b-4a77-bda2-a18e95e7e291','ke-lang-thang-xanh','Kẻ Lang Thang Xanh','Hoàn thành hành trình đầu tiên tại Bình Lợi','🎒','all',30,'{\"type\":\"first_journey_complete\"}','2026-05-02 20:28:27','2026-05-02 20:28:27'),('293e68c6-c107-4dbb-a08d-8203bb508b5e','nguoi-binh-loi','Người Bình Lợi','Tích lũy đủ 100 điểm trải nghiệm','⭐','all',100,'{\"type\":\"total_points\",\"min_points\":100}','2026-05-02 20:28:27','2026-05-02 20:28:27'),('388353df-9c97-4f74-a51a-7fc25638b8d8','tinh-than-tu-do','Tinh Thần Tự Do','Hoàn thành hành trình \"Tự Do\" với điểm bất ngờ','🎲','tu_do',40,'{\"type\":\"complete_mood_journey\",\"mood\":\"tu_do\"}','2026-05-02 20:28:27','2026-05-02 20:28:27'),('81169f5d-e7f4-4c9d-b588-14921c652637','nguoi-ket-noi-cong-dong','Người Kết Nối Cộng Đồng','Trải nghiệm cả làng nghề và sinh thái trong cùng một hành trình','🤝','ket_noi',70,'{\"type\":\"multi_type_journey\",\"types\":[\"craft\",\"nature\"]}','2026-05-02 20:28:27','2026-05-02 20:28:27'),('9bdd3907-5a95-46d7-841e-08209539062e','tho-san-khoang-khac','Thợ Săn Khoảnh Khắc','Check-in tại 3 điểm trong cùng một ngày','📸','kham_pha',60,'{\"type\":\"checkins_same_day\",\"count\":3}','2026-05-02 20:28:27','2026-05-02 20:28:27'),('e82f905f-a55a-427c-be0e-1fdd2f4f5e64','nguoi-tim-an-yen','Người Tìm An Yên','Đã ghé thăm ít nhất 2 ngôi chùa trong một hành trình','🌿','an_nhien',50,'{\"type\":\"destination_type_count\",\"dest_type\":\"temple\",\"min_count\":2}','2026-05-02 20:28:27','2026-05-02 20:28:27');
/*!40000 ALTER TABLE `badges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `check_ins`
--

DROP TABLE IF EXISTS `check_ins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `check_ins` (
  `id` varchar(36) NOT NULL,
  `session_id` varchar(36) NOT NULL,
  `stop_id` varchar(36) NOT NULL,
  `destination_id` varchar(36) NOT NULL,
  `checkin_method` enum('qr','manual') NOT NULL,
  `user_lat` decimal(10,7) DEFAULT NULL,
  `user_lng` decimal(10,7) DEFAULT NULL,
  `distance_meter` int(11) DEFAULT NULL,
  `points_earned` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `destination_id` (`destination_id`),
  KEY `check_ins_session_id` (`session_id`),
  KEY `check_ins_stop_id` (`stop_id`),
  CONSTRAINT `check_ins_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `user_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `check_ins_ibfk_2` FOREIGN KEY (`stop_id`) REFERENCES `journey_stops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `check_ins_ibfk_3` FOREIGN KEY (`destination_id`) REFERENCES `destinations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `check_ins`
--

LOCK TABLES `check_ins` WRITE;
/*!40000 ALTER TABLE `check_ins` DISABLE KEYS */;
/*!40000 ALTER TABLE `check_ins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `destinations`
--

DROP TABLE IF EXISTS `destinations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `destinations` (
  `id` varchar(36) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `short_desc` varchar(300) NOT NULL,
  `type` enum('temple','park','craft','nature') NOT NULL,
  `moods` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`moods`)),
  `seasons` varchar(255) DEFAULT NULL,
  `open_hours` varchar(200) NOT NULL,
  `cost` varchar(300) NOT NULL,
  `stay_capacity` enum('overnight','noon_rest','none') NOT NULL,
  `highlight` varchar(500) NOT NULL,
  `checkin_tip` varchar(500) NOT NULL,
  `best_time` varchar(200) NOT NULL,
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `map_x` float NOT NULL,
  `map_y` float NOT NULL,
  `radius_meter` int(11) DEFAULT 200,
  `cover_image` varchar(500) DEFAULT NULL,
  `audio_url` varchar(500) DEFAULT NULL,
  `video_url` varchar(500) DEFAULT NULL,
  `story` text NOT NULL,
  `zen_walk_desc` varchar(500) DEFAULT NULL,
  `qr_code_url` varchar(500) DEFAULT NULL,
  `qr_secret` varchar(100) NOT NULL,
  `points` int(11) DEFAULT 20,
  `is_hub` tinyint(4) DEFAULT 0,
  `is_active` tinyint(4) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `destinations_slug` (`slug`),
  KEY `destinations_type` (`type`),
  KEY `destinations_is_hub` (`is_hub`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `destinations`
--

LOCK TABLES `destinations` WRITE;
/*!40000 ALTER TABLE `destinations` DISABLE KEYS */;
INSERT INTO `destinations` VALUES ('0b57e070-85fa-4edd-8abe-c42cf75c15e5','chua-phap-tang','Chùa Pháp Tạng','Ngôi chùa mang kiến trúc Phật giáo thanh tịnh, không gian tâm linh bình an giữa thiên nhiên','Bình an trong từng hơi thở','temple','[\"an_nhien\"]',NULL,'06:00 - 19:00','Mi?n phí','noon_rest','Vườn tượng Phật đa dạng, các khóa tu thiền định và hoạt động tặng thuốc nam miễn phí.','Ki?n trúc c?ng tam quan r?t ð?p ð? ch?p ?nh lýu ni?m.','Bu?i sáng s?m khi sýõng c?n ð?ng trên cây lá trong khuôn viên chùa.',10.7350000,106.5770000,65,22,120,'public/images/hero-3.png',NULL,NULL,'Chùa Pháp Tạng là một địa chỉ tâm linh nổi tiếng với các hoạt động thiện nguyện và khuyên dạy về lối sống đạo đức. Ngôi chùa có khuôn viên rộng rãi, nhiều cây xanh, tạo điều kiện thuận lợi cho việc tu tập và tham quan.','Thực hành thiền hành trong khuân viên vườn tượng, quán chiếu về sự vô thường và lòng từ bi qua từng bước đi.',NULL,'CPT_2024_SECURE',20,0,1,6,'2026-05-02 20:28:27','2026-05-05 15:05:11'),('102f207d-e6d5-40f9-acff-f7eada6eb0ab','xuong-nhang-minh','Xưởng Nhang Minh','Làng nghề làm nhang truyền thống lâu đời – lưu giữ hương thơm và ký ức bao đời người Bình Lợi','Hương thơm truyền đời','craft','[\"kham_pha\",\"ket_noi\",\"tu_do\"]','winter_spring,summer,autumn_winter','08:00 - 17:00','Mi?n phí tham quan','none','Sân phơi nhang rực rỡ sắc đỏ tím, mùi hương thảo mộc tự nhiên thư giãn.','Nh?ng bó nhang ðý?c phõi x?e tr?n nhý nh?ng ðóa hoa r?t ð?p m?t.','Sáng n?ng ð? th?y c?nh phõi nhang r?c r? nh?t.',10.7370000,106.5780000,80,45,100,'public/images/card-craft.png',NULL,NULL,'Nghề làm nhang tại Xưởng Nhang Minh là một nét đẹp lao động truyền thống được gìn giữ qua nhiều thế hệ. Mỗi cây nhang được làm ra là sự kết hợp của bột thảo mộc, tăm tre và đôi bàn tay khéo léo. Mùi hương trầm ấm lan tỏa khắp không gian tạo nên một cảm giác hoài cổ.','Quan sát đôi tay thoăn thoắt của người thợ, cảm nhận sự tập trung và chánh niệm trong từng hành động nhỏ nhất.',NULL,'XNM_2024_SECURE',25,0,1,4,'2026-05-02 20:28:27','2026-05-05 15:05:11'),('737a0c5c-8cdb-4691-b373-c923d88472f2','vuon-dua','Vườn Dừa Bình Lợi','Vườn dừa xanh mát ven kênh rạch – không gian miền Tây giữa lòng vùng ven đô Sài Gòn','Mát lòng bóng dừa xanh','nature','[\"ket_noi\",\"an_nhien\",\"tu_do\"]','summer','07:00 - 18:00','Giá d?a t?i vý?n','noon_rest','Thưởng thức nước dừa xiêm ngọt lịm ngay tại gốc, chèo xuồng ba lá dọc theo con kênh nhỏ.','Ch?p ?nh bên g?c d?a nghiêng ho?c trên nh?ng cây c?u kh? nh? xinh.','Bu?i chi?u mát ð? t?n hý?ng gió sông.',10.7300000,106.5730000,45,68,150,'public/images/card-ecology.png',NULL,NULL,'Vườn Dừa Bình Lợi mang đến một không gian đậm chất miền Tây ngay giữa lòng Bình Chánh. Những hàng dừa nghiêng bóng bên dòng kênh xanh mát là nơi lý tưởng để xua tan cái nắng nóng và sự ồn ào của phố thị.','Bước đi trên con đường đất ven kênh, cảm nhận làn gió mát rượi từ sông thổi vào, để tâm hồn dịu lại như dòng nước trôi.',NULL,'VD_2024_SECURE',20,0,1,5,'2026-05-02 20:28:27','2026-05-05 15:05:11'),('8f4bb658-59bb-4a0d-94f6-c7ce9e1e21ba','lang-mai-vang','Làng Mai Vàng Bình Lợi','Vườn mai vàng rực rỡ hàng trăm gốc – biểu tượng Tết truyền thống của vùng đất Bình Lợi','Vàng ươm trời xuân','nature','[\"kham_pha\",\"ket_noi\"]','winter_spring','T? do','Tùy vý?n (thý?ng mi?n phí tham quan)','noon_rest','Cánh đồng mai bạt ngàn rực rỡ sắc vàng vào tháng chạp, trải nghiệm kỹ thuật lặt lá mai cùng nông dân.','Tháng 12 âm l?ch là th?i ði?m mai n? ð?p nh?t ð? ch?p ?nh.','Tháng 12 - Tháng 1 (Âm l?ch)',10.7360000,106.5760000,70,30,200,'public/images/card-culture.png',NULL,NULL,'Làng Mai Vàng Bình Lợi là niềm tự hào của nông dân địa phương. Với hàng trăm hecta đất trồng mai, đây là nguồn cung cấp mai vàng lớn nhất cho TP.HCM mỗi dịp Tết. Nghề trồng mai đòi hỏi sự kiên nhẫn, tỉ mỉ và tình yêu đối với cây cỏ.','Dạo bước giữa những hàng mai thẳng tắp, cảm nhận sức sống mãnh liệt của thiên nhiên đang chờ đợi ngày bung nở.',NULL,'LMV_2024_SECURE',30,0,1,3,'2026-05-02 20:28:27','2026-05-05 15:05:11'),('a68078c2-4f5a-4355-b841-4efd8481d204','chua-thanh-tam','Chùa Thanh Tâm','Ngôi chùa cổ kính mang đậm không gian văn hóa – tâm linh Nam Bộ truyền thống','Tĩnh lặng giữa lòng xanh','temple','[\"an_nhien\"]','winter_spring,summer,autumn_winter','06:00 - 20:00','Mi?n phí','noon_rest','Tượng Phật Thích Ca Mâu Ni cao 7m uy nghiêm giữa không gian tĩnh lặng, kiến trúc mái đình cong vút đặc trưng.','Gi? yên l?ng và m?c trang ph?c l?ch s? khi tham quan.','Ngày r?m ho?c ð?u tháng âm l?ch.',10.7340000,106.5740000,25,35,150,'public/images/hero-2.png',NULL,NULL,'Chùa Thanh Tâm, còn được biết đến với tên gọi Bát Bửu Phật Đài hay Phật Cô Đơn, là một biểu tượng tâm linh mạnh mẽ. Ngôi chùa đã đứng vững qua những năm tháng chiến tranh khốc liệt, mang lại sự an ủi và niềm tin cho biết bao thế hệ. Kiến trúc ngôi chùa mang đậm nét cổ kính, thanh tịnh.','Đi vòng quanh chánh điện, mỗi bước chân là một lời cầu nguyện bình an. Hãy để tâm trí lắng xuống theo tiếng chuông chùa xa xăm.',NULL,'CTT_2024_SECURE',20,0,1,2,'2026-05-02 20:28:27','2026-05-05 15:05:11'),('f88a8ae1-98c1-4467-8d7f-38ce88bf29ce','cong-vien-lang-le','Công viên Văn hóa Láng Le','Không gian công cộng xanh rộng lớn – trái tim và điểm xuất phát của mọi hành trình khám phá Bình Lợi','Trái tim xanh của Bình Lợi','park','[\"an_nhien\",\"ket_noi\",\"kham_pha\",\"tu_do\"]','winter_spring,summer,autumn_winter','05:00 - 21:00','Miễn phí','noon_rest','Hệ thống hồ nước điều tiết tự nhiên, tượng đài chiến thắng uy nghiêm và khu vui chơi cộng đồng sôi động.','Nên chụp ảnh tại đài tưởng niệm vào sáng sớm để có ánh sáng đẹp nhất.','5:00 - 9:00 hoặc 16:00 - 18:00',10.7295000,106.5692000,50,50,300,'public/images/hero-1.png',NULL,NULL,'Công viên Văn hóa Láng Le - Bàu Cò không chỉ là một lá phổi xanh mà còn là chứng nhân lịch sử hào hùng của cuộc kháng chiến chống Pháp. Nơi đây từng là căn cứ địa quan trọng của quân và dân ta. Ngày nay, công viên là trung tâm văn hóa, nơi người dân tìm về để hít thở không khí trong lành và tưởng nhớ những người anh hùng.','Hãy bắt đầu từ cổng chính, đi chậm rãi quanh bờ hồ lớn. Lắng nghe tiếng gió xào xạc qua tán lá và cảm nhận bước chân chạm nhẹ lên mặt đất.',NULL,'CVLL_2024_SECURE',15,1,1,1,'2026-05-02 20:28:27','2026-05-05 15:05:11');
/*!40000 ALTER TABLE `destinations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journey_stops`
--

DROP TABLE IF EXISTS `journey_stops`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `journey_stops` (
  `id` varchar(36) NOT NULL,
  `journey_id` varchar(36) NOT NULL,
  `destination_id` varchar(36) NOT NULL,
  `stop_order` int(11) NOT NULL,
  `is_completed` tinyint(4) DEFAULT 0,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `destination_id` (`destination_id`),
  KEY `journey_stops_journey_id` (`journey_id`),
  CONSTRAINT `journey_stops_ibfk_1` FOREIGN KEY (`journey_id`) REFERENCES `journeys` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `journey_stops_ibfk_2` FOREIGN KEY (`destination_id`) REFERENCES `destinations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journey_stops`
--

LOCK TABLES `journey_stops` WRITE;
/*!40000 ALTER TABLE `journey_stops` DISABLE KEYS */;
INSERT INTO `journey_stops` VALUES ('05acf63d-f636-4f8a-9d1d-3519001f10f7','1b8013db-3ed3-4a05-9b21-e665a50282bf','f88a8ae1-98c1-4467-8d7f-38ce88bf29ce',0,0,NULL,'2026-05-03 18:09:45','2026-05-03 18:09:45'),('1812c58b-4947-4464-9539-693cf423321f','1b8013db-3ed3-4a05-9b21-e665a50282bf','737a0c5c-8cdb-4691-b373-c923d88472f2',1,0,NULL,'2026-05-03 18:09:45','2026-05-03 18:09:45'),('23834908-d5bb-4642-a687-1274ecce12a4','573b1166-ee7f-4060-a3ab-7ab138851a3c','f88a8ae1-98c1-4467-8d7f-38ce88bf29ce',0,0,NULL,'2026-05-03 21:36:25','2026-05-03 21:36:25'),('2ac9c2af-cd60-47d7-b2f3-bb03709e8f2a','d4480b27-36fb-4d7c-afc8-52e115d5f691','f88a8ae1-98c1-4467-8d7f-38ce88bf29ce',0,0,NULL,'2026-05-03 21:10:40','2026-05-03 21:10:40'),('61e41f89-bacf-437d-a336-a4292037b9bf','1ff51524-2eb2-4d2d-938d-b7d8fbafda3c','737a0c5c-8cdb-4691-b373-c923d88472f2',1,0,NULL,'2026-05-03 18:10:11','2026-05-03 18:10:11'),('676d8064-db30-4722-ae05-05b2d4aff5da','1b8013db-3ed3-4a05-9b21-e665a50282bf','0b57e070-85fa-4edd-8abe-c42cf75c15e5',3,0,NULL,'2026-05-03 18:09:45','2026-05-03 18:09:45'),('75f6cfab-8c96-4e52-8d7d-535153c3e141','1ff51524-2eb2-4d2d-938d-b7d8fbafda3c','f88a8ae1-98c1-4467-8d7f-38ce88bf29ce',0,0,NULL,'2026-05-03 18:10:11','2026-05-03 18:10:11'),('82c206a7-63d6-4a7f-8025-057461d46559','d4480b27-36fb-4d7c-afc8-52e115d5f691','a68078c2-4f5a-4355-b841-4efd8481d204',2,0,NULL,'2026-05-03 21:10:40','2026-05-03 21:10:40'),('92828ab9-0826-42a5-b13d-06dbba51e90f','d4480b27-36fb-4d7c-afc8-52e115d5f691','737a0c5c-8cdb-4691-b373-c923d88472f2',1,0,NULL,'2026-05-03 21:10:40','2026-05-03 21:10:40'),('95514819-ca4a-497c-8bce-5e2d7806b66b','1ff51524-2eb2-4d2d-938d-b7d8fbafda3c','102f207d-e6d5-40f9-acff-f7eada6eb0ab',2,0,NULL,'2026-05-03 18:10:11','2026-05-03 18:10:11'),('f8c8c9c3-0179-4957-a483-39b715ae3641','1b8013db-3ed3-4a05-9b21-e665a50282bf','a68078c2-4f5a-4355-b841-4efd8481d204',2,0,NULL,'2026-05-03 18:09:45','2026-05-03 18:09:45');
/*!40000 ALTER TABLE `journey_stops` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journeys`
--

DROP TABLE IF EXISTS `journeys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `journeys` (
  `id` varchar(36) NOT NULL,
  `session_id` varchar(36) NOT NULL,
  `mood` varchar(50) NOT NULL,
  `duration` varchar(50) DEFAULT NULL,
  `interests` text DEFAULT NULL,
  `total_km` decimal(5,2) DEFAULT 0.00,
  `total_minutes` int(11) DEFAULT 0,
  `status` enum('active','completed','abandoned') DEFAULT 'active',
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `journeys_session_id` (`session_id`),
  CONSTRAINT `journeys_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `user_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journeys`
--

LOCK TABLES `journeys` WRITE;
/*!40000 ALTER TABLE `journeys` DISABLE KEYS */;
INSERT INTO `journeys` VALUES ('1b8013db-3ed3-4a05-9b21-e665a50282bf','a88acc03-60f2-43dc-84b1-77b08bfcc08d','an_nhien',NULL,NULL,1.22,138,'active',NULL,'2026-05-03 18:09:45','2026-05-03 18:09:45'),('1ff51524-2eb2-4d2d-938d-b7d8fbafda3c','23e90957-4250-42c1-9249-da7af34618f4','ket_noi',NULL,NULL,1.37,111,'active',NULL,'2026-05-03 18:10:11','2026-05-03 18:10:11'),('573b1166-ee7f-4060-a3ab-7ab138851a3c','921e805b-5c73-482b-8306-486e4d387801','an-nhien','half','[\"temple\",\"craft\"]',0.00,45,'active',NULL,'2026-05-03 21:36:25','2026-05-03 21:36:25'),('d4480b27-36fb-4d7c-afc8-52e115d5f691','f11f6184-d6f6-44e2-97b2-9bf8e74e8028','an-nhien',NULL,NULL,0.88,148,'active',NULL,'2026-05-03 21:10:40','2026-05-03 21:10:40');
/*!40000 ALTER TABLE `journeys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sequelizemeta`
--

DROP TABLE IF EXISTS `sequelizemeta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sequelizemeta` (
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sequelizemeta`
--

LOCK TABLES `sequelizemeta` WRITE;
/*!40000 ALTER TABLE `sequelizemeta` DISABLE KEYS */;
INSERT INTO `sequelizemeta` VALUES ('20240101000000-create-all-tables.js');
/*!40000 ALTER TABLE `sequelizemeta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_badges`
--

DROP TABLE IF EXISTS `user_badges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_badges` (
  `id` varchar(36) NOT NULL,
  `session_id` varchar(36) NOT NULL,
  `badge_id` varchar(36) NOT NULL,
  `unlocked_at` datetime DEFAULT current_timestamp(),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `badge_id` (`badge_id`),
  KEY `user_badges_session_id` (`session_id`),
  CONSTRAINT `user_badges_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `user_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_badges_ibfk_2` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_badges`
--

LOCK TABLES `user_badges` WRITE;
/*!40000 ALTER TABLE `user_badges` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_badges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_sessions` (
  `id` varchar(36) NOT NULL,
  `uuid` varchar(36) NOT NULL,
  `current_mood` varchar(50) DEFAULT NULL,
  `total_points` int(11) DEFAULT 0,
  `ip_address` varchar(50) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `mood` varchar(50) DEFAULT NULL,
  `duration` varchar(20) DEFAULT NULL,
  `interests` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
INSERT INTO `user_sessions` VALUES ('05c8ee78-37ea-4fb3-a82a-564b5e697c5c','9152ff98-3760-41aa-9bae-405d8e07f8cf',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 15:32:43','2026-05-03 15:32:43',NULL,NULL,NULL),('08a0afa1-6d98-4a2b-8fbe-b9c7c1780559','6a56f2f0-af11-4ccf-9222-9b91b2813ccf',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 17:59:12','2026-05-03 17:59:12',NULL,NULL,NULL),('0ba9dabc-1904-4c73-8fce-42cb18eb0aab','0458e2bb-7b55-4932-8ef0-ff92c14b8e59',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:34:35','2026-05-03 18:34:35',NULL,NULL,NULL),('12cbd327-7b12-4a4e-b454-88f7031883e3','dd07bf48-ad8d-4ad4-b52a-44573f40acd5',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:49:21','2026-05-03 18:49:21',NULL,NULL,NULL),('158df5a8-8219-4f32-99f1-779bde830387','613694df-e9b4-444d-88b1-46ed1200258e',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:47:05','2026-05-03 18:47:05',NULL,NULL,NULL),('17b72137-d871-453a-9cdd-bfd29005cd6c','309a3e0c-ceb0-4e7d-accb-e2d753108c66',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:46:50','2026-05-03 18:46:50',NULL,NULL,NULL),('23e90957-4250-42c1-9249-da7af34618f4','16ac4a56-53b2-43e2-bdcd-1685ae0b0278',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:09:45','2026-05-03 18:09:45',NULL,NULL,NULL),('24d724fb-b985-484c-8ded-3a4b6640a651','1afad4c1-133f-48ce-b52f-d01e5a12ee71',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 15:33:15','2026-05-03 15:33:15',NULL,NULL,NULL),('290b3372-e1c1-45d7-8a77-d88502c63943','a4edfee5-7917-40ea-9321-d8e547e95f9a',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:26:37','2026-05-03 18:26:37',NULL,NULL,NULL),('2ac6119b-c9d3-4a2b-9b1b-4e65b5b11f17','78c0bec4-c78d-470d-bb71-7321e31f3bbd',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:48:59','2026-05-03 18:48:59',NULL,NULL,NULL),('2f01928f-92d7-4ffd-90a5-cea45e0fc132','00be7d06-1af0-494c-b121-c76bc9769552',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 15:32:39','2026-05-03 15:32:39',NULL,NULL,NULL),('2f47262f-0321-42aa-b66a-d5e7ce9909c8','4291f409-d3e0-4abf-93ce-00302545f07a',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 02:45:02','2026-05-03 02:45:02',NULL,NULL,NULL),('35811ea4-b96c-4ee2-a7bb-e12338a8c4f8','d7ee4dc9-8048-4c69-8cec-7684d1aec393',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:35:25','2026-05-03 18:35:25',NULL,NULL,NULL),('3584c2e3-45d9-4698-af50-d9e07b8ea795','df2edbad-4ca0-4de8-81c2-ec7542b4167e',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 17:41:14','2026-05-03 17:41:14',NULL,NULL,NULL),('3706e50a-aede-4c46-b0d2-62d549fd8772','45a135dc-d589-49d7-809e-1dfce397cfb0',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:04:32','2026-05-03 18:04:32',NULL,NULL,NULL),('39cd7b40-8847-4034-9d42-fe8ab6dd0247','fab5fdfe-8f26-485f-b9e9-16fc26bc917b',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:28:11','2026-05-03 18:28:11',NULL,NULL,NULL),('3ce72425-f326-4300-b90e-994a51261daa','d7295aa7-8fab-4915-8f19-f9e7b4bb1722',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:33:28','2026-05-03 18:33:28',NULL,NULL,NULL),('3d3a7f70-149e-4482-9706-83d3c1a8fa07','280c93d2-1bd8-40ba-a00c-a523a3f730d8',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:47:22','2026-05-03 18:47:22',NULL,NULL,NULL),('405b2c60-ec03-4f6f-a54e-0114701d06c0','9f5228fd-e0b1-496f-9364-128962f71930',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:10:24','2026-05-03 18:10:24',NULL,NULL,NULL),('42435d79-c55c-4ed6-af81-7ccede9813bb','14361495-1f97-406f-95ea-a1bbeeaf10a8',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:27:23','2026-05-03 18:27:23',NULL,NULL,NULL),('4442bd48-ca72-4532-97c5-d221c66e8200','39e37988-7a96-4ec9-b9df-8a613f84eee2',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:05:29','2026-05-03 18:05:29',NULL,NULL,NULL),('44c4b403-e8bc-4c08-8873-753934a6055c','e2a9b44e-b8c3-4649-963b-0549675c7440',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 17:56:46','2026-05-03 17:56:46',NULL,NULL,NULL),('539825ad-100c-4b4a-840f-4f10910ce8db','99369453-15fc-40b6-b176-034c567ff031',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:20:02','2026-05-03 18:20:02',NULL,NULL,NULL),('5ab515fd-9242-456c-9fc5-6819d0e6a988','c1a8ab38-c4ef-42dc-83a0-09b49d86adb4',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 15:43:58','2026-05-03 15:43:58',NULL,NULL,NULL),('5bfb5547-2105-4f4c-91bb-5ae303a441be','b71a5503-990b-4925-b476-8a1f46d1d4af',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:28:29','2026-05-03 18:28:29',NULL,NULL,NULL),('68f5b446-cec9-49b8-a751-c0edc083c63b','ee59b4f4-8a34-46f5-8a1d-bed30a70dc81',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:07:52','2026-05-03 18:07:52',NULL,NULL,NULL),('741cc239-7ab9-4e1f-9d29-9c4d450c0922','d03cb7f9-5f47-42a4-b938-96747bba58b7',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:46:33','2026-05-03 18:46:33',NULL,NULL,NULL),('7635438d-db4d-4dfa-8d45-388eb876e514','250ef6b4-5332-4ce5-88ce-dd7558cb53d2',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 17:45:30','2026-05-03 17:45:30',NULL,NULL,NULL),('76f20561-c0f2-48c7-aed8-7d3d90352516','74449c77-5cc0-4b11-a93b-b4ffca07349d',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:33:51','2026-05-03 18:33:51',NULL,NULL,NULL),('7c4391fb-c785-41a8-8b01-10480fbcbcf5','e2f8aa54-046e-4849-9ed1-8a920c6fbb38',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:48:45','2026-05-03 18:48:45',NULL,NULL,NULL),('7c455e7f-4dee-47ee-8d43-7a7b01a45b20','600fbf7b-5a00-4e73-b9ed-38411f4d8f33',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:08:30','2026-05-03 18:08:30',NULL,NULL,NULL),('7f4be005-5e2a-4edb-95af-4b5168d43757','3650a388-a827-48c9-930b-179cce77b535',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:48:23','2026-05-03 18:48:23',NULL,NULL,NULL),('84deb9a3-bda4-4a73-b322-85e39eabc939','307b7617-96d0-47f0-944a-42b464e1c2db',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 17:40:40','2026-05-03 17:40:40',NULL,NULL,NULL),('8991cb11-4266-42a1-8e9e-55c7bcbb7701','01f1ebb8-142d-4215-a5ee-69bc61d720d9',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:49:35','2026-05-03 18:49:35',NULL,NULL,NULL),('8fb0434f-01b9-48f4-9e5e-50a38973dd50','963aad03-3863-4480-bc39-56dc5f742a8d',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:20:46','2026-05-03 18:20:46',NULL,NULL,NULL),('921e805b-5c73-482b-8306-486e4d387801','7eab4edc-7882-4cd0-a402-4c26df0f1553',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0','2026-05-03 19:01:59','2026-05-03 21:03:59','an-nhien','half','[\"temple\",\"craft\"]'),('9394551e-19bd-404f-849e-db31f046d3c1','0d9b1bdc-4238-4e8f-b597-f2a8b5cc700d',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:49:09','2026-05-03 18:49:09',NULL,NULL,NULL),('9c2cb772-adef-491a-b718-e1cc989ed59e','78ba44ab-29dc-4d24-a1c0-31915a2a88d6',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:27:37','2026-05-03 18:27:37',NULL,NULL,NULL),('9d14be8e-fa87-4727-84e4-4f6e6346fa98','c44f9906-3776-4141-bf64-5d721a409069',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:34:47','2026-05-03 18:34:47',NULL,NULL,NULL),('a1d052a8-ae22-4aec-a32c-fd62d536fb88','e8f3f4cb-2162-4f07-ae2f-8ea53cad6b3f',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:49:49','2026-05-03 18:49:49',NULL,NULL,NULL),('a2963b94-dd94-4330-8d62-5580dbbe6507','1e3139b7-52b6-4b75-814e-e7fec6a659f5',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:10:12','2026-05-03 18:10:12',NULL,NULL,NULL),('a7873688-60ae-4748-9c80-93ba184ee642','fe8f2104-c364-4ff8-be7c-570e8030438b',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:09:09','2026-05-03 18:09:09',NULL,NULL,NULL),('a8132e3d-6512-4e05-83b3-aa7a839a198d','5ae56518-f4ac-4752-be58-05bda3377428',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:09:18','2026-05-03 18:09:18',NULL,NULL,NULL),('a88acc03-60f2-43dc-84b1-77b08bfcc08d','17417c39-16ee-4f30-bf94-47eac8a073f0',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:09:26','2026-05-03 18:09:26',NULL,NULL,NULL),('a8d3b2c3-fe2d-4d19-b83f-db511610ee83','a4144783-cc55-4427-bce3-f7be51c6ecc0',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:05:06','2026-05-03 18:05:06',NULL,NULL,NULL),('b81ebcd0-1228-42c6-ad55-ac990996293a','64f93953-ca71-44bd-8622-ac08ca7a77d3',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:47:33','2026-05-03 18:47:33',NULL,NULL,NULL),('bc96a803-6c67-4a34-a9e5-cec2fa3d448b','3eebcb41-1513-4b92-9ba1-d61d62ba2032',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:45:58','2026-05-03 18:45:58',NULL,NULL,NULL),('c57df173-d576-4e05-a296-3f4d6c80abaf','a7a55df8-b90f-4b39-8caa-6db332c5fc24',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:28:50','2026-05-03 18:28:50',NULL,NULL,NULL),('c5f83746-2547-47b6-94f7-9223aa171f54','55285d8e-4435-4ad8-94de-04e3f77bd2f4',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 15:31:10','2026-05-03 15:31:10',NULL,NULL,NULL),('c9352817-9c35-478a-a5d6-8a39bebc7ce0','ea6a3e76-cf81-492a-bcd3-7595dd8ee4eb',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:48:33','2026-05-03 18:48:33',NULL,NULL,NULL),('cd86cbb5-4803-4201-9fd1-e2506458dcc0','e8dc176b-2593-4bb4-aab6-a435c5915327',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:35:51','2026-05-03 18:35:51',NULL,NULL,NULL),('d7782d7d-aee9-43b6-8bb4-a529b5aa207f','2f1fa65e-a8e6-42f9-8e7d-73e47ccc70d8',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 17:47:02','2026-05-03 17:47:02',NULL,NULL,NULL),('d81555b5-4ebc-4c56-9b98-ec20f27a0a66','5a07a6c3-5380-4873-b700-af0345b41bbb',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 17:58:58','2026-05-03 17:58:58',NULL,NULL,NULL),('d8587371-d8fc-4dc4-9f0c-0a0ad7a53d07','03c321fb-d3e5-49f1-9e47-6702ff20c4c5',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:33:39','2026-05-03 18:33:39',NULL,NULL,NULL),('dc960598-5da8-490b-a844-4b37aff53ce4','1581bef7-e872-4815-acb8-a13429397501',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:08:20','2026-05-03 18:08:20',NULL,NULL,NULL),('dd5acf0f-234f-4164-b836-32fed6cfbab4','b6540ca1-21d1-4918-9eb9-66ed7e0aefd6',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:22:07','2026-05-03 18:22:07',NULL,NULL,NULL),('f0faba28-5f8d-4453-908a-ea4faf3396fa','096e6619-dc5d-4ed4-9822-2de5c22e913c',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 18:35:34','2026-05-03 18:35:34',NULL,NULL,NULL),('f11f6184-d6f6-44e2-97b2-9bf8e74e8028','90a37ab8-ddc3-4ac7-9f75-6db1aeb8626f',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 02:49:47','2026-05-03 22:21:58',NULL,NULL,NULL),('fbc8f7c1-0e06-4085-be4c-7708d1d6d713','b643e4bc-eb44-4406-ab01-ed8ed35f92de',NULL,0,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-03 15:31:52','2026-05-03 15:31:52',NULL,NULL,NULL);
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-05 21:46:06

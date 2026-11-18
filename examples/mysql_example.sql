-- ==============================================================================
--  EXAMPLE MYSQL / MARIADB DATABASE: E-COMMERCE & ENTERPRISE MANAGEMENT
--  Compatible with MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Reset existing tables
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `product_categories`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `departments`;
DROP TABLE IF EXISTS `customers`;

SET FOREIGN_KEY_CHECKS = 1;

-- 2. Create Schema
CREATE TABLE `departments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `code` VARCHAR(20) NOT NULL UNIQUE,
    `budget` DECIMAL(14, 2) DEFAULT 0.00,
    `location` VARCHAR(100),
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `employees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `department_id` INT NULL,
    `first_name` VARCHAR(60) NOT NULL,
    `last_name` VARCHAR(60) NOT NULL,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `position` VARCHAR(80),
    `salary` DECIMAL(12, 2) NOT NULL,
    `hire_date` DATE NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_emp_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `customers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `phone` VARCHAR(30),
    `city` VARCHAR(80),
    `country` VARCHAR(80) DEFAULT 'Indonesia',
    `preferences` JSON,
    `is_vip` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `product_categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(80) NOT NULL UNIQUE,
    `slug` VARCHAR(80) NOT NULL UNIQUE,
    `description` TEXT,
    `is_active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `category_id` INT NULL,
    `name` VARCHAR(150) NOT NULL,
    `sku` VARCHAR(50) NOT NULL UNIQUE,
    `price` DECIMAL(12, 2) NOT NULL,
    `stock_quantity` INT DEFAULT 0,
    `is_published` TINYINT(1) DEFAULT 1,
    `specifications` JSON,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_prod_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT NOT NULL,
    `order_number` VARCHAR(40) NOT NULL UNIQUE,
    `status` VARCHAR(30) DEFAULT 'pending', -- pending, processing, completed, cancelled
    `total_amount` DECIMAL(14, 2) DEFAULT 0.00,
    `payment_method` VARCHAR(50),
    `shipping_city` VARCHAR(80),
    `ordered_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_order_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    CONSTRAINT `fk_item_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `activity_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `event_type` VARCHAR(60) NOT NULL,
    `actor_email` VARCHAR(120),
    `description` TEXT NOT NULL,
    `metadata` JSON,
    `ip_address` VARCHAR(45),
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Populate Sample Data
INSERT INTO `departments` (`name`, `code`, `budget`, `location`) VALUES
('Technology & Engineering', 'ENG', 1250000000.00, 'Jakarta Selatan'),
('Product & UI/UX', 'PROD', 650000000.00, 'Jakarta Selatan'),
('Sales & Marketing', 'MKT', 850000000.00, 'Bandung'),
('Finance & Accounting', 'FIN', 450000000.00, 'Surabaya'),
('Human Resources', 'HR', 350000000.00, 'Jakarta Pusat');

INSERT INTO `employees` (`department_id`, `first_name`, `last_name`, `email`, `position`, `salary`, `hire_date`, `is_active`) VALUES
(1, 'Fajar', 'Wahyudi', 'fajar@example.com', 'Lead Fullstack Architect', 28000000.00, '2023-01-15', 1),
(1, 'Ahmad', 'Rizky', 'ahmad.rizky@example.com', 'Senior Backend Engineer', 19500000.00, '2023-03-01', 1),
(1, 'Siti', 'Rahmawati', 'siti.rahma@example.com', 'Frontend Specialist', 16500000.00, '2023-05-10', 1),
(2, 'Budi', 'Santoso', 'budi.santoso@example.com', 'Principal Product Manager', 24000000.00, '2022-11-20', 1),
(2, 'Dewi', 'Lestari', 'dewi.lestari@example.com', 'Senior UI/UX Designer', 15500000.00, '2023-02-14', 1),
(3, 'Reza', 'Pratama', 'reza.p@example.com', 'Marketing Director', 21000000.00, '2022-08-01', 1),
(3, 'Maya', 'Kusuma', 'maya.kusuma@example.com', 'Digital Growth Specialist', 12500000.00, '2023-07-01', 1),
(4, 'Hendro', 'Wijaya', 'hendro.w@example.com', 'Finance Controller', 18000000.00, '2022-05-15', 1),
(5, 'Nur', 'Aini', 'nur.aini@example.com', 'HR Business Partner', 14000000.00, '2023-04-10', 1),
(1, 'Kevin', 'Aditya', 'kevin.aditya@example.com', 'DevOps & Cloud Engineer', 18500000.00, '2023-09-01', 1);

INSERT INTO `customers` (`full_name`, `email`, `phone`, `city`, `country`, `preferences`, `is_vip`) VALUES
('Rian Hidayat', 'rian.h@gmail.com', '081234567890', 'Jakarta', 'Indonesia', '{"newsletter": true, "theme": "dark", "preferred_category": "electronics"}', 1),
('Anisa Maharani', 'anisa.m@yahoo.com', '081398765432', 'Surabaya', 'Indonesia', '{"newsletter": false, "preferred_category": "fashion"}', 0),
('Eko Prasetyo', 'eko.p@outlook.com', '085711223344', 'Yogyakarta', 'Indonesia', '{"newsletter": true, "discounts_alert": true}', 1),
('Dina Safitri', 'dina.safitri@gmail.com', '081822334455', 'Bandung', 'Indonesia', '{"newsletter": true}', 0),
('Bambang Gunawan', 'bambang.g@corporate.co.id', '081199887766', 'Medan', 'Indonesia', '{"b2b_account": true, "credit_limit": 50000000}', 1),
('Intan Permata', 'intan.permata@gmail.com', '085612344321', 'Semarang', 'Indonesia', '{"newsletter": false}', 0),
('Bayu Nugroho', 'bayu.nugroho@gmail.com', '082144556677', 'Denpasar', 'Indonesia', '{"preferred_payment": "qris"}', 0),
('Clara Wijaya', 'clara.w@gmail.com', '087899001122', 'Makassar', 'Indonesia', '{"newsletter": true, "vip_tier": "gold"}', 1);

INSERT INTO `product_categories` (`name`, `slug`, `description`, `is_active`) VALUES
('Electronics & Gadgets', 'electronics', 'Smartphone, laptop, aksesoris audio, dan perlengkapan komputer', 1),
('Office & Productivity', 'office', 'Meja kerja ergonomis, kursi kantor, dan alat produktivitas kerja', 1),
('Fashion & Lifestyle', 'fashion', 'Pakaian pria dan wanita, jam tangan, dan tas modern', 1),
('Smart Home & IoT', 'smart-home', 'Lampu pintar, CCTV wifi, smart plug, dan automasi rumah', 1);

INSERT INTO `products` (`category_id`, `name`, `sku`, `price`, `stock_quantity`, `is_published`, `specifications`) VALUES
(1, 'Laptop UltraBook Pro 14"', 'LP-UB14-01', 14500000.00, 35, 1, '{"cpu": "Intel Core i7-13700H", "ram": "16GB LPDDR5", "ssd": "1TB NVMe", "display": "14 inch 2.8K OLED"}'),
(1, 'Wireless Noise-Cancelling Headphones', 'AU-NCX-02', 2250000.00, 80, 1, '{"bluetooth": "5.3", "battery_life_hours": 40, "anc_modes": ["transparency", "deep_anc"]}'),
(1, 'Mechanical Keyboard 75% Wireless', 'KB-MK75-03', 1150000.00, 120, 1, '{"switches": "Gateron Brown", "connectivity": ["Bluetooth", "2.4G", "Type-C"], "rgb": true}'),
(1, 'Ergonomic Vertical Mouse RGB', 'MS-EVO-04', 450000.00, 150, 1, '{"dpi": 4000, "sensor": "optical", "wireless": true}'),
(2, 'Standing Desk Dual Motor 140x70', 'DK-SD140-01', 4850000.00, 20, 1, '{"motor": "dual", "height_range": "60cm - 125cm", "memory_presets": 4}'),
(2, 'Ergonomic Mesh Chair High-Back', 'CH-EMHB-02', 2750000.00, 45, 1, '{"lumbar_support": "adjustable", "recline_angle": 135, "material": "korean mesh"}'),
(3, 'Minimalist Waterproof Backpack 20L', 'BP-MW20-01', 650000.00, 95, 1, '{"capacity": "20L", "waterproof": true, "laptop_compartment": "15.6 inch"}'),
(3, 'Smartwatch AMOLED Sapphire Glass', 'SW-AMO-02', 1850000.00, 60, 1, '{"screen": "1.43 inch AMOLED", "water_resistance": "5ATM", "gps": "dual-band"}'),
(4, 'Smart WiFi Security Camera 2K', 'SH-CAM2K-01', 520000.00, 110, 1, '{"resolution": "2K 1296p", "night_vision": "color", "pan_tilt": true}'),
(4, 'Smart RGBIC Ambient Light Bar', 'SH-RGB-02', 380000.00, 140, 1, '{"sync": "audio-sync", "connectivity": "WiFi & Bluetooth", "app": "Tuya / SmartLife"}');

INSERT INTO `orders` (`customer_id`, `order_number`, `status`, `total_amount`, `payment_method`, `shipping_city`, `ordered_at`) VALUES
(1, 'ORD-2026-001', 'completed', 16750000.00, 'Bank Transfer (BCA)', 'Jakarta', '2026-11-01 10:15:00'),
(2, 'ORD-2026-002', 'completed', 1150000.00, 'GoPay', 'Surabaya', '2026-11-03 14:30:00'),
(3, 'ORD-2026-003', 'processing', 7600000.00, 'Credit Card (Visa)', 'Yogyakarta', '2026-11-05 09:45:00'),
(4, 'ORD-2026-004', 'completed', 650000.00, 'ShopeePay', 'Bandung', '2026-11-08 16:20:00'),
(5, 'ORD-2026-005', 'completed', 29000000.00, 'Corporate Invoice', 'Medan', '2026-11-10 11:00:00'),
(6, 'ORD-2026-006', 'pending', 2250000.00, 'QRIS', 'Semarang', '2026-11-12 18:05:00'),
(7, 'ORD-2026-007', 'processing', 900000.00, 'BCA Virtual Account', 'Denpasar', '2026-11-14 13:50:00'),
(8, 'ORD-2026-008', 'completed', 4850000.00, 'Credit Card (Mastercard)', 'Makassar', '2026-11-15 08:30:00');

INSERT INTO `order_items` (`order_id`, `product_id`, `quantity`, `unit_price`, `subtotal`) VALUES
(1, 1, 1, 14500000.00, 14500000.00),
(1, 2, 1, 2250000.00, 2250000.00),
(2, 3, 1, 1150000.00, 1150000.00),
(3, 5, 1, 4850000.00, 4850000.00),
(3, 6, 1, 2750000.00, 2750000.00),
(4, 7, 1, 650000.00, 650000.00),
(5, 1, 2, 14500000.00, 29000000.00),
(6, 2, 1, 2250000.00, 2250000.00),
(7, 4, 2, 450000.00, 900000.00),
(8, 5, 1, 4850000.00, 4850000.00);

INSERT INTO `activity_logs` (`event_type`, `actor_email`, `description`, `metadata`, `ip_address`) VALUES
('AUTH_LOGIN', 'fajar@example.com', 'Admin logged in via web client', '{"browser": "Chrome", "os": "Linux"}', '192.168.1.10'),
('ORDER_CREATED', 'rian.h@gmail.com', 'Customer placed order ORD-2026-001', '{"order_id": 1, "total": 16750000}', '180.252.10.45'),
('ORDER_PAID', 'rian.h@gmail.com', 'Payment confirmed for order ORD-2026-001', '{"gateway": "BCA VA"}', '180.252.10.45'),
('PRODUCT_UPDATED', 'budi.santoso@example.com', 'Stock adjusted for LP-UB14-01', '{"previous_stock": 36, "new_stock": 35}', '192.168.1.25'),
('CUSTOMER_REGISTERED', 'clara.w@gmail.com', 'New customer registered account', '{"referral": "instagram"}', '114.125.88.90');

-- ==============================================================================
--  EXAMPLE POSTGRESQL DATABASE: E-COMMERCE & ENTERPRISE MANAGEMENT
--  Compatible with PostgreSQL 12+ (Supabase, Neon, AWS RDS, Local PostgreSQL)
-- ==============================================================================

-- 1. Reset existing tables in reverse dependency order
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- 2. Create Schema
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    budget NUMERIC(14, 2) DEFAULT 0.00,
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    position VARCHAR(80),
    salary NUMERIC(12, 2) NOT NULL,
    hire_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(30),
    city VARCHAR(80),
    country VARCHAR(80) DEFAULT 'Indonesia',
    preferences JSONB DEFAULT '{}',
    is_vip BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    slug VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    price NUMERIC(12, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    specifications JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    order_number VARCHAR(40) NOT NULL UNIQUE,
    status VARCHAR(30) DEFAULT 'pending', -- pending, processing, completed, cancelled
    total_amount NUMERIC(14, 2) DEFAULT 0.00,
    payment_method VARCHAR(50),
    shipping_city VARCHAR(80),
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL
);

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(60) NOT NULL,
    actor_email VARCHAR(120),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Populate Sample Data
INSERT INTO departments (name, code, budget, location) VALUES
('Technology & Engineering', 'ENG', 1250000000.00, 'Jakarta Selatan'),
('Product & UI/UX', 'PROD', 650000000.00, 'Jakarta Selatan'),
('Sales & Marketing', 'MKT', 850000000.00, 'Bandung'),
('Finance & Accounting', 'FIN', 450000000.00, 'Surabaya'),
('Human Resources', 'HR', 350000000.00, 'Jakarta Pusat');

INSERT INTO employees (department_id, first_name, last_name, email, position, salary, hire_date, is_active) VALUES
(1, 'Fajar', 'Wahyudi', 'fajar@example.com', 'Lead Fullstack Architect', 28000000.00, '2023-01-15', true),
(1, 'Ahmad', 'Rizky', 'ahmad.rizky@example.com', 'Senior Backend Engineer', 19500000.00, '2023-03-01', true),
(1, 'Siti', 'Rahmawati', 'siti.rahma@example.com', 'Frontend Specialist', 16500000.00, '2023-05-10', true),
(2, 'Budi', 'Santoso', 'budi.santoso@example.com', 'Principal Product Manager', 24000000.00, '2022-11-20', true),
(2, 'Dewi', 'Lestari', 'dewi.lestari@example.com', 'Senior UI/UX Designer', 15500000.00, '2023-02-14', true),
(3, 'Reza', 'Pratama', 'reza.p@example.com', 'Marketing Director', 21000000.00, '2022-08-01', true),
(3, 'Maya', 'Kusuma', 'maya.kusuma@example.com', 'Digital Growth Specialist', 12500000.00, '2023-07-01', true),
(4, 'Hendro', 'Wijaya', 'hendro.w@example.com', 'Finance Controller', 18000000.00, '2022-05-15', true),
(5, 'Nur', 'Aini', 'nur.aini@example.com', 'HR Business Partner', 14000000.00, '2023-04-10', true),
(1, 'Kevin', 'Aditya', 'kevin.aditya@example.com', 'DevOps & Cloud Engineer', 18500000.00, '2023-09-01', true);

INSERT INTO customers (full_name, email, phone, city, country, preferences, is_vip) VALUES
('Rian Hidayat', 'rian.h@gmail.com', '081234567890', 'Jakarta', 'Indonesia', '{"newsletter": true, "theme": "dark", "preferred_category": "electronics"}', true),
('Anisa Maharani', 'anisa.m@yahoo.com', '081398765432', 'Surabaya', 'Indonesia', '{"newsletter": false, "preferred_category": "fashion"}', false),
('Eko Prasetyo', 'eko.p@outlook.com', '085711223344', 'Yogyakarta', 'Indonesia', '{"newsletter": true, "discounts_alert": true}', true),
('Dina Safitri', 'dina.safitri@gmail.com', '081822334455', 'Bandung', 'Indonesia', '{"newsletter": true}', false),
('Bambang Gunawan', 'bambang.g@corporate.co.id', '081199887766', 'Medan', 'Indonesia', '{"b2b_account": true, "credit_limit": 50000000}', true),
('Intan Permata', 'intan.permata@gmail.com', '085612344321', 'Semarang', 'Indonesia', '{"newsletter": false}', false),
('Bayu Nugroho', 'bayu.nugroho@gmail.com', '082144556677', 'Denpasar', 'Indonesia', '{"preferred_payment": "qris"}', false),
('Clara Wijaya', 'clara.w@gmail.com', '087899001122', 'Makassar', 'Indonesia', '{"newsletter": true, "vip_tier": "gold"}', true);

INSERT INTO product_categories (name, slug, description, is_active) VALUES
('Electronics & Gadgets', 'electronics', 'Smartphone, laptop, aksesoris audio, dan perlengkapan komputer', true),
('Office & Productivity', 'office', 'Meja kerja ergonomis, kursi kantor, dan alat produktivitas kerja', true),
('Fashion & Lifestyle', 'fashion', 'Pakaian pria dan wanita, jam tangan, dan tas modern', true),
('Smart Home & IoT', 'smart-home', 'Lampu pintar, CCTV wifi, smart plug, dan automasi rumah', true);

INSERT INTO products (category_id, name, sku, price, stock_quantity, is_published, specifications) VALUES
(1, 'Laptop UltraBook Pro 14"', 'LP-UB14-01', 14500000.00, 35, true, '{"cpu": "Intel Core i7-13700H", "ram": "16GB LPDDR5", "ssd": "1TB NVMe", "display": "14 inch 2.8K OLED"}'),
(1, 'Wireless Noise-Cancelling Headphones', 'AU-NCX-02', 2250000.00, 80, true, '{"bluetooth": "5.3", "battery_life_hours": 40, "anc_modes": ["transparency", "deep_anc"]}'),
(1, 'Mechanical Keyboard 75% Wireless', 'KB-MK75-03', 1150000.00, 120, true, '{"switches": "Gateron Brown", "connectivity": ["Bluetooth", "2.4G", "Type-C"], "rgb": true}'),
(1, 'Ergonomic Vertical Mouse RGB', 'MS-EVO-04', 450000.00, 150, true, '{"dpi": 4000, "sensor": "optical", "wireless": true}'),
(2, 'Standing Desk Dual Motor 140x70', 'DK-SD140-01', 4850000.00, 20, true, '{"motor": "dual", "height_range": "60cm - 125cm", "memory_presets": 4}'),
(2, 'Ergonomic Mesh Chair High-Back', 'CH-EMHB-02', 2750000.00, 45, true, '{"lumbar_support": "adjustable", "recline_angle": 135, "material": "korean mesh"}'),
(3, 'Minimalist Waterproof Backpack 20L', 'BP-MW20-01', 650000.00, 95, true, '{"capacity": "20L", "waterproof": true, "laptop_compartment": "15.6 inch"}'),
(3, 'Smartwatch AMOLED Sapphire Glass', 'SW-AMO-02', 1850000.00, 60, true, '{"screen": "1.43 inch AMOLED", "water_resistance": "5ATM", "gps": "dual-band"}'),
(4, 'Smart WiFi Security Camera 2K', 'SH-CAM2K-01', 520000.00, 110, true, '{"resolution": "2K 1296p", "night_vision": "color", "pan_tilt": true}'),
(4, 'Smart RGBIC Ambient Light Bar', 'SH-RGB-02', 380000.00, 140, true, '{"sync": "audio-sync", "connectivity": "WiFi & Bluetooth", "app": "Tuya / SmartLife"}');

INSERT INTO orders (customer_id, order_number, status, total_amount, payment_method, shipping_city, ordered_at) VALUES
(1, 'ORD-2026-001', 'completed', 16750000.00, 'Bank Transfer (BCA)', 'Jakarta', '2026-11-01 10:15:00+07'),
(2, 'ORD-2026-002', 'completed', 1150000.00, 'GoPay', 'Surabaya', '2026-11-03 14:30:00+07'),
(3, 'ORD-2026-003', 'processing', 7600000.00, 'Credit Card (Visa)', 'Yogyakarta', '2026-11-05 09:45:00+07'),
(4, 'ORD-2026-004', 'completed', 650000.00, 'ShopeePay', 'Bandung', '2026-11-08 16:20:00+07'),
(5, 'ORD-2026-005', 'completed', 29000000.00, 'Corporate Invoice', 'Medan', '2026-11-10 11:00:00+07'),
(6, 'ORD-2026-006', 'pending', 2250000.00, 'QRIS', 'Semarang', '2026-11-12 18:05:00+07'),
(7, 'ORD-2026-007', 'processing', 900000.00, 'BCA Virtual Account', 'Denpasar', '2026-11-14 13:50:00+07'),
(8, 'ORD-2026-008', 'completed', 4850000.00, 'Credit Card (Mastercard)', 'Makassar', '2026-11-15 08:30:00+07');

INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
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

INSERT INTO activity_logs (event_type, actor_email, description, metadata, ip_address) VALUES
('AUTH_LOGIN', 'fajar@example.com', 'Admin logged in via web client', '{"browser": "Chrome", "os": "Linux"}', '192.168.1.10'),
('ORDER_CREATED', 'rian.h@gmail.com', 'Customer placed order ORD-2026-001', '{"order_id": 1, "total": 16750000}', '180.252.10.45'),
('ORDER_PAID', 'rian.h@gmail.com', 'Payment confirmed for order ORD-2026-001', '{"gateway": "BCA VA"}', '180.252.10.45'),
('PRODUCT_UPDATED', 'budi.santoso@example.com', 'Stock adjusted for LP-UB14-01', '{"previous_stock": 36, "new_stock": 35}', '192.168.1.25'),
('CUSTOMER_REGISTERED', 'clara.w@gmail.com', 'New customer registered account', '{"referral": "instagram"}', '114.125.88.90');

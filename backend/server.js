require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const path = require('path');

let Database = null;
try {
  Database = require('better-sqlite3');
} catch (error) {
  console.warn('⚠️ better-sqlite3 not available; skipping demo SQLite setup. This is expected on some shared hosting environments.');
}

const { initUserDatabase } = require('./src/db/userDb');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const { optionalAuth, requireAuth } = require('./src/middleware/auth');
const { parseDatabaseUri } = require('./src/utils/dbUriParser');

const app = express();

// Cybersecurity: HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts and React Dev/Vite
  crossOriginEmbedderPolicy: false,
}));

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Mount Auth & User Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Store connections (key → { type, pool/db, tables })
const connections = new Map();

function getConnectionKey({ host, port, database, user, password }) {
  return `${host || 'localhost'}:${port || ''}:${database || ''}:${user || ''}:${password || ''}`;
}

// ============================================================
//  DEMO SQLite Database — auto-created with sample data
// ============================================================
function createDemoDB() {
  if (!Database) {
    console.log('ℹ️ Demo SQLite database is disabled because better-sqlite3 is unavailable on this hosting environment.');
    return;
  }

  const dbPath = path.join(__dirname, 'demo.db');
  const db = Database(dbPath);

  // Enable WAL mode for better perf
  db.pragma('journal_mode = WAL');

  // Create sample tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE,
      department TEXT,
      position TEXT,
      salary REAL,
      hire_date TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      manager TEXT,
      budget REAL,
      location TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      status TEXT DEFAULT 'active',
      start_date TEXT,
      end_date TEXT,
      budget REAL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      project_id INTEGER REFERENCES projects(id),
      assigned_to INTEGER REFERENCES employees(id),
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'todo',
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      order_date TEXT DEFAULT (datetime('now')),
      total_amount REAL,
      status TEXT DEFAULT 'pending',
      shipping_address TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      price REAL,
      stock_quantity INTEGER DEFAULT 0,
      description TEXT,
      is_available INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL
    );
  `);

  // Insert sample data only if tables are empty
  const empCount = db.prepare('SELECT COUNT(*) as c FROM employees').get().c;
  if (empCount === 0) {
    const insertEmp = db.prepare(`INSERT INTO employees (first_name, last_name, email, department, position, salary, hire_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const employees = [
      ['Ahmad', 'Rizki', 'ahmad.rizki@company.com', 'Engineering', 'Senior Developer', 15000000, '2020-03-15', 1],
      ['Siti', 'Nurhaliza', 'siti.nur@company.com', 'Engineering', 'Tech Lead', 20000000, '2019-01-10', 1],
      ['Budi', 'Santoso', 'budi.s@company.com', 'Marketing', 'Marketing Manager', 18000000, '2018-06-20', 1],
      ['Dewi', 'Lestari', 'dewi.l@company.com', 'HR', 'HR Director', 22000000, '2017-09-01', 1],
      ['Andi', 'Prasetyo', 'andi.p@company.com', 'Engineering', 'Junior Developer', 8000000, '2023-01-15', 1],
      ['Rina', 'Wati', 'rina.w@company.com', 'Finance', 'Accountant', 12000000, '2021-04-10', 1],
      ['Joko', 'Widodo', 'joko.w@company.com', 'Operations', 'Operations Manager', 17000000, '2019-07-22', 1],
      ['Maya', 'Sari', 'maya.s@company.com', 'Engineering', 'Frontend Developer', 13000000, '2022-02-28', 1],
      ['Rudi', 'Hartono', 'rudi.h@company.com', 'Marketing', 'Content Creator', 9000000, '2023-05-10', 1],
      ['Fitri', 'Handayani', 'fitri.h@company.com', 'Engineering', 'Backend Developer', 14000000, '2021-08-15', 1],
      ['Dian', 'Permata', 'dian.p@company.com', 'Finance', 'Finance Manager', 19000000, '2018-11-05', 1],
      ['Agus', 'Setiawan', 'agus.s@company.com', 'HR', 'Recruiter', 10000000, '2022-09-12', 1],
      ['Lina', 'Marlina', 'lina.m@company.com', 'Engineering', 'DevOps Engineer', 16000000, '2020-06-18', 1],
      ['Hendra', 'Gunawan', 'hendra.g@company.com', 'Operations', 'Logistics Lead', 13000000, '2021-01-25', 0],
      ['Putri', 'Anggraini', 'putri.a@company.com', 'Marketing', 'SEO Specialist', 11000000, '2022-03-30', 1],
    ];
    const insertMany = db.transaction((rows) => { for (const r of rows) insertEmp.run(...r); });
    insertMany(employees);

    // Departments
    const insertDept = db.prepare(`INSERT INTO departments (name, manager, budget, location) VALUES (?, ?, ?, ?)`);
    const departments = [
      ['Engineering', 'Siti Nurhaliza', 500000000, 'Jakarta'],
      ['Marketing', 'Budi Santoso', 200000000, 'Jakarta'],
      ['HR', 'Dewi Lestari', 100000000, 'Jakarta'],
      ['Finance', 'Dian Permata', 150000000, 'Surabaya'],
      ['Operations', 'Joko Widodo', 300000000, 'Bandung'],
    ];
    const insertDepts = db.transaction((rows) => { for (const r of rows) insertDept.run(...r); });
    insertDepts(departments);

    // Projects
    const insertProj = db.prepare(`INSERT INTO projects (name, department_id, status, start_date, end_date, budget, description) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const projects = [
      ['App Database v2', 1, 'active', '2024-01-01', '2024-06-30', 100000000, 'Next-gen database management tool'],
      ['Brand Refresh', 2, 'active', '2024-02-15', '2024-05-30', 50000000, 'Complete brand identity redesign'],
      ['HR Portal', 1, 'completed', '2023-06-01', '2023-12-31', 75000000, 'Internal HR management system'],
      ['Cloud Migration', 1, 'active', '2024-03-01', '2024-09-30', 200000000, 'Migrate infrastructure to GCP'],
      ['Q1 Campaign', 2, 'completed', '2024-01-01', '2024-03-31', 30000000, 'Q1 digital marketing campaign'],
    ];
    const insertProjs = db.transaction((rows) => { for (const r of rows) insertProj.run(...r); });
    insertProjs(projects);

    // Tasks
    const insertTask = db.prepare(`INSERT INTO tasks (title, project_id, assigned_to, priority, status, due_date) VALUES (?, ?, ?, ?, ?, ?)`);
    const tasks = [
      ['Design database schema', 1, 1, 'high', 'done', '2024-01-15'],
      ['Build REST API', 1, 10, 'high', 'in_progress', '2024-02-28'],
      ['Frontend React UI', 1, 8, 'high', 'in_progress', '2024-03-15'],
      ['Setup CI/CD pipeline', 4, 13, 'medium', 'todo', '2024-04-01'],
      ['Create landing page', 2, 9, 'medium', 'in_progress', '2024-03-20'],
      ['Logo redesign', 2, 15, 'high', 'done', '2024-03-01'],
      ['Employee onboarding flow', 3, 12, 'low', 'done', '2023-09-15'],
      ['Performance review module', 3, 5, 'medium', 'done', '2023-11-30'],
      ['Kubernetes setup', 4, 13, 'high', 'in_progress', '2024-05-15'],
      ['Social media ads', 5, 3, 'medium', 'done', '2024-02-15'],
    ];
    const insertTasks = db.transaction((rows) => { for (const r of rows) insertTask.run(...r); });
    insertTasks(tasks);

    // Customers
    const insertCust = db.prepare(`INSERT INTO customers (company_name, contact_name, email, phone, city, country) VALUES (?, ?, ?, ?, ?, ?)`);
    const customers = [
      ['PT Teknologi Maju', 'Bambang Sutrisno', 'bambang@teknologimaju.id', '+62-21-5551234', 'Jakarta', 'Indonesia'],
      ['CV Digital Nusantara', 'Ratna Dewi', 'ratna@digitalnusantara.com', '+62-31-5559876', 'Surabaya', 'Indonesia'],
      ['PT Cloud Indonesia', 'Arif Rahman', 'arif@cloudindonesia.io', '+62-22-5554321', 'Bandung', 'Indonesia'],
      ['Startup Kreatif Inc', 'Sarah Chen', 'sarah@startupkreatif.com', '+65-91234567', 'Singapore', 'Singapore'],
      ['Data Solutions Pte', 'James Tan', 'james@datasolutions.sg', '+65-98765432', 'Singapore', 'Singapore'],
      ['PT Solusi Digital', 'Wawan Hermawan', 'wawan@solusidigital.co.id', '+62-21-5557777', 'Jakarta', 'Indonesia'],
    ];
    const insertCusts = db.transaction((rows) => { for (const r of rows) insertCust.run(...r); });
    insertCusts(customers);

    // Products
    const insertProd = db.prepare(`INSERT INTO products (name, category, price, stock_quantity, description, is_available) VALUES (?, ?, ?, ?, ?, ?)`);
    const products = [
      ['Database Pro License', 'Software', 2500000, 100, 'Professional database management tool', 1],
      ['Cloud Hosting Basic', 'Service', 500000, 999, 'Basic cloud hosting plan — 2GB RAM', 1],
      ['Cloud Hosting Pro', 'Service', 1500000, 999, 'Pro cloud hosting plan — 8GB RAM', 1],
      ['SSL Certificate', 'Security', 300000, 500, '1-year SSL certificate', 1],
      ['Support Package', 'Service', 1000000, 50, '24/7 premium support for 1 year', 1],
      ['API Gateway', 'Software', 3000000, 200, 'Enterprise API gateway license', 1],
      ['Monitoring Tool', 'Software', 800000, 150, 'Server & application monitoring', 1],
    ];
    const insertProds = db.transaction((rows) => { for (const r of rows) insertProd.run(...r); });
    insertProds(products);

    // Orders
    const insertOrder = db.prepare(`INSERT INTO orders (customer_id, order_date, total_amount, status, notes) VALUES (?, ?, ?, ?, ?)`);
    const orders = [
      [1, '2024-01-15', 5000000, 'completed', 'Renewal license'],
      [2, '2024-02-01', 1500000, 'completed', 'New hosting plan'],
      [3, '2024-02-20', 3300000, 'shipped', 'SSL + monitoring bundle'],
      [1, '2024-03-05', 3000000, 'processing', 'API gateway license'],
      [4, '2024-03-10', 2500000, 'pending', 'Database Pro license'],
      [5, '2024-03-15', 4500000, 'pending', 'Pro hosting + support'],
    ];
    const insertOrders = db.transaction((rows) => { for (const r of rows) insertOrder.run(...r); });
    insertOrders(orders);

    // Order Items
    const insertItem = db.prepare(`INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)`);
    const items = [
      [1, 1, 2, 2500000, 5000000],
      [2, 3, 1, 1500000, 1500000],
      [3, 4, 1, 300000, 300000], [3, 7, 1, 800000, 800000], [3, 3, 1, 1500000, 1500000],
      [4, 6, 1, 3000000, 3000000],
      [5, 1, 1, 2500000, 2500000],
      [6, 3, 1, 1500000, 1500000], [6, 5, 1, 1000000, 1000000], [6, 7, 1, 800000, 800000],
    ];
    const insertItems = db.transaction((rows) => { for (const r of rows) insertItem.run(...r); });
    insertItems(items);

    console.log('✅ Demo database created with sample data');
  }

  return db;
}

// ============================================================
//  SQLite adapter — mirrors the pg query interface
// ============================================================
class SQLiteAdapter {
  constructor(db) { this.db = db; }

  getTables() {
    const rows = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();
    return rows.map(r => r.name);
  }

  query(sql) {
    const trimmed = sql.trim();
    const isSelect = /^(SELECT|PRAGMA|WITH|EXPLAIN)/i.test(trimmed);
    if (isSelect) {
      const stmt = this.db.prepare(trimmed);
      const rows = stmt.all();
      const columns = stmt.columns();
      const fields = columns.map(c => ({ name: c.name }));
      return { rows, fields, rowCount: rows.length };
    } else {
      const info = this.db.prepare(trimmed).run();
      return { rows: [], fields: [], rowCount: info.changes };
    }
  }

  getTableStructure(tableName) {
    const columns = this.db.prepare(`PRAGMA table_info("${tableName}")`).all();
    return columns.map(c => ({
      column_name: c.name,
      data_type: c.type || 'TEXT',
      is_nullable: c.notnull ? 'NO' : 'YES',
      column_default: c.dflt_value,
      character_maximum_length: null,
      is_primary_key: c.pk === 1,
    }));
  }

  getTableData(tableName, limit = 'all', offset = 0) {
    const total = this.db.prepare(`SELECT COUNT(*) as c FROM "${tableName}"`).get().c;
    const isAll = limit === 'all' || limit === 0 || limit === -1 || !limit;
    const sql = isAll
      ? `SELECT * FROM "${tableName}"`
      : `SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`;
    const stmt = this.db.prepare(sql);
    const rows = isAll ? stmt.all() : stmt.all(parseInt(limit), parseInt(offset));
    const columns = stmt.columns();
    const fields = columns.map(c => ({ name: c.name }));
    return { rows, fields, total };
  }

  close() {
    this.db.close();
  }
}

// ============================================================
//  MySQL / MariaDB Adapter
// ============================================================
class MySQLAdapter {
  constructor(pool, databaseName) {
    this.pool = pool;
    this.databaseName = databaseName;
  }

  async getTables() {
    const [rows] = await this.pool.query(
      `SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [this.databaseName]
    );
    return rows.map(r => r.name);
  }

  async query(sql) {
    const [rows, fields] = await this.pool.query(sql);
    if (Array.isArray(rows)) {
      const fieldList = (fields || []).map(f => ({ name: f.name }));
      return { rows, fields: fieldList, rowCount: rows.length };
    } else {
      return { rows: [], fields: [], rowCount: rows.affectedRows || 0 };
    }
  }

  async getTableStructure(tableName) {
    const [columns] = await this.pool.query(
      `SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type, IS_NULLABLE as is_nullable,
              COLUMN_DEFAULT as column_default, CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
              COLUMN_KEY as column_key
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [this.databaseName, tableName]
    );
    return columns.map(c => ({
      column_name: c.column_name,
      data_type: c.data_type,
      is_nullable: c.is_nullable,
      column_default: c.column_default,
      character_maximum_length: c.character_maximum_length,
      is_primary_key: c.column_key === 'PRI',
    }));
  }

  async getTableData(tableName, limit = 'all', offset = 0, orderBy, orderDir = 'ASC') {
    const [countResult] = await this.pool.query(
      `SELECT COUNT(*) as c FROM \`${tableName}\``
    );
    const total = countResult[0]?.c || 0;

    let orderSql = '';
    if (orderBy) {
      const safeDir = String(orderDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      orderSql = `ORDER BY \`${orderBy}\` ${safeDir}`;
    }

    const isAll = limit === 'all' || limit === 0 || limit === -1 || !limit;
    const limitClause = isAll ? '' : `LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

    const [rows, fields] = await this.pool.query(
      `SELECT * FROM \`${tableName}\` ${orderSql} ${limitClause}`
    );
    const fieldList = (fields || []).map(f => ({ name: f.name }));
    return { rows, fields: fieldList, total };
  }

  async close() {
    await this.pool.end().catch(() => {});
  }
}

// Utility: format bytes to human readable
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ============================================================
//  ROUTES & CONNECTION LOGIC
// ============================================================

// Diagnostic error formatter for user-friendly Indonesian error messages
function formatDbConnectionError(err, type, host, port, database) {
  const msg = (err && err.message) ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('emaxconnsession') || lower.includes('max clients reached in session mode')) {
    return `Koneksi Supabase Session Mode Penuh (EMAXCONNSESSION). Batas pool 15 klien terlampaui di server Supabase Anda. ` +
           `Ganti port 5432 menjadi 6543 (Transaction Mode) pada Connection URI Anda untuk koneksi tanpa batas pool session, atau tutup koneksi aktif lain di dashboard Supabase.`;
  }
  if (lower.includes('password authentication failed') || lower.includes('access denied for user')) {
    return `Autentikasi gagal: Username atau kata sandi database salah. Pastikan kredensial yang dimasukkan sudah benar.`;
  }
  if (lower.includes('database') && (lower.includes('does not exist') || lower.includes('unknown database'))) {
    return `Database '${database}' tidak ditemukan di server ${host}. Pastikan nama database sudah sesuai.`;
  }
  if (lower.includes('econnrefused')) {
    return `Koneksi ditolak (ECONNREFUSED) pada ${host}:${port}. Pastikan database aktif dan port ${port} terbuka / tidak terblokir firewall.`;
  }
  if (lower.includes('enotfound') || lower.includes('getaddrinfo enotfound')) {
    return `Host '${host}' tidak dapat ditemukan (DNS ENOTFOUND). Periksa kembali alamat hostname atau URL database Anda.`;
  }
  if (lower.includes('etimedout') || lower.includes('timeout') || lower.includes('connection timed out')) {
    return `Waktu koneksi habis (ETIMEDOUT) ke ${host}:${port}. Pastikan server dapat diakses dari internet atau gunakan tunnel/VPN jika database di jaringan lokal.`;
  }
  if (lower.includes('ssl') || lower.includes('pg_hba.conf')) {
    return `Koneksi SSL diperlukan atau ditolak oleh server database: ${msg}`;
  }
  return `Koneksi ${type || 'database'} gagal: ${msg}`;
}

// Universal connection builder supporting Connection URI, SSL auto-negotiation, and multi-database engines
async function establishConnection(params) {
  let { host, port, database, user, password, type, connection_string, connectionString, uri, ssl } = params;
  let rawUri = (connection_string || connectionString || uri || '').trim();

  if (rawUri) {
    const parsed = parseDatabaseUri(rawUri);
    if (parsed) {
      host = host || parsed.host;
      port = port || parsed.port;
      database = database || parsed.database;
      user = (user !== undefined && user !== null && user !== '') ? user : parsed.user;
      password = (password !== undefined && password !== null && password !== '') ? password : parsed.password;
      type = type || parsed.type;
      if (ssl === undefined) ssl = parsed.ssl;
      rawUri = parsed.connectionString;
    }
  }

  // Engine & default normalization
  type = (type || (rawUri.startsWith('mysql') ? 'mysql' : 'postgres')).toLowerCase();
  user = user !== undefined && user !== null ? String(user) : 'postgres';
  password = password !== undefined && password !== null ? String(password) : '';

  // --- DEMO MODE: connect to built-in SQLite ---
  if ((host === 'localhost' && database === 'demo') || type === 'sqlite') {
    try {
      const db = createDemoDB();
      const adapter = new SQLiteAdapter(db);
      const tables = adapter.getTables();
      return {
        type: 'sqlite',
        adapter,
        tables,
        engine: 'SQLite (Local / Demo)',
        host: 'localhost',
        port: 3001,
        database: 'demo',
        user: 'demo',
        password: '',
        rawUri,
      };
    } catch (err) {
      throw new Error('Demo DB error: ' + err.message);
    }
  }

  if (!host || !port || !database) {
    throw new Error('Host, Port, dan Nama Database wajib diisi atau disertakan dalam Connection URI.');
  }

  // --- MYSQL / MARIADB MODE ---
  const isMysql = type === 'mysql' || port === 3306 || port === '3306' || String(host).toLowerCase().includes('mysql');
  if (isMysql) {
    try {
      const mysqlConfig = {
        host,
        port: parseInt(port) || 3306,
        user: user || 'root',
        password: password || '',
        database,
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 10000,
      };
      if (ssl) {
        mysqlConfig.ssl = { rejectUnauthorized: false };
      }

      const pool = mysql.createPool(mysqlConfig);
      await pool.query('SELECT 1');
      const adapter = new MySQLAdapter(pool, database);
      const tables = await adapter.getTables();
      return {
        type: 'mysql',
        adapter,
        pool,
        tables,
        engine: 'MySQL / MariaDB',
        host,
        port,
        database,
        user,
        password,
        rawUri,
      };
    } catch (err) {
      throw new Error(formatDbConnectionError(err, 'MySQL', host, port, database));
    }
  }

  // --- POSTGRESQL MODE (With Smart SSL Auto-Negotiation & Supabase Session Protection) ---
  let pool = null;
  let connected = false;
  let lastError = null;

  // Lean pool settings: limit max concurrent clients to 2 and release idle clients quickly (2s)
  // This prevents hitting Supabase's strict 15-client limit in Session Mode
  const poolSettings = {
    max: 2,
    idleTimeoutMillis: 2000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
  };

  // Build PG configurations to try:
  // If rawUri is present, use connectionString; else use host/port config
  const basePgConfig = rawUri
    ? { connectionString: rawUri, ...poolSettings }
    : { host, port: parseInt(port), database, user, password, ...poolSettings };

  const attempts = [];
  if (ssl) {
    // User or URI explicitly requested SSL
    attempts.push({ ...basePgConfig, ssl: { rejectUnauthorized: false } });
    attempts.push({ ...basePgConfig, ssl: false });
  } else {
    // Try standard first, auto-upgrade to SSL if required by cloud provider
    attempts.push({ ...basePgConfig, ssl: false });
    attempts.push({ ...basePgConfig, ssl: { rejectUnauthorized: false } });
  }

  for (const config of attempts) {
    try {
      pool = new Pool(config);
      await pool.query('SELECT 1');
      connected = true;
      break;
    } catch (err) {
      lastError = err;
      if (pool) {
        await pool.end().catch(() => {});
        pool = null;
      }
    }
  }

  // --- SUPABASE SESSION POOL EXHAUSTION AUTO-FALLBACK ---
  // If Session Mode (:5432) is exhausted with EMAXCONNSESSION, automatically try port 6543 (Transaction Mode)
  if (!connected && lastError) {
    const errText = String(lastError.message || '').toLowerCase();
    const isSupabaseSessionFull = errText.includes('emaxconnsession') || errText.includes('max clients reached');
    const isPort5432 = port === 5432 || port === '5432' || (rawUri && rawUri.includes(':5432'));

    if (isSupabaseSessionFull && isPort5432) {
      console.log('⚡ Supabase Session Mode (:5432) penuh. Mencoba beralih otomatis ke Transaction Mode (:6543)...');
      let altUri = rawUri ? rawUri.replace(':5432', ':6543') : null;
      let altPort = 6543;
      const altConfig = altUri
        ? { connectionString: altUri, ssl: { rejectUnauthorized: false }, ...poolSettings }
        : { host, port: altPort, database, user, password, ssl: { rejectUnauthorized: false }, ...poolSettings };

      try {
        pool = new Pool(altConfig);
        await pool.query('SELECT 1');
        connected = true;
        rawUri = altUri || rawUri;
        port = altPort;
        console.log('✅ Berhasil terhubung ke Supabase Transaction Mode pada port 6543!');
      } catch (altErr) {
        if (pool) {
          await pool.end().catch(() => {});
          pool = null;
        }
      }
    }
  }

  if (!connected) {
    throw new Error(formatDbConnectionError(lastError, 'PostgreSQL', host, port, database));
  }

  try {
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = tablesResult.rows.map(row => row.table_name);

    return {
      type: 'pg',
      pool,
      tables,
      engine: (String(host).includes('supabase') || port === 6543)
        ? 'PostgreSQL (Supabase)'
        : 'PostgreSQL',
      host,
      port,
      database,
      user,
      password,
      rawUri,
    };
  } catch (err) {
    if (pool) await pool.end().catch(() => {});
    throw new Error('Gagal mengambil daftar tabel: ' + err.message);
  }
}

// ---------- TEST CONNECTION (POIN 6 & 8) ----------
app.post('/api/connect/test', requireAuth, async (req, res) => {
  try {
    const connData = await establishConnection(req.body);
    // If pool was opened, clean it up immediately
    if (connData.pool) {
      await connData.pool.end().catch(() => {});
    }
    return res.json({
      success: true,
      message: `Koneksi berhasil! Terhubung ke ${connData.engine}. Ditemukan ${connData.tables.length} tabel.`,
      engine: connData.engine,
      tableCount: connData.tables.length,
      tables: connData.tables.slice(0, 10),
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Koneksi gagal',
    });
  }
});

// ---------- CONNECT ----------
app.post('/api/connect', requireAuth, async (req, res) => {
  try {
    const connData = await establishConnection(req.body);
    const key = getConnectionKey({
      host: connData.host,
      port: connData.port,
      database: connData.database,
      user: connData.user,
      password: connData.password,
    });

    // Close any previous connection under this key
    if (connections.has(key)) {
      const oldConn = connections.get(key);
      if (oldConn.pool) await oldConn.pool.end().catch(() => {});
      if (oldConn.adapter && oldConn.adapter.close) await oldConn.adapter.close().catch(() => {});
    }

    connections.set(key, connData);

    return res.json({
      success: true,
      tables: connData.tables,
      engine: connData.engine,
      host: connData.host,
      port: connData.port,
      database: connData.database,
      user: connData.user,
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Koneksi gagal',
    });
  }
});

// ---------- DATABASE RESOURCE & STORAGE METRICS (POIN 8) ----------
app.post('/api/database/metrics', requireAuth, getConnection, async (req, res) => {
  const conn = req.conn;
  const startTime = Date.now();

  try {
    // 1. SQLite Metrics
    if (conn.type === 'sqlite') {
      const db = conn.adapter.db;
      let pageCount = 0;
      let pageSize = 4096;
      let freeList = 0;
      try {
        const pc = db.prepare('PRAGMA page_count').get();
        pageCount = pc ? (pc.page_count || Object.values(pc)[0] || 0) : 0;
      } catch { /* ignore */ }
      try {
        const ps = db.prepare('PRAGMA page_size').get();
        pageSize = ps ? (ps.page_size || Object.values(ps)[0] || 4096) : 4096;
      } catch { /* ignore */ }
      try {
        const fl = db.prepare('PRAGMA freelist_count').get();
        freeList = fl ? (fl.freelist_count || Object.values(fl)[0] || 0) : 0;
      } catch { /* ignore */ }

      const sizeBytes = pageCount * pageSize;
      const freeBytes = freeList * pageSize;
      let version = '3.x';
      try {
        const vRow = db.prepare('SELECT sqlite_version() as v').get();
        version = vRow?.v || '3.x';
      } catch { /* ignore */ }

      let tableList = conn.tables;
      if (!tableList || tableList.length === 0) {
        if (conn.adapter && conn.adapter.getTables) {
          tableList = conn.adapter.getTables();
          conn.tables = tableList;
        }
      }

      const tablesCount = tableList ? tableList.length : 0;
      let totalRows = 0;
      const topTables = [];

      for (const t of (tableList || []).slice(0, 5)) {
        try {
          const rowCount = db.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get()['c'] || 0;
          totalRows += rowCount;
          topTables.push({ name: t, rowCount, estimatedSize: formatBytes(rowCount * 160 || 1024) });
        } catch { /* ignore */ }
      }

      return res.json({
        success: true,
        engine: 'SQLite 3 (Local Embedded)',
        version: `SQLite v${version}`,
        sizeFormatted: formatBytes(sizeBytes || 65536),
        sizeBytes: sizeBytes || 65536,
        freeFormatted: formatBytes(freeBytes),
        tablesCount,
        totalRows,
        activeConnections: 1,
        maxConnections: 1,
        latencyMs: Date.now() - startTime,
        topTables,
      });
    }

    // 2. MySQL / MariaDB Metrics
    if (conn.type === 'mysql') {
      const pool = conn.adapter.pool;
      const dbName = conn.adapter.databaseName;

      // Size
      const [sizeRows] = await pool.query(`
        SELECT SUM(data_length + index_length) as size_bytes
        FROM information_schema.TABLES
        WHERE table_schema = ?
      `, [dbName]);
      const sizeBytes = Number(sizeRows[0]?.size_bytes || 0);

      // Active & Max Connections
      let activeConnections = 1;
      try {
        const [threadRows] = await pool.query("SHOW STATUS LIKE 'Threads_connected'");
        activeConnections = parseInt(threadRows[0]?.Value || '1');
      } catch { /* ignore */ }

      let maxConnections = 151;
      try {
        const [maxConnRows] = await pool.query("SHOW VARIABLES LIKE 'max_connections'");
        maxConnections = parseInt(maxConnRows[0]?.Value || '151');
      } catch { /* ignore */ }

      // Version
      let version = 'MySQL';
      try {
        const [verRows] = await pool.query("SELECT VERSION() as v");
        version = verRows[0]?.v || 'MySQL';
      } catch { /* ignore */ }

      // Top Tables
      let topTables = [];
      let totalRows = 0;
      try {
        const [tableStats] = await pool.query(`
          SELECT TABLE_NAME as name, TABLE_ROWS as row_count, (DATA_LENGTH + INDEX_LENGTH) as size_bytes
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?
          ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
          LIMIT 5
        `, [dbName]);

        topTables = (tableStats || []).map(t => ({
          name: t.name,
          rowCount: parseInt(t.row_count || 0),
          estimatedSize: formatBytes(t.size_bytes || 0),
        }));

        totalRows = (tableStats || []).reduce((acc, t) => acc + parseInt(t.row_count || 0), 0);
      } catch { /* ignore */ }

      return res.json({
        success: true,
        engine: version.toLowerCase().includes('maria') ? 'MariaDB' : 'MySQL',
        version: `MySQL / MariaDB (${version})`,
        sizeFormatted: formatBytes(sizeBytes),
        sizeBytes,
        tablesCount: conn.tables ? conn.tables.length : 0,
        totalRows,
        activeConnections,
        maxConnections,
        latencyMs: Date.now() - startTime,
        topTables,
      });
    }

    // 3. PostgreSQL Metrics
    if (conn.type === 'pg') {
      const pool = conn.pool;

      // Size
      const sizeRes = await pool.query('SELECT pg_database_size(current_database()) as size_bytes, pg_size_pretty(pg_database_size(current_database())) as pretty_size');
      const sizeBytes = parseInt(sizeRes.rows[0]?.size_bytes || 0);
      const sizeFormatted = sizeRes.rows[0]?.pretty_size || '0 MB';

      // Connections
      const connRes = await pool.query('SELECT count(*) as active_conns FROM pg_stat_activity WHERE datname = current_database()');
      const activeConnections = parseInt(connRes.rows[0]?.active_conns || 1);
      const maxConnRes = await pool.query("SHOW max_connections");
      const maxConnections = parseInt(maxConnRes.rows[0]?.max_connections || 100);

      // Version
      const verRes = await pool.query('SELECT version() as v');
      const fullVersion = verRes.rows[0]?.v || 'PostgreSQL';
      const shortVersion = fullVersion.split(' on ')[0] || 'PostgreSQL';

      // Top tables by size
      const topTablesRes = await pool.query(`
        SELECT table_name,
               pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
               pg_total_relation_size(quote_ident(table_name)) as size_bytes
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
        LIMIT 5
      `);

      const topTables = topTablesRes.rows.map(r => ({
        name: r.table_name,
        estimatedSize: r.total_size,
        sizeBytes: parseInt(r.size_bytes || 0),
      }));

      return res.json({
        success: true,
        engine: 'PostgreSQL',
        version: shortVersion,
        sizeFormatted,
        sizeBytes,
        tablesCount: conn.tables ? conn.tables.length : 0,
        activeConnections,
        maxConnections,
        latencyMs: Date.now() - startTime,
        topTables,
      });
    }

    res.json({ success: true, latencyMs: Date.now() - startTime });
  } catch (err) {
    console.error('Metrics Error:', err);
    res.status(500).json({ error: 'Gagal mengambil metrik database: ' + err.message });
  }
});

// ---------- GLOBAL DATABASE KEYWORD SEARCH ----------
app.post('/api/database/search', requireAuth, getConnection, async (req, res) => {
  const { keyword, maxRowsPerTable = 30 } = req.body;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'Kata kunci pencarian diperlukan' });
  }

  const kw = keyword.trim();
  const conn = req.conn;
  const results = [];

  try {
    let tableNames = conn.tables || [];
    if (!tableNames || tableNames.length === 0) {
      if (conn.type === 'sqlite') {
        tableNames = conn.adapter.getTables();
      } else if (conn.type === 'mysql') {
        tableNames = await conn.adapter.getTables();
      } else if (conn.type === 'pg') {
        const tr = await conn.pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        tableNames = tr.rows.map(r => r.table_name);
      }
      conn.tables = tableNames;
    }

    for (const tableName of tableNames) {
      try {
        if (conn.type === 'sqlite') {
          const struct = conn.adapter.getTableStructure(tableName);
          if (!struct || struct.length === 0) continue;
          const conditions = struct.map(c => `CAST("${c.column_name}" AS TEXT) LIKE ?`).join(' OR ');
          const params = struct.map(() => `%${kw}%`);
          const sql = `SELECT * FROM "${tableName}" WHERE ${conditions} LIMIT ?`;
          const stmt = conn.adapter.db.prepare(sql);
          const matched = stmt.all(...params, parseInt(maxRowsPerTable));
          if (matched && matched.length > 0) {
            results.push({
              tableName,
              matchedRows: matched,
              matchCount: matched.length,
            });
          }
        } else if (conn.type === 'mysql') {
          const struct = await conn.adapter.getTableStructure(tableName);
          if (!struct || struct.length === 0) continue;
          const cols = struct.map(c => `COALESCE(\`${c.column_name}\`, '')`).join(", ' ', ");
          const sql = `SELECT * FROM \`${tableName}\` WHERE CONCAT_WS(' ', ${cols}) LIKE ? LIMIT ?`;
          const [matched] = await conn.adapter.pool.query(sql, [`%${kw}%`, parseInt(maxRowsPerTable)]);
          if (matched && matched.length > 0) {
            results.push({
              tableName,
              matchedRows: matched,
              matchCount: matched.length,
            });
          }
        } else if (conn.type === 'pg') {
          const colsRes = await conn.pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position
          `, [tableName]);
          const cols = colsRes.rows;
          if (cols.length === 0) continue;
          const conditions = cols.map(c => `CAST("${c.column_name}" AS TEXT) ILIKE $1`).join(' OR ');
          const sql = `SELECT * FROM "${tableName}" WHERE ${conditions} LIMIT $2`;
          const qr = await conn.pool.query(sql, [`%${kw}%`, parseInt(maxRowsPerTable)]);
          if (qr.rows && qr.rows.length > 0) {
            results.push({
              tableName,
              matchedRows: qr.rows,
              matchCount: qr.rows.length,
            });
          }
        }
      } catch (tableErr) {
        console.warn(`Search skipped for table ${tableName}:`, tableErr.message);
      }
    }

    const totalFound = results.reduce((sum, r) => sum + r.matchCount, 0);
    res.json({
      success: true,
      keyword: kw,
      totalFound,
      totalTablesWithMatches: results.length,
      results,
    });
  } catch (err) {
    console.error('Database Search Error:', err);
    res.status(500).json({ error: 'Pencarian database gagal: ' + err.message });
  }
});

// ---------- MIDDLEWARE ----------
function getConnection(req, res, next) {
  let { host, port, database, user, password, connection_string, connectionString, uri } = req.body;
  const rawUri = connection_string || connectionString || uri;
  if (rawUri && (!host || !database)) {
    const parsed = parseDatabaseUri(rawUri);
    if (parsed) {
      host = host || parsed.host;
      port = port || parsed.port;
      database = database || parsed.database;
      user = (user !== undefined && user !== null) ? user : parsed.user;
      password = (password !== undefined && password !== null) ? password : parsed.password;
    }
  }

  if (!host || !port || !database) {
    return res.status(400).json({ error: 'Kredensial database tidak lengkap' });
  }

  const key = getConnectionKey({ host, port, database, user, password });
  let conn = connections.get(key);

  if (!conn) {
    // Resilient fallback match across active connections
    for (const [k, v] of connections.entries()) {
      if (v.host === host && v.database === database) {
        conn = v;
        break;
      }
    }
  }

  if (!conn) {
    return res.status(401).json({ error: 'Sesi koneksi tidak ditemukan atau telah kedaluwarsa. Silakan hubungkan ulang database.' });
  }
  req.conn = conn;
  next();
}

// ---------- QUERY ----------
app.post('/api/query', requireAuth, getConnection, async (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'Query SQL diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      const result = req.conn.adapter.query(sql);
      return res.json(result);
    }
    if (req.conn.type === 'mysql') {
      const result = await req.conn.adapter.query(sql);
      return res.json(result);
    }
    // PostgreSQL
    const result = await req.conn.pool.query(sql);
    const fields = result.fields ? result.fields.map(f => ({ name: f.name })) : [];
    res.json({ rows: result.rows, fields, rowCount: result.rowCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- TABLE STRUCTURE ----------
app.post('/api/table', requireAuth, getConnection, async (req, res) => {
  const { tableName } = req.body;
  if (!tableName) return res.status(400).json({ error: 'Nama tabel diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      return res.json(req.conn.adapter.getTableStructure(tableName));
    }
    if (req.conn.type === 'mysql') {
      const structure = await req.conn.adapter.getTableStructure(tableName);
      return res.json(structure);
    }
    const result = await req.conn.pool.query(`
      SELECT
        c.column_name, c.data_type, c.is_nullable, c.column_default,
        c.character_maximum_length,
        CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END AS is_primary_key
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.column_name = kcu.column_name AND c.table_name = kcu.table_name
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
      WHERE c.table_name = $1 AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `, [tableName]);
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- TABLE DATA ----------
app.post('/api/table/data', requireAuth, getConnection, async (req, res) => {
  const { tableName, limit = 'all', offset = 0, orderBy, orderDir = 'ASC' } = req.body;
  if (!tableName) return res.status(400).json({ error: 'Nama tabel diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      return res.json(req.conn.adapter.getTableData(tableName, limit, offset));
    }
    if (req.conn.type === 'mysql') {
      const data = await req.conn.adapter.getTableData(tableName, limit, offset, orderBy, orderDir);
      return res.json(data);
    }
    const countResult = await req.conn.pool.query(`SELECT COUNT(*) AS total FROM "${tableName}"`);
    const total = parseInt(countResult.rows[0].total);

    // Determine deterministic order so rows don't shift when updated
    let orderClause = '';
    if (orderBy) {
      const safeDir = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      orderClause = `ORDER BY "${orderBy}" ${safeDir}`;
    } else {
      const pkResult = await req.conn.pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
        ORDER BY kcu.ordinal_position
      `, [tableName]);
      if (pkResult.rows.length > 0) {
        orderClause = 'ORDER BY ' + pkResult.rows.map(r => `"${r.column_name}" ASC`).join(', ');
      } else {
        orderClause = 'ORDER BY ctid ASC';
      }
    }

    const isAll = limit === 'all' || limit === 0 || limit === -1 || !limit;
    let querySql = `SELECT * FROM "${tableName}" ${orderClause}`;
    let params = [];
    if (!isAll) {
      querySql += ` LIMIT $1 OFFSET $2`;
      params = [parseInt(limit), parseInt(offset)];
    }

    const result = await req.conn.pool.query(querySql, params);
    const fields = result.fields ? result.fields.map(f => ({ name: f.name })) : [];
    res.json({ rows: result.rows, fields, total });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- REFRESH TABLE LIST ----------
app.post('/api/tables', requireAuth, getConnection, async (req, res) => {
  try {
    if (req.conn.type === 'sqlite') {
      const tables = req.conn.adapter.getTables();
      req.conn.tables = tables;
      return res.json({ tables });
    }
    if (req.conn.type === 'mysql') {
      const tables = await req.conn.adapter.getTables();
      req.conn.tables = tables;
      return res.json({ tables });
    }
    const result = await req.conn.pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    const tables = result.rows.map(r => r.table_name);
    req.conn.tables = tables;
    res.json({ tables });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Helper: Inspect column data types for safe SQL operations
async function getTableColumnTypes(conn, tableName) {
  if (conn.type === 'sqlite' || conn.type === 'mysql') {
    const struct = await conn.adapter.getTableStructure(tableName);
    const map = {};
    for (const c of struct) {
      map[c.column_name] = {
        type: (c.data_type || '').toLowerCase(),
        nullable: c.is_nullable === 'YES',
        pk: !!c.is_primary_key,
        defaultVal: c.column_default,
      };
    }
    return map;
  }
  const result = await conn.pool.query(`
    SELECT
      c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default,
      CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END AS is_primary_key
    FROM information_schema.columns c
    LEFT JOIN information_schema.key_column_usage kcu
      ON c.table_schema = kcu.table_schema
      AND c.table_name = kcu.table_name
      AND c.column_name = kcu.column_name
    LEFT JOIN information_schema.table_constraints tc
      ON kcu.table_schema = tc.table_schema
      AND kcu.table_name = tc.table_name
      AND kcu.constraint_name = tc.constraint_name
      AND tc.constraint_type = 'PRIMARY KEY'
    WHERE c.table_schema = 'public' AND c.table_name = $1
  `, [tableName]);
  const map = {};
  for (const r of result.rows) {
    map[r.column_name] = {
      type: (r.data_type || r.udt_name || '').toLowerCase(),
      nullable: r.is_nullable === 'YES',
      pk: !!r.is_primary_key,
      defaultVal: r.column_default,
    };
  }
  return map;
}

// Helper: Cast values correctly to prevent PostgreSQL type errors
function castValueForType(val, colInfo) {
  if (val === undefined || val === null || val === 'NULL') return null;
  const type = (colInfo?.type || '').toLowerCase();

  // If empty string:
  if (val === '') {
    // For string/text/varchar columns, empty string is preserved
    if (type.includes('char') || type.includes('text')) {
      return '';
    }
    // For numbers, booleans, timestamps, uuids, json: empty string means NULL
    return null;
  }

  // Integer types
  if (type.includes('int') || type.includes('serial')) {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  }

  // Numeric / Float / Real / Double
  if (type.includes('float') || type.includes('double') || type.includes('numeric') || type.includes('real') || type.includes('decimal')) {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }

  // Boolean
  if (type.includes('bool')) {
    if (typeof val === 'boolean') return val;
    if (val === 'true' || val === '1' || val === 1) return true;
    if (val === 'false' || val === '0' || val === 0) return false;
    return null;
  }

  // JSON / JSONB
  if (type.includes('json')) {
    if (typeof val === 'object') return JSON.stringify(val);
    try {
      JSON.parse(val);
      return val;
    } catch {
      return JSON.stringify(val);
    }
  }

  return val;
}

// ---------- INSERT ROW ----------
app.post('/api/table/insert', requireAuth, getConnection, async (req, res) => {
  const { tableName, row } = req.body;
  if (!tableName || !row) return res.status(400).json({ error: 'tableName dan row diperlukan' });
  try {
    const colTypes = await getTableColumnTypes(req.conn, tableName);
    const keys = [];
    const values = [];

    for (const k of Object.keys(row)) {
      const colInfo = colTypes[k];
      const val = row[k];

      // If auto-increment / serial primary key and left blank, skip to let DB auto-generate
      if (colInfo?.pk && (val === '' || val === undefined || val === null)) {
        continue;
      }
      // If column has default and user left it completely empty, skip to use DEFAULT
      if (colInfo?.defaultVal && (val === '' || val === undefined)) {
        continue;
      }
      if (val === undefined) continue;

      keys.push(k);
      values.push(castValueForType(val, colInfo));
    }

    if (keys.length === 0) {
      if (req.conn.type === 'sqlite') {
        const sql = `INSERT INTO "${tableName}" DEFAULT VALUES`;
        const info = req.conn.adapter.db.prepare(sql).run();
        return res.json({ success: true, lastInsertRowid: info.lastInsertRowid });
      } else {
        const sql = `INSERT INTO "${tableName}" DEFAULT VALUES RETURNING *`;
        const result = await req.conn.pool.query(sql);
        return res.json({ success: true, row: result.rows[0] });
      }
    }

    if (req.conn.type === 'sqlite' || req.conn.type === 'mysql') {
      const isSqlite = req.conn.type === 'sqlite';
      const quote = isSqlite ? '"' : '`';
      const placeholders = keys.map(() => '?').join(', ');
      const cols = keys.map(k => `${quote}${k}${quote}`).join(', ');
      const sql = `INSERT INTO ${quote}${tableName}${quote} (${cols}) VALUES (${placeholders})`;
      if (isSqlite) {
        const info = req.conn.adapter.db.prepare(sql).run(...values);
        return res.json({ success: true, lastInsertRowid: info.lastInsertRowid });
      } else {
        const [info] = await req.conn.adapter.pool.query(sql, values);
        return res.json({ success: true, lastInsertRowid: info.insertId });
      }
    }

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const cols = keys.map(k => `"${k}"`).join(', ');
    const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) RETURNING *`;
    const result = await req.conn.pool.query(sql, values);
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- UPDATE CELL ----------
app.post('/api/table/update', requireAuth, getConnection, async (req, res) => {
  const { tableName, pkColumn, pkValue, column, value } = req.body;
  if (!tableName || !pkColumn || pkValue === undefined || !column) {
    return res.status(400).json({ error: 'tableName, pkColumn, pkValue, column diperlukan' });
  }
  try {
    const colTypes = await getTableColumnTypes(req.conn, tableName);
    const colInfo = colTypes[column];
    const newValue = castValueForType(value, colInfo);

    if (req.conn.type === 'sqlite') {
      const sql = `UPDATE "${tableName}" SET "${column}" = ? WHERE "${pkColumn}" = ?`;
      const info = req.conn.adapter.db.prepare(sql).run(newValue, pkValue);
      return res.json({ success: true, changes: info.changes });
    }

    const sql = `UPDATE "${tableName}" SET "${column}" = $1 WHERE "${pkColumn}" = $2`;
    const result = await req.conn.pool.query(sql, [newValue, pkValue]);
    res.json({ success: true, changes: result.rowCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- UPDATE FULL ROW (ATOMIC) ----------
app.post('/api/table/update-row', requireAuth, getConnection, async (req, res) => {
  const { tableName, primaryKeys, updates } = req.body;
  if (!tableName || !primaryKeys || !updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'tableName, primaryKeys, dan updates diperlukan' });
  }
  try {
    const colTypes = await getTableColumnTypes(req.conn, tableName);
    const pkKeys = Object.keys(primaryKeys);
    const updateKeys = Object.keys(updates).filter(k => !pkKeys.includes(k));

    if (updateKeys.length === 0) {
      return res.json({ success: true, changes: 0 });
    }

    if (req.conn.type === 'sqlite' || req.conn.type === 'mysql') {
      const isSqlite = req.conn.type === 'sqlite';
      const quote = isSqlite ? '"' : '`';
      const setClauses = updateKeys.map(k => `${quote}${k}${quote} = ?`).join(', ');
      const whereClauses = pkKeys.map(k => `${quote}${k}${quote} = ?`).join(' AND ');
      const setVals = updateKeys.map(k => castValueForType(updates[k], colTypes[k]));
      const pkVals = pkKeys.map(k => primaryKeys[k]);
      const sql = `UPDATE ${quote}${tableName}${quote} SET ${setClauses} WHERE ${whereClauses}`;
      if (isSqlite) {
        const info = req.conn.adapter.db.prepare(sql).run(...setVals, ...pkVals);
        return res.json({ success: true, changes: info.changes });
      } else {
        const [info] = await req.conn.adapter.pool.query(sql, [...setVals, ...pkVals]);
        return res.json({ success: true, changes: info.affectedRows });
      }
    }

    // PostgreSQL
    let paramIdx = 1;
    const setClauses = updateKeys.map(k => `"${k}" = $${paramIdx++}`).join(', ');
    const whereClauses = pkKeys.map(k => `"${k}" = $${paramIdx++}`).join(' AND ');
    const setVals = updateKeys.map(k => castValueForType(updates[k], colTypes[k]));
    const pkVals = pkKeys.map(k => primaryKeys[k]);

    const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClauses} RETURNING *`;
    const result = await req.conn.pool.query(sql, [...setVals, ...pkVals]);
    res.json({ success: true, changes: result.rowCount, row: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- DELETE ROW ----------
app.post('/api/table/delete-row', requireAuth, getConnection, async (req, res) => {
  const { tableName, pkColumn, pkValue, primaryKeys } = req.body;
  if (!tableName) {
    return res.status(400).json({ error: 'tableName diperlukan' });
  }
  try {
    const keysMap = primaryKeys || (pkColumn && pkValue !== undefined ? { [pkColumn]: pkValue } : null);
    if (!keysMap || Object.keys(keysMap).length === 0) {
      return res.status(400).json({ error: 'Primary key diperlukan untuk menghapus baris' });
    }

    const pkKeys = Object.keys(keysMap);
    if (req.conn.type === 'sqlite' || req.conn.type === 'mysql') {
      const isSqlite = req.conn.type === 'sqlite';
      const quote = isSqlite ? '"' : '`';
      const whereClauses = pkKeys.map(k => `${quote}${k}${quote} = ?`).join(' AND ');
      const sql = `DELETE FROM ${quote}${tableName}${quote} WHERE ${whereClauses}`;
      if (isSqlite) {
        const info = req.conn.adapter.db.prepare(sql).run(...Object.values(keysMap));
        return res.json({ success: true, changes: info.changes });
      } else {
        const [info] = await req.conn.adapter.pool.query(sql, Object.values(keysMap));
        return res.json({ success: true, changes: info.affectedRows });
      }
    }

    let paramIdx = 1;
    const whereClauses = pkKeys.map(k => `"${k}" = $${paramIdx++}`).join(' AND ');
    const sql = `DELETE FROM "${tableName}" WHERE ${whereClauses}`;
    const result = await req.conn.pool.query(sql, Object.values(keysMap));
    res.json({ success: true, changes: result.rowCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- CREATE TABLE ----------
app.post('/api/table/create', requireAuth, getConnection, async (req, res) => {
  const { tableName, columns, initialData } = req.body;
  if (!tableName || !columns || !columns.length) {
    return res.status(400).json({ error: 'tableName dan columns diperlukan' });
  }
  try {
    const colDefs = columns.map(col => {
      let def = `"${col.name}" ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (col.autoIncrement) {
        if (req.conn.type === 'sqlite') def += ' AUTOINCREMENT';
        else def = `"${col.name}" SERIAL PRIMARY KEY`;
      }
      if (col.notNull && !col.primaryKey) def += ' NOT NULL';
      if (col.defaultValue !== undefined && col.defaultValue !== '') def += ` DEFAULT ${col.defaultValue}`;
      if (col.unique && !col.primaryKey) def += ' UNIQUE';
      return def;
    });

    const sql = `CREATE TABLE "${tableName}" (${colDefs.join(', ')})`;

    if (req.conn.type === 'sqlite') {
      req.conn.adapter.db.exec(sql);
      
      // Insert initial data if provided
      if (Array.isArray(initialData) && initialData.length > 0) {
        for (const row of initialData) {
          const keys = Object.keys(row).filter(k => row[k] !== '' && row[k] !== undefined);
          if (keys.length > 0) {
            const values = keys.map(k => row[k] === null || row[k] === 'NULL' ? null : row[k]);
            const placeholders = keys.map(() => '?').join(', ');
            const cols = keys.map(k => `"${k}"`).join(', ');
            const insertSql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`;
            req.conn.adapter.db.prepare(insertSql).run(...values);
          }
        }
      }

      req.conn.tables = req.conn.adapter.getTables();
      return res.json({ success: true, tables: req.conn.tables });
    }

    await req.conn.pool.query(sql);

    // Insert initial data if provided in PG
    if (Array.isArray(initialData) && initialData.length > 0) {
      for (const row of initialData) {
        const keys = Object.keys(row).filter(k => row[k] !== '' && row[k] !== undefined);
        if (keys.length > 0) {
          const values = keys.map(k => row[k] === null || row[k] === 'NULL' ? null : row[k]);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const cols = keys.map(k => `"${k}"`).join(', ');
          const insertSql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`;
          await req.conn.pool.query(insertSql, values);
        }
      }
    }

    const tablesResult = await req.conn.pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    req.conn.tables = tablesResult.rows.map(r => r.table_name);
    res.json({ success: true, tables: req.conn.tables });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- DROP TABLE ----------
app.post('/api/table/drop', requireAuth, getConnection, async (req, res) => {
  const { tableName } = req.body;
  if (!tableName) return res.status(400).json({ error: 'tableName diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      const sql = `DROP TABLE IF EXISTS "${tableName}"`;
      req.conn.adapter.db.exec(sql);
      req.conn.tables = req.conn.adapter.getTables();
      return res.json({ success: true, tables: req.conn.tables });
    }
    if (req.conn.type === 'mysql') {
      const sql = `DROP TABLE IF EXISTS \`${tableName}\``;
      await req.conn.pool.query(sql);
      req.conn.tables = await req.conn.adapter.getTables();
      return res.json({ success: true, tables: req.conn.tables });
    }
    const sql = `DROP TABLE IF EXISTS "${tableName}"`;
    await req.conn.pool.query(sql);
    const tablesResult = await req.conn.pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    req.conn.tables = tablesResult.rows.map(r => r.table_name);
    res.json({ success: true, tables: req.conn.tables });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- ADD COLUMN ----------
app.post('/api/table/add-column', requireAuth, getConnection, async (req, res) => {
  const { tableName, columnName, columnType, notNull, defaultValue } = req.body;
  if (!tableName || !columnName || !columnType) {
    return res.status(400).json({ error: 'tableName, columnName, columnType diperlukan' });
  }
  try {
    const isMysql = req.conn.type === 'mysql';
    const q = isMysql ? '`' : '"';
    let sql = `ALTER TABLE ${q}${tableName}${q} ADD COLUMN ${q}${columnName}${q} ${columnType}`;
    if (defaultValue !== undefined && defaultValue !== '') sql += ` DEFAULT ${defaultValue}`;
    if (notNull) sql += ' NOT NULL';

    if (req.conn.type === 'sqlite') {
      req.conn.adapter.db.exec(sql);
      return res.json({ success: true });
    }
    await req.conn.pool.query(sql);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- DROP COLUMN ----------
app.post('/api/table/drop-column', requireAuth, getConnection, async (req, res) => {
  const { tableName, columnName } = req.body;
  if (!tableName || !columnName) {
    return res.status(400).json({ error: 'tableName, columnName diperlukan' });
  }
  try {
    const isMysql = req.conn.type === 'mysql';
    const q = isMysql ? '`' : '"';
    const sql = `ALTER TABLE ${q}${tableName}${q} DROP COLUMN ${q}${columnName}${q}`;
    if (req.conn.type === 'sqlite') {
      req.conn.adapter.db.exec(sql);
      return res.json({ success: true });
    }
    await req.conn.pool.query(sql);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- RENAME COLUMN ----------
app.post('/api/table/rename-column', requireAuth, getConnection, async (req, res) => {
  const { tableName, oldColumnName, newColumnName } = req.body;
  if (!tableName || !oldColumnName || !newColumnName) {
    return res.status(400).json({ error: 'tableName, oldColumnName, newColumnName diperlukan' });
  }
  if (oldColumnName === newColumnName) {
    return res.status(400).json({ error: 'Nama kolom baru tidak boleh sama dengan nama kolom lama' });
  }
  try {
    if (req.conn.type === 'sqlite') {
      const sql = `ALTER TABLE "${tableName}" RENAME COLUMN "${oldColumnName}" TO "${newColumnName}"`;
      req.conn.adapter.db.exec(sql);
      return res.json({ success: true });
    }

    if (req.conn.type === 'mysql') {
      const sql = `ALTER TABLE \`${tableName}\` RENAME COLUMN \`${oldColumnName}\` TO \`${newColumnName}\``;
      try {
        await req.conn.pool.query(sql);
      } catch (mysqlErr) {
        // Fallback for older MySQL / MariaDB using CHANGE COLUMN
        const [colInfo] = await req.conn.pool.query(
          `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [req.conn.database, tableName, oldColumnName]
        );
        if (colInfo && colInfo.length > 0) {
          const c = colInfo[0];
          let def = c.COLUMN_TYPE;
          if (c.IS_NULLABLE === 'NO') def += ' NOT NULL';
          if (c.COLUMN_DEFAULT !== null) def += ` DEFAULT '${c.COLUMN_DEFAULT}'`;
          const fallbackSql = `ALTER TABLE \`${tableName}\` CHANGE COLUMN \`${oldColumnName}\` \`${newColumnName}\` ${def}`;
          await req.conn.pool.query(fallbackSql);
        } else {
          throw mysqlErr;
        }
      }
      return res.json({ success: true });
    }

    // PostgreSQL
    const sql = `ALTER TABLE "${tableName}" RENAME COLUMN "${oldColumnName}" TO "${newColumnName}"`;
    await req.conn.pool.query(sql);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- TRUNCATE TABLE ----------
app.post('/api/table/truncate', requireAuth, getConnection, async (req, res) => {
  const { tableName } = req.body;
  if (!tableName) return res.status(400).json({ error: 'tableName diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      req.conn.adapter.db.exec(`DELETE FROM "${tableName}"`);
      return res.json({ success: true });
    }
    if (req.conn.type === 'mysql') {
      await req.conn.pool.query(`TRUNCATE TABLE \`${tableName}\``);
      return res.json({ success: true });
    }
    await req.conn.pool.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY`);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- DISCONNECT ----------
app.post('/api/disconnect', requireAuth, (req, res) => {
  const { host, port, database, user, password } = req.body;
  const key = getConnectionKey({ host, port, database, user, password });
  const conn = connections.get(key);
  if (conn) {
    if (conn.type === 'sqlite' || conn.type === 'mysql') conn.adapter.close();
    else if (conn.pool) conn.pool.end();
    connections.delete(key);
  }
  res.json({ success: true });
});

// ---------- SERVING FRONTEND FOR HOSTING (Production) ----------
const fs = require('fs');
const distPath = (() => {
  const candidates = [
    path.join(__dirname, '../frontend/dist'),
    path.join(process.cwd(), 'frontend/dist'),
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, 'dist'),
    path.join(__dirname, '../../frontend/dist'),
    path.join(process.cwd(), 'public'),
  ];
  return candidates.find(p => fs.existsSync(path.join(p, 'index.html'))) || candidates.find(p => fs.existsSync(p)) || candidates[0];
})();

const hasDistIndex = fs.existsSync(path.join(distPath, 'index.html'));

if (hasDistIndex) {
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true,
  }));
  // Catch-all: kirim index.html untuk semua route non-API (React Router SPA)
  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log('📦 Frontend static dist siap disajikan di root URL:', distPath);
} else {
  console.warn('⚠️ Folder frontend/dist/index.html belum ditemukan. Pastikan build frontend telah dijalankan (npm run build).');
  // Fallback status page informatif jika folder dist belum di-build
  app.get(/^(?!\/api).*$/, (req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>App Database — Server Aktif</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 36px; max-width: 520px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h1 { color: #818cf8; margin-top: 0; font-size: 24px; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
          code { background: #0f172a; padding: 4px 8px; border-radius: 6px; color: #38bdf8; font-size: 13px; border: 1px solid #1e293b; }
          .badge { display: inline-block; background: #10b981; color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Backend API Online</div>
          <h1>⚡ App Database Server Berjalan</h1>
          <p>Server backend telah aktif dan siap digunakan. Namun file aset antarmuka (frontend) belum selesai di-build ke folder <code>frontend/dist</code>.</p>
          <p>Untuk mengaktifkan antarmuka web, jalankan perintah:<br><code>npm run build</code></p>
          <p style="margin-top: 20px; font-size: 12px; color: #64748b;">App Database &copy; ${new Date().getFullYear()} • Dibuat oleh Fajar Wahyudi</p>
        </div>
      </body>
      </html>
    `);
  });
}

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initUserDatabase();
  } catch (dbErr) {
    console.warn('⚠️ Inisialisasi database awal mengalami kendala:', dbErr.message);
    console.warn('Aplikasi tetap melanjutkan start server agar website tidak crash.');
  }

  app.listen(PORT, () => console.log(`✅ App Database Backend running on http://localhost:${PORT}`));
}

startServer();

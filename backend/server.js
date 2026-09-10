const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Store connections (key → { type, pool/db, tables })
const connections = new Map();

function getConnectionKey({ host, port, database, user, password }) {
  return `${host}:${port}:${database}:${user}:${password}`;
}

// ============================================================
//  DEMO SQLite Database — auto-created with sample data
// ============================================================
function createDemoDB() {
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

  getTableData(tableName, limit = 200, offset = 0) {
    const total = this.db.prepare(`SELECT COUNT(*) as c FROM "${tableName}"`).get().c;
    const stmt = this.db.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`);
    const rows = stmt.all(limit, offset);
    const columns = stmt.columns();
    const fields = columns.map(c => ({ name: c.name }));
    return { rows, fields, total };
  }

  close() {
    this.db.close();
  }
}

// ============================================================
//  ROUTES
// ============================================================

// ---------- CONNECT ----------
app.post('/api/connect', async (req, res) => {
  const { host, port, database, user, password } = req.body;
  if (!host || !port || !database || !user || !password) {
    return res.status(400).json({ error: 'Semua field harus diisi' });
  }

  const key = getConnectionKey({ host, port, database, user, password });

  // --- DEMO MODE: connect to built-in SQLite ---
  if (host === 'localhost' && database === 'demo') {
    try {
      const db = createDemoDB();
      const adapter = new SQLiteAdapter(db);
      const tables = adapter.getTables();
      connections.set(key, { type: 'sqlite', adapter, tables });
      return res.json({ success: true, tables, engine: 'SQLite (Demo)' });
    } catch (err) {
      return res.status(500).json({ error: 'Demo DB error: ' + err.message });
    }
  }

  // --- REAL MODE: connect to PostgreSQL ---
  try {
    let pool;
    let connected = false;
    let firstError;

    const baseConfig = {
      host,
      port: parseInt(port),
      database,
      user,
      password,
      connectionTimeoutMillis: 10000,
    };

    // Attempt 1: no SSL
    try {
      pool = new Pool(baseConfig);
      await pool.query('SELECT 1');
      connected = true;
    } catch (err) {
      firstError = err;
      if (pool) await pool.end().catch(() => {});
      pool = null;
    }

    // Attempt 2: with SSL
    if (!connected && firstError && firstError.message && firstError.message.toLowerCase().includes('ssl')) {
      try {
        pool = new Pool({ ...baseConfig, ssl: { rejectUnauthorized: false } });
        await pool.query('SELECT 1');
        connected = true;
      } catch (err) {
        if (pool) await pool.end().catch(() => {});
        pool = null;
      }
    }

    if (!connected) throw firstError || new Error('Tidak bisa terhubung');

    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = tablesResult.rows.map(row => row.table_name);

    connections.set(key, { type: 'pg', pool, tables });
    res.json({ success: true, tables, engine: 'PostgreSQL' });
  } catch (err) {
    res.status(401).json({ error: 'Koneksi gagal: ' + err.message });
  }
});

// ---------- MIDDLEWARE ----------
function getConnection(req, res, next) {
  const { host, port, database, user, password } = req.body;
  if (!host || !port || !database || !user || !password) {
    return res.status(400).json({ error: 'Kredensial tidak lengkap' });
  }
  const key = getConnectionKey({ host, port, database, user, password });
  const conn = connections.get(key);
  if (!conn) {
    return res.status(401).json({ error: 'Koneksi tidak ditemukan, silakan koneksi ulang' });
  }
  req.conn = conn;
  next();
}

// ---------- QUERY ----------
app.post('/api/query', getConnection, async (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'Query SQL diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      const result = req.conn.adapter.query(sql);
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
app.post('/api/table', getConnection, async (req, res) => {
  const { tableName } = req.body;
  if (!tableName) return res.status(400).json({ error: 'Nama tabel diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      return res.json(req.conn.adapter.getTableStructure(tableName));
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
app.post('/api/table/data', getConnection, async (req, res) => {
  const { tableName, limit = 200, offset = 0, orderBy, orderDir = 'ASC' } = req.body;
  if (!tableName) return res.status(400).json({ error: 'Nama tabel diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      return res.json(req.conn.adapter.getTableData(tableName, limit, offset));
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

    const result = await req.conn.pool.query(
      `SELECT * FROM "${tableName}" ${orderClause} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const fields = result.fields ? result.fields.map(f => ({ name: f.name })) : [];
    res.json({ rows: result.rows, fields, total });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- REFRESH TABLE LIST ----------
app.post('/api/tables', getConnection, async (req, res) => {
  try {
    if (req.conn.type === 'sqlite') {
      const tables = req.conn.adapter.getTables();
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
  if (conn.type === 'sqlite') {
    const struct = conn.adapter.getTableStructure(tableName);
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
app.post('/api/table/insert', getConnection, async (req, res) => {
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

    if (req.conn.type === 'sqlite') {
      const placeholders = keys.map(() => '?').join(', ');
      const cols = keys.map(k => `"${k}"`).join(', ');
      const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`;
      const info = req.conn.adapter.db.prepare(sql).run(...values);
      return res.json({ success: true, lastInsertRowid: info.lastInsertRowid });
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
app.post('/api/table/update', getConnection, async (req, res) => {
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
app.post('/api/table/update-row', getConnection, async (req, res) => {
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

    if (req.conn.type === 'sqlite') {
      const setClauses = updateKeys.map(k => `"${k}" = ?`).join(', ');
      const whereClauses = pkKeys.map(k => `"${k}" = ?`).join(' AND ');
      const setVals = updateKeys.map(k => castValueForType(updates[k], colTypes[k]));
      const pkVals = pkKeys.map(k => primaryKeys[k]);
      const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClauses}`;
      const info = req.conn.adapter.db.prepare(sql).run(...setVals, ...pkVals);
      return res.json({ success: true, changes: info.changes });
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
app.post('/api/table/delete-row', getConnection, async (req, res) => {
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
    if (req.conn.type === 'sqlite') {
      const whereClauses = pkKeys.map(k => `"${k}" = ?`).join(' AND ');
      const sql = `DELETE FROM "${tableName}" WHERE ${whereClauses}`;
      const info = req.conn.adapter.db.prepare(sql).run(...Object.values(keysMap));
      return res.json({ success: true, changes: info.changes });
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
app.post('/api/table/create', getConnection, async (req, res) => {
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
app.post('/api/table/drop', getConnection, async (req, res) => {
  const { tableName } = req.body;
  if (!tableName) return res.status(400).json({ error: 'tableName diperlukan' });
  try {
    const sql = `DROP TABLE IF EXISTS "${tableName}"`;
    if (req.conn.type === 'sqlite') {
      req.conn.adapter.db.exec(sql);
      req.conn.tables = req.conn.adapter.getTables();
      return res.json({ success: true, tables: req.conn.tables });
    }
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
app.post('/api/table/add-column', getConnection, async (req, res) => {
  const { tableName, columnName, columnType, notNull, defaultValue } = req.body;
  if (!tableName || !columnName || !columnType) {
    return res.status(400).json({ error: 'tableName, columnName, columnType diperlukan' });
  }
  try {
    let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`;
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
app.post('/api/table/drop-column', getConnection, async (req, res) => {
  const { tableName, columnName } = req.body;
  if (!tableName || !columnName) {
    return res.status(400).json({ error: 'tableName, columnName diperlukan' });
  }
  try {
    const sql = `ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`;
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

// ---------- TRUNCATE TABLE ----------
app.post('/api/table/truncate', getConnection, async (req, res) => {
  const { tableName } = req.body;
  if (!tableName) return res.status(400).json({ error: 'tableName diperlukan' });
  try {
    if (req.conn.type === 'sqlite') {
      req.conn.adapter.db.exec(`DELETE FROM "${tableName}"`);
      return res.json({ success: true });
    }
    await req.conn.pool.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY`);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- DISCONNECT ----------
app.post('/api/disconnect', (req, res) => {
  const { host, port, database, user, password } = req.body;
  const key = getConnectionKey({ host, port, database, user, password });
  const conn = connections.get(key);
  if (conn) {
    if (conn.type === 'sqlite') conn.adapter.close();
    else if (conn.pool) conn.pool.end();
    connections.delete(key);
  }
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ App Database Backend running on http://localhost:${PORT}`));

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { parseDatabaseUri } = require('../utils/dbUriParser');

let Database = null;
try {
  Database = require('better-sqlite3');
} catch (err) {
  // better-sqlite3 not available (common on shared cPanel hosting without C++ build tools)
  Database = null;
}

let dbClient = null;
let currentDbType = 'sqlite'; // 'postgres' | 'mysql' | 'sqlite' | 'file'

// -----------------------------------------------------------------------------
// Pure-JS JSON File Database Adapter (Zero-Dependency Fallback)
// Ensures application NEVER crashes if neither native SQLite nor external DB is available
// -----------------------------------------------------------------------------
class JsonFileDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      users: [],
      user_connections: [],
      user_saved_queries: [],
      user_settings: [],
      user_audit_logs: [],
      _counters: {
        users: 0,
        user_connections: 0,
        user_saved_queries: 0,
        user_settings: 0,
        user_audit_logs: 0,
      },
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      } else {
        this.save();
      }
    } catch (err) {
      console.warn('⚠️ Gagal membaca file database JSON, menginisialisasi baru:', err.message);
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tempPath = this.filePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('❌ Gagal menyimpan database file JSON:', err.message);
    }
  }

  nextId(table) {
    if (!this.data._counters) this.data._counters = {};
    if (!this.data._counters[table]) {
      const existing = (this.data[table] || []).map(r => Number(r.id) || 0);
      this.data._counters[table] = existing.length > 0 ? Math.max(...existing) : 0;
    }
    this.data._counters[table] += 1;
    return this.data._counters[table];
  }

  query(sql, params = []) {
    const trimmed = sql.trim().replace(/\s+/g, ' ');
    const lower = trimmed.toLowerCase();

    // 1. SELECT COUNT(*)
    if (lower.startsWith('select count(*)')) {
      const match = lower.match(/from\s+([a-z_]+)\s+where\s+user_id\s*=\s*\?/);
      if (match) {
        const table = match[1];
        const userId = Number(params[0]);
        const list = this.data[table] || [];
        const count = list.filter(r => Number(r.user_id) === userId).length;
        return { rows: [{ total: count, count }], rowCount: 1, insertId: null };
      }
    }

    // 2. SELECT FROM users
    if (lower.startsWith('select') && lower.includes('from users')) {
      const users = this.data.users || [];
      if (lower.includes('where email = ?')) {
        const email = String(params[0]).toLowerCase();
        const found = users.filter(u => String(u.email || '').toLowerCase() === email);
        return { rows: JSON.parse(JSON.stringify(found)), rowCount: found.length, insertId: null };
      }
      if (lower.includes('where id = ?')) {
        const id = Number(params[0]);
        const found = users.filter(u => Number(u.id) === id);
        return { rows: JSON.parse(JSON.stringify(found)), rowCount: found.length, insertId: null };
      }
      return { rows: JSON.parse(JSON.stringify(users)), rowCount: users.length, insertId: null };
    }

    // 3. SELECT FROM user_connections
    if (lower.startsWith('select') && lower.includes('from user_connections')) {
      const conns = this.data.user_connections || [];
      if (lower.includes('where id = ? and user_id = ?')) {
        const id = Number(params[0]);
        const userId = Number(params[1]);
        const found = conns.filter(c => Number(c.id) === id && Number(c.user_id) === userId);
        return { rows: JSON.parse(JSON.stringify(found)), rowCount: found.length, insertId: null };
      }
      if (lower.includes('where user_id = ?')) {
        const userId = Number(params[0]);
        const found = conns
          .filter(c => Number(c.user_id) === userId)
          .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
        return { rows: JSON.parse(JSON.stringify(found)), rowCount: found.length, insertId: null };
      }
      return { rows: JSON.parse(JSON.stringify(conns)), rowCount: conns.length, insertId: null };
    }

    // 4. SELECT FROM user_saved_queries
    if (lower.startsWith('select') && lower.includes('from user_saved_queries')) {
      const list = this.data.user_saved_queries || [];
      if (lower.includes('where user_id = ?')) {
        const userId = Number(params[0]);
        const found = list
          .filter(q => Number(q.user_id) === userId)
          .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
        return { rows: JSON.parse(JSON.stringify(found)), rowCount: found.length, insertId: null };
      }
      return { rows: JSON.parse(JSON.stringify(list)), rowCount: list.length, insertId: null };
    }

    // 5. SELECT FROM user_settings
    if (lower.startsWith('select') && lower.includes('from user_settings')) {
      const list = this.data.user_settings || [];
      if (lower.includes('where user_id = ? and setting_key = ?')) {
        const userId = Number(params[0]);
        const key = String(params[1]);
        const found = list.filter(s => Number(s.user_id) === userId && s.setting_key === key);
        return { rows: JSON.parse(JSON.stringify(found)), rowCount: found.length, insertId: null };
      }
      if (lower.includes('where user_id = ?')) {
        const userId = Number(params[0]);
        const found = list.filter(s => Number(s.user_id) === userId);
        return { rows: JSON.parse(JSON.stringify(found)), rowCount: found.length, insertId: null };
      }
      return { rows: JSON.parse(JSON.stringify(list)), rowCount: list.length, insertId: null };
    }

    // 6. SELECT FROM user_audit_logs
    if (lower.startsWith('select') && lower.includes('from user_audit_logs')) {
      const logs = this.data.user_audit_logs || [];
      if (lower.includes('where user_id = ?')) {
        const userId = Number(params[0]);
        const limitMatch = lower.match(/limit\s+(\d+)/);
        const limit = limitMatch ? parseInt(limitMatch[1], 10) : 20;
        const found = logs
          .filter(l => Number(l.user_id) === userId)
          .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
          .slice(0, limit);
        return { rows: JSON.parse(JSON.stringify(found)), rowCount: found.length, insertId: null };
      }
      return { rows: JSON.parse(JSON.stringify(logs)), rowCount: logs.length, insertId: null };
    }

    // 7. INSERT INTO
    if (lower.startsWith('insert into')) {
      const tableMatch = lower.match(/^insert into\s+([a-z_]+)\s*\(([^)]+)\)/);
      if (tableMatch) {
        const table = tableMatch[1];
        const cols = tableMatch[2].split(',').map(c => c.trim().toLowerCase());
        const newId = this.nextId(table);
        const record = { id: newId };
        cols.forEach((col, idx) => {
          record[col] = params[idx] !== undefined ? params[idx] : null;
        });
        if (!record.created_at) record.created_at = new Date().toISOString();
        if (!record.updated_at) record.updated_at = new Date().toISOString();
        if (!this.data[table]) this.data[table] = [];
        this.data[table].push(record);
        this.save();
        return { rows: [record], rowCount: 1, insertId: newId };
      }
    }

    // 8. UPDATE users
    if (lower.startsWith('update users')) {
      const users = this.data.users || [];
      let updatedCount = 0;
      const whereIdMatch = lower.match(/where id\s*=\s*\?$/);
      if (whereIdMatch) {
        const targetId = Number(params[params.length - 1]);
        const user = users.find(u => Number(u.id) === targetId);
        if (user) {
          if (lower.includes('set verification_code = null')) {
            user.verification_code = null;
          }
          if (lower.includes('set verification_attempts = ?')) {
            user.verification_attempts = Number(params[0]);
          }
          if (lower.includes('is_verified = 1')) {
            user.is_verified = 1;
          }
          if (lower.includes('last_login_at = ?')) {
            user.last_login_at = params[0] || new Date().toISOString();
          }
          if (lower.includes('password_hash = ?')) {
            user.password_hash = params[0];
          }
          if (lower.includes('verification_code = ?')) {
            const codeIdx = params.indexOf(params.find(p => typeof p === 'string' && p.length === 6));
            if (codeIdx !== -1) user.verification_code = params[codeIdx];
          }
          user.updated_at = new Date().toISOString();
          updatedCount++;
          this.save();
        }
      }
      return { rows: [], rowCount: updatedCount, insertId: null };
    }

    // 9. UPDATE user_connections
    if (lower.startsWith('update user_connections')) {
      const conns = this.data.user_connections || [];
      const targetId = Number(params[params.length - 2]);
      const targetUserId = Number(params[params.length - 1]);
      const conn = conns.find(c => Number(c.id) === targetId && Number(c.user_id) === targetUserId);
      let updatedCount = 0;
      if (conn) {
        conn.name = params[0];
        conn.type = params[1];
        conn.host = params[2];
        conn.port = params[3];
        conn.database_name = params[4];
        conn.username = params[5];
        if (params[6]) conn.encrypted_password = params[6];
        conn.connection_string = params[7];
        conn.ssl = params[8];
        conn.updated_at = new Date().toISOString();
        updatedCount++;
        this.save();
      }
      return { rows: [], rowCount: updatedCount, insertId: null };
    }

    // 10. UPDATE user_settings
    if (lower.startsWith('update user_settings')) {
      const list = this.data.user_settings || [];
      const val = params[0];
      const userId = Number(params[params.length - 2]);
      const key = params[params.length - 1];
      const setting = list.find(s => Number(s.user_id) === userId && s.setting_key === key);
      let updatedCount = 0;
      if (setting) {
        setting.setting_value = val;
        setting.updated_at = new Date().toISOString();
        updatedCount++;
        this.save();
      }
      return { rows: [], rowCount: updatedCount, insertId: null };
    }

    // 11. DELETE FROM user_connections
    if (lower.startsWith('delete from user_connections')) {
      const conns = this.data.user_connections || [];
      const targetId = Number(params[0]);
      const targetUserId = Number(params[1]);
      const beforeLen = conns.length;
      this.data.user_connections = conns.filter(c => !(Number(c.id) === targetId && Number(c.user_id) === targetUserId));
      const deleted = beforeLen - this.data.user_connections.length;
      if (deleted > 0) this.save();
      return { rows: [], rowCount: deleted, insertId: null };
    }

    // 12. DELETE FROM user_saved_queries
    if (lower.startsWith('delete from user_saved_queries')) {
      const list = this.data.user_saved_queries || [];
      const targetId = Number(params[0]);
      const targetUserId = Number(params[1]);
      const beforeLen = list.length;
      this.data.user_saved_queries = list.filter(q => !(Number(q.id) === targetId && Number(q.user_id) === targetUserId));
      const deleted = beforeLen - this.data.user_saved_queries.length;
      if (deleted > 0) this.save();
      return { rows: [], rowCount: deleted, insertId: null };
    }

    return { rows: [], rowCount: 0, insertId: null };
  }
}

/**
 * Initialize the user database connection
 * Order of priority:
 * 1. Supabase / PostgreSQL URI or Configuration
 * 2. MySQL / MariaDB Configuration
 * 3. Local SQLite (Zero configuration needed)
 * 4. Pure-JS JSON File DB (Ensures app NEVER crashes on restricted hosting)
 */
async function initUserDatabase() {
  const rawDbUrl = (
    process.env.DATABASE_URL ||
    process.env.DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    (process.env.SUPABASE_URL && process.env.SUPABASE_URL.includes('://') && !process.env.SUPABASE_URL.startsWith('http') ? process.env.SUPABASE_URL : '') ||
    ''
  ).trim();

  const dbType = (process.env.DB_TYPE || '').toLowerCase().trim();
  const dbHost = (process.env.DB_HOST || '').toLowerCase().trim();

  const isPostgresUrl = rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://');
  const isPostgresConfig = dbType === 'postgres' || dbType === 'postgresql' || isPostgresUrl || dbHost.includes('supabase') || dbHost.includes('neon.tech');

  // ===========================================================================
  // 1. POSTGRESQL / SUPABASE INITIALIZATION
  // ===========================================================================
  if (isPostgresConfig) {
    console.log('🐘 Menghubungkan database pengguna ke PostgreSQL / Supabase...');

    let parsed = rawDbUrl ? parseDatabaseUri(rawDbUrl) : null;
    const host = (parsed ? parsed.host : process.env.DB_HOST) || 'localhost';
    let port = (parsed ? parsed.port : parseInt(process.env.DB_PORT || '5432')) || 5432;
    const database = (parsed ? parsed.database : process.env.DB_NAME) || 'postgres';
    const user = (parsed ? parsed.user : process.env.DB_USER) || 'postgres';
    const password = (parsed ? parsed.password : process.env.DB_PASSWORD) || '';

    // Smart SSL Detection: Supabase, Neon, and cloud PostgreSQL ALWAYS require SSL
    const isCloudHost = /supabase|neon\.tech|pooler|render\.com|railway\.app|aivencloud|aws|azure/i.test(host || rawDbUrl);
    const requiresSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === 'require' || isCloudHost || (rawDbUrl && !/localhost|127\.0\.0\.1/i.test(rawDbUrl));

    const poolSettings = {
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 12000,
    };

    // Connection attempt configurations: try with SSL first for cloud hosts
    const configsToTry = [];
    if (rawDbUrl) {
      if (requiresSsl) {
        configsToTry.push({ connectionString: rawDbUrl, ssl: { rejectUnauthorized: false }, ...poolSettings });
        configsToTry.push({ connectionString: rawDbUrl, ssl: false, ...poolSettings });
      } else {
        configsToTry.push({ connectionString: rawDbUrl, ssl: false, ...poolSettings });
        configsToTry.push({ connectionString: rawDbUrl, ssl: { rejectUnauthorized: false }, ...poolSettings });
      }
    } else {
      const baseObj = { host, port, database, user, password, ...poolSettings };
      if (requiresSsl) {
        configsToTry.push({ ...baseObj, ssl: { rejectUnauthorized: false } });
        configsToTry.push({ ...baseObj, ssl: false });
      } else {
        configsToTry.push({ ...baseObj, ssl: false });
        configsToTry.push({ ...baseObj, ssl: { rejectUnauthorized: false } });
      }
    }

    let connected = false;
    let pool = null;
    let lastErr = null;

    for (const conf of configsToTry) {
      try {
        pool = new Pool(conf);
        await pool.query('SELECT 1');
        connected = true;
        break;
      } catch (err) {
        lastErr = err;
        if (pool) {
          await pool.end().catch(() => {});
          pool = null;
        }
      }
    }

    // Supabase Pooler Fallback: If port 5432 fails due to max connections or session mode, try port 6543
    if (!connected && isCloudHost && (port === 5432 || (rawDbUrl && rawDbUrl.includes(':5432')))) {
      try {
        console.log('⚡ Mencoba koneksi Supabase Transaction Pooler (port 6543)...');
        const altUrl = rawDbUrl ? rawDbUrl.replace(':5432', ':6543') : null;
        const altConf = altUrl
          ? { connectionString: altUrl, ssl: { rejectUnauthorized: false }, ...poolSettings }
          : { host, port: 6543, database, user, password, ssl: { rejectUnauthorized: false }, ...poolSettings };

        pool = new Pool(altConf);
        await pool.query('SELECT 1');
        connected = true;
        console.log('✅ Berhasil terhubung ke Supabase via Transaction Pooler port 6543!');
      } catch (altErr) {
        lastErr = altErr;
        if (pool) {
          await pool.end().catch(() => {});
          pool = null;
        }
      }
    }

    if (connected && pool) {
      dbClient = pool;
      currentDbType = 'postgres';
      console.log('✅ Berhasil terhubung ke database pengguna PostgreSQL / Supabase!');
      await createPostgresTables(pool);
      return;
    } else {
      console.warn('⚠️ Gagal terhubung ke PostgreSQL/Supabase (' + (lastErr ? lastErr.message : 'Unknown error') + '). Beralih ke penyimpanan lokal otomatis.');
    }
  }

  // ===========================================================================
  // 2. MYSQL / MARIADB INITIALIZATION
  // ===========================================================================
  const isMysqlUrl = rawDbUrl.startsWith('mysql://');
  const isMysqlConfig = (dbType === 'mysql' || isMysqlUrl) && (process.env.DB_USER || isMysqlUrl);

  if (isMysqlConfig) {
    try {
      const mysql = require('mysql2/promise');
      console.log('🐬 Menghubungkan database pengguna ke MySQL...');
      const config = rawDbUrl || {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        database: process.env.DB_NAME || 'app_database_users',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 10000,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      };

      const pool = mysql.createPool(config);
      await pool.query('SELECT 1');
      dbClient = pool;
      currentDbType = 'mysql';
      console.log('✅ Berhasil terhubung ke database pengguna MySQL!');
      await createMysqlTables(pool);
      return;
    } catch (err) {
      console.warn('⚠️ Gagal terhubung ke MySQL pengguna (' + err.message + '). Beralih ke penyimpanan lokal otomatis.');
    }
  }

  // ===========================================================================
  // 3. ZERO-CONFIG FALLBACK: SQLite (better-sqlite3)
  // ===========================================================================
  if (Database) {
    try {
      const sqlitePath = path.join(__dirname, '../../users_data.db');
      const sqlite = new Database(sqlitePath);
      sqlite.pragma('journal_mode = WAL');
      dbClient = sqlite;
      currentDbType = 'sqlite';
      console.log(`📁 Menggunakan database pengguna SQLite lokal otomatis (${sqlitePath})`);
      createSqliteTables(sqlite);
      return;
    } catch (err) {
      console.warn('⚠️ Gagal menginisialisasi SQLite native (' + err.message + '). Beralih ke penyimpanan file JSON.');
    }
  }

  // ===========================================================================
  // 4. ZERO-CONFIG ULTRA-FALLBACK: Pure-JS JSON File Database
  // Guaranteed to run everywhere on any hosting with zero C++ compilation
  // ===========================================================================
  try {
    const jsonPath = path.join(__dirname, '../../users_data.json');
    const jsonDb = new JsonFileDatabase(jsonPath);
    dbClient = jsonDb;
    currentDbType = 'file';
    console.log(`📁 Menggunakan database file pengguna lokal otomatis (${jsonPath})`);
    console.log('✅ Seluruh skema tabel lokal siap digunakan.');
  } catch (err) {
    console.error('❌ Gagal menginisialisasi penyimpanan database lokal:', err.message);
    dbClient = null;
  }
}

/**
 * Universal Query Runner with automatic parameter placeholder conversion
 * Input uses '?' for placeholders.
 * If PostgreSQL: automatically converts '?' to $1, $2, $3 and appends RETURNING id for INSERT
 */
async function query(sql, params = []) {
  if (!dbClient) {
    throw new Error('Database pengguna belum siap. Periksa konfigurasi database di file .env.');
  }

  if (currentDbType === 'postgres') {
    let paramIndex = 1;
    let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

    // If INSERT INTO without RETURNING, append RETURNING id so insertId is always available
    if (/^\s*INSERT\s+INTO/i.test(pgSql) && !/\bRETURNING\b/i.test(pgSql)) {
      pgSql += ' RETURNING id';
    }

    const res = await dbClient.query(pgSql, params);
    return {
      rows: res.rows || [],
      rowCount: res.rowCount || 0,
      insertId: res.rows && res.rows[0] && res.rows[0].id ? Number(res.rows[0].id) : null,
    };
  }

  if (currentDbType === 'mysql') {
    const [rows, fields] = await dbClient.query(sql, params);
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: rows.affectedRows || (Array.isArray(rows) ? rows.length : 0),
      insertId: rows.insertId || null,
    };
  }

  if (currentDbType === 'sqlite') {
    const trimmed = sql.trim();
    const isSelect = /^(SELECT|PRAGMA|WITH|EXPLAIN)/i.test(trimmed);
    if (isSelect) {
      const stmt = dbClient.prepare(trimmed);
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length, insertId: null };
    } else {
      const stmt = dbClient.prepare(trimmed);
      const info = stmt.run(...params);
      return { rows: [], rowCount: info.changes, insertId: Number(info.lastInsertRowid) };
    }
  }

  if (currentDbType === 'file') {
    return dbClient.query(sql, params);
  }
}

// -----------------------------------------------------------------------------
// Table Creation & Auto-Migration Scripts
// -----------------------------------------------------------------------------

async function createPostgresTables(pool) {
  // 1. Create tables with cross-compatible types
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT,
      name VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      auth_provider VARCHAR(50) DEFAULT 'local',
      google_id VARCHAR(255),
      is_verified SMALLINT DEFAULT 0,
      verification_code VARCHAR(20),
      verification_code_expires_at TIMESTAMP,
      verification_attempts INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_connections (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) DEFAULT 'postgres',
      host VARCHAR(255),
      port INTEGER,
      database_name VARCHAR(255),
      username VARCHAR(255),
      encrypted_password TEXT,
      connection_string TEXT,
      ssl SMALLINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_saved_queries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      query_sql TEXT NOT NULL,
      connection_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      setting_key VARCHAR(100) NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_user_setting UNIQUE (user_id, setting_key)
    );

    CREATE TABLE IF NOT EXISTS user_audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(100),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_connections_user ON user_connections(user_id);
    CREATE INDEX IF NOT EXISTS idx_queries_user ON user_saved_queries(user_id);
  `);

  // 2. Safe Auto-Migration: If columns were previously created as BOOLEAN, convert them to SMALLINT so integer 0/1 never errors
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_verified' AND data_type='boolean') THEN
          ALTER TABLE users ALTER COLUMN is_verified TYPE SMALLINT USING (CASE WHEN is_verified THEN 1 ELSE 0 END);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_connections' AND column_name='ssl' AND data_type='boolean') THEN
          ALTER TABLE user_connections ALTER COLUMN ssl TYPE SMALLINT USING (CASE WHEN ssl THEN 1 ELSE 0 END);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `);
  } catch (migErr) {
    // Ignore migration warnings
  }

  // 3. Ensure all columns exist for existing tables
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
      ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS connection_string TEXT;
      ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS ssl SMALLINT DEFAULT 0;
    `);
  } catch (colErr) {
    // Ignore column add warnings
  }

  console.log('✅ Skema tabel PostgreSQL / Supabase siap.');
}

async function createMysqlTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT,
      name VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      auth_provider VARCHAR(50) DEFAULT 'local',
      google_id VARCHAR(255),
      is_verified TINYINT(1) DEFAULT 0,
      verification_code VARCHAR(20),
      verification_code_expires_at DATETIME,
      verification_attempts INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login_at DATETIME,
      INDEX idx_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_connections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) DEFAULT 'postgres',
      host VARCHAR(255),
      port INT,
      database_name VARCHAR(255),
      username VARCHAR(255),
      encrypted_password TEXT,
      connection_string TEXT,
      ssl TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_connections_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_saved_queries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      query_sql TEXT NOT NULL,
      connection_name VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_queries_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      setting_key VARCHAR(100) NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_setting (user_id, setting_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(100),
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Skema tabel MySQL siap.');
}

function createSqliteTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      auth_provider TEXT DEFAULT 'local',
      google_id TEXT,
      is_verified INTEGER DEFAULT 0,
      verification_code TEXT,
      verification_code_expires_at TEXT,
      verification_attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'postgres',
      host TEXT,
      port INTEGER,
      database_name TEXT,
      username TEXT,
      encrypted_password TEXT,
      connection_string TEXT,
      ssl INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_saved_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      query_sql TEXT NOT NULL,
      connection_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      setting_key TEXT NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, setting_key)
    );

    CREATE TABLE IF NOT EXISTS user_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_connections_user ON user_connections(user_id);
    CREATE INDEX IF NOT EXISTS idx_queries_user ON user_saved_queries(user_id);
  `);
  console.log('✅ Skema tabel SQLite siap.');
}

function getDbType() {
  return currentDbType;
}

module.exports = {
  initUserDatabase,
  query,
  getDbType,
};

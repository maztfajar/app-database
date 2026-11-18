/**
 * ==============================================================================
 *  APP DATABASE — Example Database Seeder Script (PostgreSQL & MySQL)
 * ==============================================================================
 *  Usage:
 *    node examples/seed.js --type postgres --host localhost --port 5432 --user postgres --database my_db
 *    node examples/seed.js --type postgres --uri "postgresql://postgres:password@localhost:5432/my_db"
 *    node examples/seed.js --type mysql --host localhost --port 3306 --user root --password secret --database my_db
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    type: 'postgres',
    host: 'localhost',
    port: null,
    user: null,
    password: '',
    database: null,
    uri: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--type' && args[i + 1]) params.type = args[++i].toLowerCase();
    else if (arg === '--host' && args[i + 1]) params.host = args[++i];
    else if (arg === '--port' && args[i + 1]) params.port = parseInt(args[++i], 10);
    else if (arg === '--user' && args[i + 1]) params.user = args[++i];
    else if (arg === '--password' && args[i + 1]) params.password = args[++i];
    else if (arg === '--database' && args[i + 1]) params.database = args[++i];
    else if (arg === '--uri' && args[i + 1]) params.uri = args[++i];
  }

  if (params.uri) {
    try {
      const parsed = new URL(params.uri);
      params.type = parsed.protocol.replace(':', '').includes('mysql') ? 'mysql' : 'postgres';
      params.host = parsed.hostname;
      params.port = parsed.port ? parseInt(parsed.port, 10) : (params.type === 'mysql' ? 3306 : 5432);
      params.user = decodeURIComponent(parsed.username || '');
      params.password = decodeURIComponent(parsed.password || '');
      params.database = decodeURIComponent(parsed.pathname.replace(/^\//, '') || '');
    } catch (e) {
      console.warn('⚠️ Gagal mem-parse URI, menggunakan parameter individual.');
    }
  }

  if (!params.port) {
    params.port = params.type === 'mysql' ? 3306 : (params.type === 'sqlite' ? 0 : 5432);
  }
  if (!params.user) {
    params.user = params.type === 'mysql' ? 'root' : (params.type === 'sqlite' ? 'local' : 'postgres');
  }
  if (!params.database) {
    params.database = params.type === 'sqlite' ? 'demo.db' : 'example_db';
  }

  return params;
}

async function seedSQLite(config) {
  let Database = null;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    try {
      Database = require('../backend/node_modules/better-sqlite3');
    } catch (e2) {
      throw new Error('Modul better-sqlite3 tidak ditemukan.');
    }
  }

  const dbPath = path.isAbsolute(config.database)
    ? config.database
    : path.join(__dirname, '..', config.database.endsWith('.db') ? config.database : `${config.database}.db`);

  console.log(`🔌 Membuka database SQLite lokal: ${dbPath}...`);
  const db = Database(dbPath);
  db.pragma('journal_mode = WAL');

  const sqlFile = path.join(__dirname, 'postgres_example.sql');
  let sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Konversi syntax postgres ke sqlite ringan
  sqlContent = sqlContent
    .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP/g, "TEXT DEFAULT (datetime('now'))")
    .replace(/TIMESTAMP WITH TIME ZONE/g, 'TEXT')
    .replace(/NUMERIC\([^)]+\)/g, 'REAL')
    .replace(/JSONB/g, 'TEXT')
    .replace(/BOOLEAN/g, 'INTEGER')
    .replace(/DROP TABLE IF EXISTS ([a-zA-Z0-9_]+) CASCADE;/g, 'DROP TABLE IF EXISTS "$1";');

  console.log('🚀 Menjalankan inisialisasi tabel dan data SQLite...');
  db.exec(sqlContent);
  console.log('✅ Skema dan data contoh SQLite BERHASIL dibuat!');

  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
  console.log('\n📋 Daftar Tabel yang Berhasil Dibuat:');
  tables.forEach(t => console.log(`   • ${t.name}`));
  console.log(`\n🎉 Total: ${tables.length} tabel siap digunakan langsung di App Database!\n`);
  db.close();
}

async function seedPostgres(config) {
  const { Pool } = require('pg');
  const sqlFile = path.join(__dirname, 'postgres_example.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  console.log(`🔌 Menghubungkan ke PostgreSQL: ${config.host}:${config.port}/${config.database} (user: ${config.user})...`);

  // Pertama coba konek ke maintenance db 'postgres' untuk pastikan target database sudah ada
  const adminPool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });

  try {
    const checkDb = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database]
    );
    if (checkDb.rows.length === 0) {
      console.log(`✨ Membuat database "${config.database}"...`);
      await adminPool.query(`CREATE DATABASE "${config.database}"`);
    }
  } catch (err) {
    console.warn('ℹ️ Pemeriksaan database admin dilewati (mungkin sudah ada atau hak akses terbatas):', err.message);
  } finally {
    await adminPool.end().catch(() => {});
  }

  // Konek ke database target dan jalankan seeder
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  try {
    console.log('🚀 Menjalankan skrip seeder postgres_example.sql...');
    await pool.query(sqlContent);
    console.log('✅ Skema dan data contoh PostgreSQL BERHASIL di-load!');
    
    // Verifikasi tabel
    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log('\n📋 Daftar Tabel yang Berhasil Dibuat:');
    tablesRes.rows.forEach(r => console.log(`   • ${r.table_name}`));
    console.log(`\n🎉 Total: ${tablesRes.rows.length} tabel siap digunakan di App Database!\n`);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function seedMySQL(config) {
  const mysql = require('mysql2/promise');
  const sqlFile = path.join(__dirname, 'mysql_example.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  console.log(`🔌 Menghubungkan ke MySQL: ${config.host}:${config.port} (user: ${config.user})...`);

  // Konek ke server MySQL tanpa database terlebih dahulu untuk CREATE DATABASE IF NOT EXISTS
  const adminConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
  });

  try {
    console.log(`✨ Memastikan database \`${config.database}\` ada...`);
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` DEFAULT CHARACTER SET utf8mb4;`);
  } finally {
    await adminConn.end().catch(() => {});
  }

  // Konek ke database target dengan multipleStatements = true
  const pool = await mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    multipleStatements: true,
  });

  try {
    console.log('🚀 Menjalankan skrip seeder mysql_example.sql...');
    await pool.query(sqlContent);
    console.log('✅ Skema dan data contoh MySQL BERHASIL di-load!');

    const [rows] = await pool.query(
      `SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [config.database]
    );
    console.log('\n📋 Daftar Tabel yang Berhasil Dibuat:');
    rows.forEach(r => console.log(`   • ${r.name}`));
    console.log(`\n🎉 Total: ${rows.length} tabel siap digunakan di App Database!\n`);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  const config = parseArgs();
  console.log('====================================================');
  console.log('📦 App Database — Example Database Seeder');
  console.log('====================================================');
  console.log(`Tipe Engine: ${config.type.toUpperCase()}`);
  console.log(`Target DB  : ${config.database}`);

  try {
    if (config.type === 'sqlite') {
      await seedSQLite(config);
    } else if (config.type === 'mysql') {
      await seedMySQL(config);
    } else {
      await seedPostgres(config);
    }
  } catch (err) {
    console.log('');
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      console.error(`❌ Gagal terhubung ke port ${config.port} di ${config.host} (ECONNREFUSED).`);
      console.error(`----------------------------------------------------`);
      console.error(`🔍 PENYEBAB:`);
      console.error(`   Layanan server ${config.type.toUpperCase()} belum aktif / tidak berjalan di port ${config.port}.`);
      console.error(`   Perintah seeder ini menghubungkan ke database yang sudah hidup,`);
      console.error(`   bukan membuat server baru di sistem operasi Anda.`);
      console.error(`----------------------------------------------------`);
      console.error(`💡 SOLUSI PILIHAN:`);
      console.error(`   1. Jika menggunakan MySQL lokal, nyalakan servis MySQL terlebih dahulu:`);
      console.error(`      • XAMPP/Laragon: Klik 'Start' pada modul MySQL`);
      console.error(`      • Docker: docker run --name mysql-dev -e MYSQL_ROOT_PASSWORD=rahasia -p 3306:3306 -d mysql:8`);
      console.error(`      • Linux Service: sudo systemctl start mysql`);
      console.error(`   2. Gunakan database cloud gratis (Aiven / Clever-Cloud / Supabase / Neon):`);
      console.error(`      node examples/seed.js --uri "mysql://user:pass@host:port/dbname"`);
      console.error(`   3. Gunakan mode SQLite lokal tanpa perlu server / port (LANGSUNG JALAN):`);
      console.error(`      node examples/seed.js --type sqlite`);
      console.error(`----------------------------------------------------\n`);
    } else {
      console.error('❌ Terjadi kesalahan saat seeding database:', err.message);
    }
    process.exit(1);
  }
}

main();

const express = require('express');
const router = express.Router();
const userDb = require('../db/userDb');
const { requireAuth } = require('../middleware/auth');
const { encryptData, decryptData } = require('../utils/security');

// Apply requireAuth to all user routes: multi-tenant isolation guaranteed!
router.use(requireAuth);

// -----------------------------------------------------------------------------
// USER CONNECTIONS (CRUD with AES-256-GCM Encryption)
// -----------------------------------------------------------------------------

/**
 * GET /api/user/connections
 * Fetch all saved connections belonging strictly to the authenticated user
 */
router.get('/connections', async (req, res) => {
  try {
    const result = await userDb.query(
      `SELECT id, name, type, host, port, database_name, username, connection_string, ssl, created_at, updated_at
       FROM user_connections WHERE user_id = ? ORDER BY id DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      connections: result.rows || [],
    });
  } catch (err) {
    console.error('Fetch user connections error:', err);
    res.status(500).json({ error: 'Gagal mengambil daftar koneksi tersimpan.' });
  }
});

/**
 * POST /api/user/connections
 * Save new database connection (passwords encrypted with AES-256-GCM)
 */
router.post('/connections', async (req, res) => {
  const { name, type, host, port, database_name, username, password, connection_string, ssl } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nama label koneksi wajib diisi.' });
  }

  try {
    const encryptedPass = password ? encryptData(password) : null;
    const nowIso = new Date().toISOString();

    const insertResult = await userDb.query(
      `INSERT INTO user_connections (user_id, name, type, host, port, database_name, username, encrypted_password, connection_string, ssl, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        String(name).trim(),
        type || 'postgres',
        host || null,
        port ? parseInt(port) : null,
        database_name || null,
        username || null,
        encryptedPass,
        connection_string || null,
        ssl ? 1 : 0,
        nowIso,
        nowIso,
      ]
    );

    res.json({
      success: true,
      message: 'Koneksi database berhasil disimpan secara aman di akun Anda.',
      connectionId: insertResult.insertId,
    });
  } catch (err) {
    console.error('Save connection error:', err);
    res.status(500).json({ error: 'Gagal menyimpan koneksi database.' });
  }
});

/**
 * GET /api/user/connections/:id/credentials
 * Retrieve decrypted credentials for establishing database connection
 */
router.get('/connections/:id/credentials', async (req, res) => {
  const connectionId = parseInt(req.params.id);

  try {
    const result = await userDb.query(
      'SELECT id, name, type, host, port, database_name, username, encrypted_password, connection_string, ssl FROM user_connections WHERE id = ? AND user_id = ?',
      [connectionId, req.user.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Koneksi tidak ditemukan atau Anda tidak memiliki hak akses.' });
    }

    const conn = result.rows[0];
    const password = conn.encrypted_password ? decryptData(conn.encrypted_password) : '';

    res.json({
      success: true,
      credentials: {
        id: conn.id,
        name: conn.name,
        type: conn.type,
        host: conn.host,
        port: conn.port,
        database: conn.database_name,
        user: conn.username,
        password,
        connection_string: conn.connection_string,
        ssl: !!conn.ssl,
      },
    });
  } catch (err) {
    console.error('Get connection credentials error:', err);
    res.status(500).json({ error: 'Gagal mengambil kredensial koneksi.' });
  }
});

/**
 * DELETE /api/user/connections/:id
 * Delete a connection strictly belonging to this user
 */
router.delete('/connections/:id', async (req, res) => {
  const connectionId = parseInt(req.params.id);

  try {
    const result = await userDb.query(
      'DELETE FROM user_connections WHERE id = ? AND user_id = ?',
      [connectionId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Koneksi tidak ditemukan atau sudah dihapus.' });
    }

    res.json({ success: true, message: 'Koneksi berhasil dihapus.' });
  } catch (err) {
    console.error('Delete connection error:', err);
    res.status(500).json({ error: 'Gagal menghapus koneksi.' });
  }
});

/**
 * PUT /api/user/connections/:id
 * Update an existing database connection slot
 */
router.put('/connections/:id', async (req, res) => {
  const connectionId = parseInt(req.params.id);
  const { name, type, host, port, database_name, username, password, connection_string, ssl } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nama label koneksi wajib diisi.' });
  }

  try {
    const existing = await userDb.query(
      'SELECT id, encrypted_password FROM user_connections WHERE id = ? AND user_id = ?',
      [connectionId, req.user.id]
    );
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Koneksi tidak ditemukan.' });
    }

    let encryptedPass = existing.rows[0].encrypted_password;
    if (password) {
      encryptedPass = encryptData(password);
    }

    const nowIso = new Date().toISOString();
    await userDb.query(
      `UPDATE user_connections 
       SET name = ?, type = ?, host = ?, port = ?, database_name = ?, username = ?, encrypted_password = ?, connection_string = ?, ssl = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        String(name).trim(),
        type || 'postgres',
        host || null,
        port ? parseInt(port) : null,
        database_name || null,
        username || null,
        encryptedPass,
        connection_string || null,
        ssl ? 1 : 0,
        nowIso,
        connectionId,
        req.user.id
      ]
    );

    res.json({ success: true, message: 'Slot database berhasil diperbarui.' });
  } catch (err) {
    console.error('Update connection error:', err);
    res.status(500).json({ error: 'Gagal memperbarui koneksi database.' });
  }
});

// -----------------------------------------------------------------------------
// USER SAVED QUERIES
// -----------------------------------------------------------------------------

router.get('/queries', async (req, res) => {
  try {
    const result = await userDb.query(
      'SELECT id, title, query_sql, connection_name, created_at FROM user_saved_queries WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    res.json({ success: true, queries: result.rows || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/queries', async (req, res) => {
  const { title, query_sql, connection_name } = req.body;
  if (!title || !query_sql) {
    return res.status(400).json({ error: 'Judul dan kueri SQL wajib diisi.' });
  }

  try {
    const result = await userDb.query(
      'INSERT INTO user_saved_queries (user_id, title, query_sql, connection_name) VALUES (?, ?, ?, ?)',
      [req.user.id, String(title).trim(), query_sql, connection_name || null]
    );
    res.json({ success: true, queryId: result.insertId, message: 'Kueri berhasil disimpan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/queries/:id', async (req, res) => {
  const queryId = parseInt(req.params.id);
  try {
    await userDb.query('DELETE FROM user_saved_queries WHERE id = ? AND user_id = ?', [queryId, req.user.id]);
    res.json({ success: true, message: 'Kueri berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// USER SETTINGS (Column orders, hidden columns, UI preferences)
// -----------------------------------------------------------------------------

router.get('/settings', async (req, res) => {
  try {
    const result = await userDb.query(
      'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );
    const settings = {};
    for (const row of result.rows) {
      try {
        settings[row.setting_key] = JSON.parse(row.setting_value);
      } catch {
        settings[row.setting_key] = row.setting_value;
      }
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key pengaturan diperlukan.' });

  try {
    const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const nowIso = new Date().toISOString();

    // Check if exists
    const existing = await userDb.query(
      'SELECT id FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [req.user.id, key]
    );

    if (existing.rows && existing.rows.length > 0) {
      await userDb.query(
        'UPDATE user_settings SET setting_value = ?, updated_at = ? WHERE user_id = ? AND setting_key = ?',
        [strVal, nowIso, req.user.id, key]
      );
    } else {
      await userDb.query(
        'INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at) VALUES (?, ?, ?, ?)',
        [req.user.id, key, strVal, nowIso]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

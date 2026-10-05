/**
 * Robust Database URI / Connection String Parser for Backend
 */
function parseDatabaseUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  let str = uri.replace(/[\r\n\t]/g, '').trim();
  if (!str) return null;

  if (!str.includes('://')) {
    str = 'postgresql://' + str;
  }

  const schemeMatch = str.match(/^([a-zA-Z0-9_+]+):\/\/(.*)$/);
  if (!schemeMatch) return null;

  const rawScheme = schemeMatch[1].toLowerCase();
  let scheme = rawScheme;
  if (scheme === 'postgres') scheme = 'postgresql';
  if (scheme === 'mariadb') scheme = 'mysql';

  let remainder = schemeMatch[2];

  if (scheme === 'sqlite') {
    let dbPath = remainder.replace(/^\/+/, '');
    return {
      type: 'sqlite',
      scheme: 'sqlite',
      host: 'localhost',
      port: 3001,
      database: dbPath || 'demo',
      user: 'demo',
      password: '',
      ssl: false,
      queryParams: {},
      connectionString: str,
    };
  }

  let queryParams = {};
  const queryIdx = remainder.indexOf('?');
  if (queryIdx !== -1) {
    const qStr = remainder.slice(queryIdx + 1);
    remainder = remainder.slice(0, queryIdx);
    try {
      const searchParams = new URLSearchParams(qStr);
      for (const [k, v] of searchParams.entries()) {
        queryParams[k.toLowerCase()] = v;
      }
    } catch { /* ignore */ }
  }

  let auth = '';
  let hostAndPath = remainder;
  const atIdx = remainder.lastIndexOf('@');
  if (atIdx !== -1) {
    auth = remainder.slice(0, atIdx);
    hostAndPath = remainder.slice(atIdx + 1);
  }

  let user = '';
  let password = '';
  if (auth) {
    const colonIdx = auth.indexOf(':');
    if (colonIdx !== -1) {
      try {
        user = decodeURIComponent(auth.slice(0, colonIdx));
      } catch {
        user = auth.slice(0, colonIdx);
      }
      try {
        password = decodeURIComponent(auth.slice(colonIdx + 1));
      } catch {
        password = auth.slice(colonIdx + 1);
      }
    } else {
      try {
        user = decodeURIComponent(auth);
      } catch {
        user = auth;
      }
    }
  }

  let host = '';
  let port = '';
  let database = '';

  const slashIdx = hostAndPath.indexOf('/');
  let hostPart = hostAndPath;
  if (slashIdx !== -1) {
    hostPart = hostAndPath.slice(0, slashIdx);
    const rawDb = hostAndPath.slice(slashIdx + 1);
    try {
      database = decodeURIComponent(rawDb);
    } catch {
      database = rawDb;
    }
  }

  if (hostPart.startsWith('[')) {
    const closeBracket = hostPart.indexOf(']');
    if (closeBracket !== -1) {
      host = hostPart.slice(1, closeBracket);
      const after = hostPart.slice(closeBracket + 1);
      if (after.startsWith(':')) port = after.slice(1);
    }
  } else {
    const colonIdx = hostPart.lastIndexOf(':');
    if (colonIdx !== -1) {
      host = hostPart.slice(0, colonIdx);
      port = hostPart.slice(colonIdx + 1);
    } else {
      host = hostPart;
    }
  }

  if (!port) {
    if (scheme === 'postgresql') port = '5432';
    else if (scheme === 'mysql') port = '3306';
    else if (scheme === 'mssql' || scheme === 'sqlserver') port = '1433';
  }

  const sslParam = (queryParams['sslmode'] || queryParams['ssl'] || '').toLowerCase();
  const ssl = sslParam === 'require' || sslParam === 'true' || sslParam === '1' || sslParam === 'verify-full' || sslParam === 'verify-ca';

  let type = 'postgres';
  if (scheme === 'mysql') type = 'mysql';
  else if (scheme === 'mssql' || scheme === 'sqlserver') type = 'mssql';

  return {
    type,
    scheme,
    host: host.trim(),
    port: parseInt(port, 10) || (type === 'mysql' ? 3306 : 5432),
    database: database.trim(),
    user: user.trim(),
    password,
    ssl,
    queryParams,
    connectionString: str,
  };
}

module.exports = { parseDatabaseUri };

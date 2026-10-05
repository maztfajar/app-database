import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Input, Button, Table, Tabs, Modal, message, Form, Typography, Space, Spin, Tooltip,
  Popconfirm, Select, Checkbox, Switch, Tag, Badge, Card, Divider, Row, Col, Segmented, Popover,
} from 'antd';
import {
  DatabaseOutlined, TableOutlined, PlayCircleOutlined,
  SearchOutlined, DisconnectOutlined, DownOutlined,
  CodeOutlined, ReloadOutlined, DownloadOutlined,
  KeyOutlined, ThunderboltOutlined, PlusOutlined,
  DeleteOutlined, EditOutlined, ArrowLeftOutlined, ArrowRightOutlined,
  ClearOutlined, SettingOutlined, AppstoreAddOutlined,
  PlusCircleOutlined, CheckCircleOutlined, LinkOutlined,
  HistoryOutlined, ArrowUpOutlined, ArrowDownOutlined,
  DashboardOutlined, SwapOutlined,
} from '@ant-design/icons';

import AuthPortal from './components/AuthPortal';
import UserHeader from './components/UserHeader';
import SavedConnectionsModal from './components/SavedConnectionsModal';
import DatabaseSlotsHub from './components/DatabaseSlotsHub';
import DatabaseMetricsDashboard from './components/DatabaseMetricsDashboard';
import { parseDatabaseUri } from './utils/dbUriParser';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Option } = Select;

const API_URL = '/api';

const COLUMN_TYPES = [
  'INTEGER', 'TEXT', 'VARCHAR(255)', 'REAL', 'NUMERIC',
  'BOOLEAN', 'DATETIME', 'DATE', 'BLOB'
];

export default function App() {
  const [connectionForm] = Form.useForm();
  const [isConnected, setIsConnected] = useState(false);
  const [tables, setTables] = useState([]);
  const [activeTab, setActiveTab] = useState('metrics');
  const [openTabs, setOpenTabs] = useState(['metrics', 'query']);
  const [querySQL, setQuerySQL] = useState('SELECT * FROM your_table LIMIT 10;');
  const [queryResult, setQueryResult] = useState({ columns: [], data: [], rowCount: 0 });
  const [queryTime, setQueryTime] = useState(null);
  const [tableDataCache, setTableDataCache] = useState({});
  const [tableStructure, setTableStructure] = useState({});
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [connectingStatus, setConnectingStatus] = useState('');
  const [structureCollapsed, setStructureCollapsed] = useState({});
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

  // Column order and visibility per table: { [tableName]: string[] }
  const [customColumnOrder, setCustomColumnOrder] = useState(() => {
    try {
      const raw = localStorage.getItem('appdb_column_orders');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    try {
      const raw = localStorage.getItem('appdb_hidden_columns');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Auto-sync column order & hidden columns to localStorage
  useEffect(() => {
    if (Object.keys(customColumnOrder).length > 0) {
      try {
        localStorage.setItem('appdb_column_orders', JSON.stringify(customColumnOrder));
      } catch { /* ignore */ }
    }
  }, [customColumnOrder]);

  useEffect(() => {
    if (Object.keys(hiddenColumns).length > 0) {
      try {
        localStorage.setItem('appdb_hidden_columns', JSON.stringify(hiddenColumns));
      } catch { /* ignore */ }
    }
  }, [hiddenColumns]);

  // Remember login & saved history state
  const [rememberLogin, setRememberLogin] = useState(() => {
    try {
      return localStorage.getItem('appdb_remember') !== 'false';
    } catch {
      return true;
    }
  });

  const [savedHistory, setSavedHistory] = useState(() => {
    try {
      const raw = localStorage.getItem('appdb_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Check if there is an active session to restore on startup (prevents login screen flash)
  const [isRestoringSession, setIsRestoringSession] = useState(() => {
    try {
      const raw = localStorage.getItem('appdb_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        return !!(parsed && parsed.remember && parsed.credentials);
      }
    } catch { /* ignore */ }
    return false;
  });

  // User Authentication & Multi-Tenant Isolated Storage State
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [savedDbConnections, setSavedDbConnections] = useState([]);
  const [savedConnectionsModalVisible, setSavedConnectionsModalVisible] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(true);
  const [connectionLabel, setConnectionLabel] = useState('');

  // Setup Axios interceptor & verify active user session
  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      const token = localStorage.getItem('appdb_jwt_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const checkUser = async () => {
      const token = localStorage.getItem('appdb_jwt_token');
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const res = await axios.get('/api/auth/me');
        if (res.data.success && res.data.user) {
          setCurrentUser(res.data.user);
          fetchUserConnections();
        } else {
          localStorage.removeItem('appdb_jwt_token');
          setCurrentUser(null);
        }
      } catch (err) {
        localStorage.removeItem('appdb_jwt_token');
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    checkUser();

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, []);

  const fetchUserConnections = async () => {
    try {
      const res = await axios.get('/api/user/connections');
      if (res.data.success) {
        setSavedDbConnections(res.data.connections || []);
      }
    } catch (err) {
      console.error('Failed to fetch user connections:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (e) { /* ignore */ }
    localStorage.removeItem('appdb_jwt_token');
    localStorage.removeItem('appdb_session');
    sessionStorage.removeItem('appdb_toast_dismissed');
    sessionStorage.setItem('appdb_logout_toast', 'true');
    setCurrentUser(null);
    setIsConnected(false);
    message.info('Anda telah keluar dari akun.');
  };

  const handleAuthSuccess = (userData, token) => {
    setCurrentUser(userData);
    fetchUserConnections();
  };

  const handleSelectSavedConnection = async (savedConn) => {
    try {
      const res = await axios.get(`/api/user/connections/${savedConn.id}/credentials`);
      if (res.data.success) {
        const creds = res.data.credentials;
        const uri = creds.connection_string;
        const parsed = uri ? parseDatabaseUri(uri) : null;

        const connectPayload = {
          ...creds,
          ...(parsed || {}),
          connection_string: uri || creds.connection_string || undefined,
        };

        if (uri) {
          setConnString(uri);
          setConnectionMode('uri');
        } else {
          setConnectionMode('manual');
        }

        connectionForm.setFieldsValue({
          host: connectPayload.host,
          port: connectPayload.port,
          database: connectPayload.database,
          user: connectPayload.user,
          password: connectPayload.password,
        });

        await handleConnect(connectPayload);
      }
    } catch (err) {
      console.error('Connection error:', err);
      message.error(err.response?.data?.error || err.message || 'Gagal terhubung ke database');
    }
  };

  const handleDeleteSavedConnection = async (connId) => {
    try {
      const res = await axios.delete(`/api/user/connections/${connId}`);
      if (res.data.success) {
        message.success('Koneksi berhasil dihapus dari akun Anda.');
        fetchUserConnections();
      }
    } catch (err) {
      message.error('Gagal menghapus koneksi');
    }
  };

  // Modals state
  const [newTableModalVisible, setNewTableModalVisible] = useState(false);
  const [addColumnModalVisible, setAddColumnModalVisible] = useState(false);
  const [columnManageModalVisible, setColumnManageModalVisible] = useState(false);
  const [addRowModalVisible, setAddRowModalVisible] = useState(false);
  const [editRowModalVisible, setEditRowModalVisible] = useState(false);
  const [editingRowRecord, setEditingRowRecord] = useState(null);
  const [renameColumnModalVisible, setRenameColumnModalVisible] = useState(false);
  const [renamingColumn, setRenamingColumn] = useState({ tableName: '', oldName: '' });
  const [renameLoading, setRenameLoading] = useState(false);
  const [inlineEditingCol, setInlineEditingCol] = useState(null);
  const [inlineColNewName, setInlineColNewName] = useState('');

  // New table builder state
  const [newTableName, setNewTableName] = useState('');
  const [newTableColumns, setNewTableColumns] = useState([
    { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true, notNull: true, defaultValue: '' },
    { name: 'name', type: 'TEXT', primaryKey: false, autoIncrement: false, notNull: true, defaultValue: '' },
    { name: 'description', type: 'TEXT', primaryKey: false, autoIncrement: false, notNull: false, defaultValue: '' },
  ]);
  const [includeInitialData, setIncludeInitialData] = useState(false);
  const [initialRows, setInitialRows] = useState([{}]);

  // Connection String mode state
  const [connectionMode, setConnectionMode] = useState('uri'); // 'uri' | 'manual'
  const [connString, setConnString] = useState(
    'postgresql://uazuSleyutH953G5A.jkt1_003:b56aabd50b51c19d747f830f@pgsql-dbas-jkt1-003.sumobase.my.id:6432/db658b2889efac70aa'
  );
  
  // Parse connection string helper with newline and whitespace handling
  const parseConnectionString = useCallback((rawStr) => {
    return parseDatabaseUri(rawStr);
  }, []);

  const [parsedPreview, setParsedPreview] = useState(() => {
    const initialUri = 'postgresql://uazuSleyutH953G5A.jkt1_003:b56aabd50b51c19d747f830f@pgsql-dbas-jkt1-003.sumobase.my.id:6432/db658b2889efac70aa';
    return parseDatabaseUri(initialUri);
  });

  const handleConnStringInput = (val) => {
    setConnString(val);
    const parsed = parseDatabaseUri(val);
    if (parsed) {
      setParsedPreview(parsed);
      connectionForm.setFieldsValue(parsed);
    } else {
      setParsedPreview(null);
    }
  };

  const handleSelectPreset = (uri) => {
    setConnString(uri);
    const parsed = parseDatabaseUri(uri);
    if (parsed) {
      setParsedPreview(parsed);
      connectionForm.setFieldsValue(parsed);
    }
    message.info('Connection string preset dimuat');
  };

  const handleConnectWithUri = () => {
    const parsed = parseDatabaseUri(connString);
    if (!parsed || !parsed.host || !parsed.database) {
      message.error('Format Connection String tidak valid. Contoh: postgresql://user:pass@host:5432/dbname');
      return;
    }
    const payload = {
      ...parsed,
      connection_string: connString,
    };
    connectionForm.setFieldsValue(parsed);
    handleConnect(payload);
  };

  // History operations
  const deleteHistoryItem = (id, e) => {
    if (e) e.stopPropagation();
    setSavedHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem('appdb_history', JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
    message.success('Riwayat koneksi dihapus');
  };

  const clearAllHistory = () => {
    setSavedHistory([]);
    try {
      localStorage.removeItem('appdb_history');
    } catch { /* ignore */ }
    message.info('Semua riwayat koneksi dibersihkan');
  };

  const handleApplyHistory = (item) => {
    if (item.connectionMode) setConnectionMode(item.connectionMode);
    if (item.connString) {
      setConnString(item.connString);
      const parsed = parseConnectionString(item.connString);
      if (parsed) {
        setParsedPreview(parsed);
        connectionForm.setFieldsValue(parsed);
      }
    } else if (item.values) {
      connectionForm.setFieldsValue(item.values);
      setParsedPreview(item.values);
      const uri = `postgresql://${item.values.user}:${item.values.password}@${item.values.host}:${item.values.port}/${item.values.database}`;
      setConnString(uri);
    }
    message.info(`Memuat koneksi: ${item.title}`);
  };

  // Forms
  const [addColumnForm] = Form.useForm();
  const [addRowForm] = Form.useForm();
  const [editRowForm] = Form.useForm();
  const [renameColumnForm] = Form.useForm();

  const queryInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // ---------- FETCH TABLE LIST ----------
  const fetchTableList = useCallback(async (creds = credentials) => {
    if (!creds) return;
    try {
      const res = await axios.post(`${API_URL}/tables`, creds);
      if (res.data.tables) {
        setTables(res.data.tables);
      }
    } catch { /* ignore */ }
  }, [credentials]);

  // ---------- CONNECT ----------
  const handleConnect = async (values, initialTabs, initialActiveTab) => {
    setLoading(true);
    setConnectingStatus('Menghubungkan ke server...');
    try {
      const payload = {
        ...values,
        connection_string: values.connection_string || connString || undefined,
      };
      const res = await axios.post(`${API_URL}/connect`, payload);
      if (res.data.success) {
        setCredentials(values);
        setTables(res.data.tables);
        setIsConnected(true);
        message.success(`Terhubung! Ditemukan ${res.data.tables.length} tabel.`);
        setTableDataCache({});
        setTableStructure({});

        const nextOpenTabs = (initialTabs && Array.isArray(initialTabs) && initialTabs.length > 0)
          ? initialTabs
          : ['metrics', 'query'];
        const nextActiveTab = initialActiveTab || 'metrics';

        setOpenTabs(nextOpenTabs);
        setActiveTab(nextActiveTab);

        if (nextActiveTab !== 'query' && nextActiveTab !== 'metrics') {
          fetchTableData(nextActiveTab, values);
          fetchTableStructure(nextActiveTab, values);
        }

        // Save session in localStorage if rememberLogin is true
        if (rememberLogin) {
          try {
            localStorage.setItem('appdb_session', JSON.stringify({
              credentials: values,
              connString,
              connectionMode,
              openTabs: nextOpenTabs,
              activeTab: nextActiveTab,
              remember: true,
            }));
          } catch { /* ignore */ }
        }

        // Save to connection history
        const historyKey = `${values.host}:${values.port}:${values.database}:${values.user}`;
        const newHistoryEntry = {
          id: historyKey,
          title: `${values.database}@${values.host}`,
          values,
          connString: connString || `postgresql://${values.user}:${values.password}@${values.host}:${values.port}/${values.database}`,
          connectionMode,
          timestamp: new Date().toISOString(),
        };

        setSavedHistory(prev => {
          const filtered = prev.filter(item => item.id !== historyKey);
          const updated = [newHistoryEntry, ...filtered].slice(0, 10);
          try {
            localStorage.setItem('appdb_history', JSON.stringify(updated));
          } catch { /* ignore */ }
          return updated;
        });

        // Save to user's isolated database storage with AES-256 encryption
        if (currentUser && saveToAccount) {
          try {
            const label = connectionLabel.trim() || `${values.database}@${values.host}`;
            axios.post('/api/user/connections', {
              name: label,
              type: values.host === 'localhost' && values.database === 'demo' ? 'sqlite' : 'postgres',
              host: values.host,
              port: values.port,
              database_name: values.database,
              username: values.user,
              password: values.password,
              connection_string: connString || null,
            }).then(() => fetchUserConnections()).catch(() => {});
          } catch (e) { /* ignore */ }
        }
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Koneksi gagal');
      try {
        localStorage.removeItem('appdb_session');
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
      setConnectingStatus('');
      setIsRestoringSession(false);
    }
  };

  // ---------- AUTO-RECONNECT ON MOUNT ----------
  useEffect(() => {
    try {
      const rawSession = localStorage.getItem('appdb_session');
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session && session.remember && session.credentials) {
          if (session.connString) setConnString(session.connString);
          if (session.connectionMode) setConnectionMode(session.connectionMode);
          handleConnect(session.credentials, session.openTabs, session.activeTab);
          return;
        }
      }
    } catch (err) {
      console.error('Session restore error:', err);
    }
    setIsRestoringSession(false);

    // Default initial parse
    const parsed = parseConnectionString(connString);
    if (parsed) {
      setParsedPreview(parsed);
      connectionForm.setFieldsValue(parsed);
    }
  }, []);

  // Sync openTabs and activeTab into active session
  useEffect(() => {
    if (isConnected && credentials && rememberLogin) {
      try {
        const raw = localStorage.getItem('appdb_session');
        const session = raw ? JSON.parse(raw) : {};
        localStorage.setItem('appdb_session', JSON.stringify({
          ...session,
          credentials,
          openTabs,
          activeTab,
          connString,
          connectionMode,
          remember: true,
        }));
      } catch { /* ignore */ }
    }
  }, [openTabs, activeTab, isConnected, credentials, rememberLogin, connString, connectionMode]);

  // ---------- DISCONNECT ----------
  const handleDisconnect = async () => {
    if (!credentials) return;
    try {
      await axios.post(`${API_URL}/disconnect`, credentials);
    } catch { /* ignore */ }
    try {
      localStorage.removeItem('appdb_session');
    } catch { /* ignore */ }
    setIsConnected(false);
    setIsRestoringSession(false);
    setCredentials(null);
    setTables([]);
    setTableDataCache({});
    setTableStructure({});
    setOpenTabs(['metrics', 'query']);
    setActiveTab('metrics');
    message.info('Koneksi terputus');
  };

  // ---------- FETCH TABLE DATA ----------
  const fetchTableData = useCallback(async (tableName, creds = credentials) => {
    if (!creds) return;
    try {
      const res = await axios.post(`${API_URL}/table/data`, {
        ...creds, tableName, limit: 200,
      });
      const { rows, fields, total } = res.data;
      const rawColumns = fields.map(f => f.name);

      // Initialize column order if not yet customized (preserve saved column order from localStorage)
      setCustomColumnOrder(prev => {
        if (prev[tableName] && prev[tableName].length > 0) return prev;
        try {
          const saved = JSON.parse(localStorage.getItem('appdb_column_orders') || '{}');
          if (saved[tableName] && saved[tableName].length > 0) {
            return { ...prev, [tableName]: saved[tableName] };
          }
        } catch { /* ignore */ }
        return { ...prev, [tableName]: rawColumns };
      });

      setTableDataCache(prev => ({
        ...prev,
        [tableName]: { rawColumns, data: rows, total }
      }));
    } catch (error) {
      message.error(`Gagal mengambil data: ${tableName}`);
    }
  }, [credentials]);

  const fetchTableStructure = useCallback(async (tableName, creds = credentials) => {
    if (!creds) return;
    try {
      const res = await axios.post(`${API_URL}/table`, { ...creds, tableName });
      setTableStructure(prev => ({ ...prev, [tableName]: res.data }));
    } catch (error) {
      message.error(`Gagal mengambil struktur: ${tableName}`);
    }
  }, [credentials]);

  // ---------- TAB CHANGE ----------
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    if (newTab !== 'query' && newTab !== 'metrics') {
      if (!tableDataCache[newTab]) fetchTableData(newTab);
      if (!tableStructure[newTab]) fetchTableStructure(newTab);
    }
  }, [tableDataCache, tableStructure, fetchTableData, fetchTableStructure]);

  // ---------- OPEN TABLE TAB ----------
  const handleTableClick = useCallback((tableName) => {
    if (!openTabs.includes(tableName)) {
      setOpenTabs(prev => [...prev, tableName]);
    }
    setActiveTab(tableName);
    if (!tableDataCache[tableName]) fetchTableData(tableName);
    if (!tableStructure[tableName]) fetchTableStructure(tableName);
  }, [openTabs, tableDataCache, tableStructure, fetchTableData, fetchTableStructure]);

  // ---------- EXECUTE QUERY ----------
  const handleExecuteQuery = useCallback(async () => {
    if (!credentials || !querySQL.trim()) return;
    setQueryLoading(true);
    const start = performance.now();
    try {
      const res = await axios.post(`${API_URL}/query`, { ...credentials, sql: querySQL });
      const elapsed = performance.now() - start;
      const { rows, fields, rowCount } = res.data;
      const columns = fields
        ? fields.map(f => ({
            title: f.name,
            dataIndex: f.name,
            key: f.name,
            ellipsis: true,
            width: 160,
            render: (value) => {
              if (value === null) return <span style={{ color: '#5c6070', fontStyle: 'italic' }}>NULL</span>;
              if (typeof value === 'boolean') return <span style={{ color: value ? '#00b894' : '#e17055' }}>{String(value)}</span>;
              if (typeof value === 'object') return <span style={{ color: '#fdcb6e' }}>{JSON.stringify(value)}</span>;
              return String(value);
            },
          }))
        : [];
      setQueryResult({ columns, data: rows, rowCount: rowCount || rows.length });
      setQueryTime(elapsed.toFixed(0));
      message.success(`Query berhasil — ${rows.length} baris dalam ${elapsed.toFixed(0)}ms`);
    } catch (error) {
      message.error(error.response?.data?.error || 'Error menjalankan query');
      setQueryTime(null);
    } finally {
      setQueryLoading(false);
    }
  }, [credentials, querySQL]);

  // ---------- EXPORT CSV ----------
  const exportCSV = useCallback((columns, data, filename) => {
    if (!columns.length || !data.length) return;
    const header = columns.map(c => c.dataIndex || c.title || c).join(',');
    const rows = data.map(row =>
      columns.map(c => {
        const colKey = typeof c === 'string' ? c : (c.dataIndex || c.title);
        const val = row[colKey];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`Exported ${data.length} baris ke ${filename}.csv`);
  }, []);

  // ---------- COLUMN REORDERING ----------
  const moveColumn = (tableName, colName, direction) => {
    setCustomColumnOrder(prev => {
      const currentOrder = prev[tableName] || tableDataCache[tableName]?.rawColumns || [];
      const index = currentOrder.indexOf(colName);
      if (index === -1) return prev;
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentOrder.length) return prev;

      const newOrder = [...currentOrder];
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      const updated = { ...prev, [tableName]: newOrder };
      try {
        localStorage.setItem('appdb_column_orders', JSON.stringify(updated));
      } catch { /* ignore */ }
      message.info(`Kolom "${colName}" dipindahkan ke ${direction === 'left' ? 'kiri / atas' : 'kanan / bawah'}`);
      return updated;
    });
  };

  const toggleColumnVisibility = (tableName, colName) => {
    setHiddenColumns(prev => {
      const currentHidden = prev[tableName] || [];
      const isHidden = currentHidden.includes(colName);
      const newHidden = isHidden
        ? currentHidden.filter(c => c !== colName)
        : [...currentHidden, colName];
      const updated = { ...prev, [tableName]: newHidden };
      try {
        localStorage.setItem('appdb_hidden_columns', JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  };

  const resetColumnOrder = (tableName) => {
    const raw = tableDataCache[tableName]?.rawColumns || [];
    setCustomColumnOrder(prev => {
      const updated = { ...prev, [tableName]: raw };
      try {
        localStorage.setItem('appdb_column_orders', JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
    setHiddenColumns(prev => {
      const updated = { ...prev, [tableName]: [] };
      try {
        localStorage.setItem('appdb_hidden_columns', JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
    message.success('Urutan kolom dikembalikan ke default');
  };

  // ---------- ADD COLUMN ----------
  const handleAddColumnSubmit = async (values) => {
    if (!activeTab || activeTab === 'query') return;
    try {
      const res = await axios.post(`${API_URL}/table/add-column`, {
        ...credentials,
        tableName: activeTab,
        columnName: values.columnName.trim(),
        columnType: values.columnType,
        notNull: values.notNull || false,
        defaultValue: values.defaultValue || undefined,
      });
      if (res.data.success) {
        message.success(`Kolom "${values.columnName}" berhasil ditambahkan ke tabel "${activeTab}"`);
        setAddColumnModalVisible(false);
        addColumnForm.resetFields();
        fetchTableStructure(activeTab);
        fetchTableData(activeTab);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menambahkan kolom');
    }
  };

  // ---------- DROP COLUMN ----------
  const handleDropColumn = async (columnName) => {
    if (!activeTab || activeTab === 'query') return;
    try {
      const res = await axios.post(`${API_URL}/table/drop-column`, {
        ...credentials,
        tableName: activeTab,
        columnName,
      });
      if (res.data.success) {
        message.success(`Kolom "${columnName}" berhasil dihapus dari tabel "${activeTab}"`);
        fetchTableStructure(activeTab);
        fetchTableData(activeTab);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menghapus kolom');
    }
  };

  // ---------- RENAME COLUMN (Klik Edit Langsung) ----------
  const handleRenameColumnSubmit = async (tableName, oldColumnName, newColumnName) => {
    const targetTable = tableName || activeTab;
    if (!targetTable || targetTable === 'query' || targetTable === 'metrics') return;

    const trimmedNew = (newColumnName || '').trim();
    if (!trimmedNew) {
      message.warning('Nama kolom baru tidak boleh kosong');
      return;
    }
    if (trimmedNew === oldColumnName) {
      message.info('Nama kolom tidak berubah');
      setRenameColumnModalVisible(false);
      setInlineEditingCol(null);
      return;
    }

    setRenameLoading(true);
    try {
      const res = await axios.post(`${API_URL}/table/rename-column`, {
        ...credentials,
        tableName: targetTable,
        oldColumnName,
        newColumnName: trimmedNew,
      });

      if (res.data.success) {
        message.success(`Nama kolom "${oldColumnName}" berhasil diubah menjadi "${trimmedNew}"`);

        // Update customColumnOrder if present
        setCustomColumnOrder(prev => {
          const currentCols = prev[targetTable] || [];
          const updatedCols = currentCols.map(c => c === oldColumnName ? trimmedNew : c);
          return { ...prev, [targetTable]: updatedCols };
        });

        // Update hiddenColumns if present
        setHiddenColumns(prev => {
          const currentHidden = prev[targetTable] || [];
          const updatedHidden = currentHidden.map(c => c === oldColumnName ? trimmedNew : c);
          return { ...prev, [targetTable]: updatedHidden };
        });

        setRenameColumnModalVisible(false);
        setInlineEditingCol(null);
        renameColumnForm.resetFields();

        // Refresh structure and data
        fetchTableStructure(targetTable);
        fetchTableData(targetTable);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal mengubah nama kolom');
    } finally {
      setRenameLoading(false);
    }
  };

  const openRenameColumnModal = (tableName, columnName) => {
    setRenamingColumn({ tableName, oldName: columnName });
    renameColumnForm.setFieldsValue({ newColumnName: columnName });
    setRenameColumnModalVisible(true);
  };

  // ---------- INSERT ROW ----------
  const handleAddRowSubmit = async (values) => {
    if (!activeTab || activeTab === 'query') return;
    try {
      const res = await axios.post(`${API_URL}/table/insert`, {
        ...credentials,
        tableName: activeTab,
        row: values,
      });
      if (res.data.success) {
        message.success('Baris data baru berhasil ditambahkan');
        setAddRowModalVisible(false);
        addRowForm.resetFields();
        fetchTableData(activeTab);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menambahkan baris');
    }
  };

  // ---------- EDIT ROW ----------
  const openEditRowModal = (record) => {
    setEditingRowRecord(record);
    const formVals = { ...record };
    for (const k of Object.keys(formVals)) {
      if (typeof formVals[k] === 'object' && formVals[k] !== null) {
        formVals[k] = JSON.stringify(formVals[k], null, 2);
      }
    }
    editRowForm.setFieldsValue(formVals);
    setEditRowModalVisible(true);
  };

  const handleEditRowSubmit = async (values) => {
    if (!activeTab || !editingRowRecord) return;
    const structure = tableStructure[activeTab] || [];
    const pkColumns = structure.filter(c => c.is_primary_key).map(c => c.column_name);
    const effectivePkCols = pkColumns.length > 0 ? pkColumns : [structure[0]?.column_name || 'id'];

    const primaryKeys = {};
    for (const pk of effectivePkCols) {
      primaryKeys[pk] = editingRowRecord[pk];
    }

    // Collect changed fields
    const updates = {};
    for (const key of Object.keys(values)) {
      if (effectivePkCols.includes(key)) continue; // Don't update primary key
      const origVal = editingRowRecord[key];
      const newVal = values[key];

      const origStr = typeof origVal === 'object' && origVal !== null
        ? JSON.stringify(origVal)
        : (origVal === null || origVal === undefined ? '' : String(origVal));
      const newStr = (newVal === null || newVal === undefined ? '' : String(newVal)).trim();

      if (origStr !== newStr) {
        updates[key] = newVal;
      }
    }

    if (Object.keys(updates).length === 0) {
      setEditRowModalVisible(false);
      message.info('Tidak ada perubahan data');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/table/update-row`, {
        ...credentials,
        tableName: activeTab,
        primaryKeys,
        updates,
      });
      if (res.data.success) {
        message.success('Data baris berhasil diperbarui');
        setEditRowModalVisible(false);
        fetchTableData(activeTab);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal mengupdate baris');
    }
  };

  // ---------- DELETE ROW ----------
  const handleDeleteRow = async (record) => {
    if (!activeTab || activeTab === 'query') return;
    const structure = tableStructure[activeTab] || [];
    const pkColumns = structure.filter(c => c.is_primary_key).map(c => c.column_name);
    const effectivePkCols = pkColumns.length > 0 ? pkColumns : [structure[0]?.column_name || 'id'];

    const primaryKeys = {};
    for (const pk of effectivePkCols) {
      primaryKeys[pk] = record[pk];
    }

    try {
      const res = await axios.post(`${API_URL}/table/delete-row`, {
        ...credentials,
        tableName: activeTab,
        primaryKeys,
      });
      if (res.data.success) {
        message.success('Baris berhasil dihapus');
        fetchTableData(activeTab);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menghapus baris');
    }
  };

  // ---------- TRUNCATE TABLE ----------
  const handleTruncateTable = async (tableName) => {
    try {
      const res = await axios.post(`${API_URL}/table/truncate`, {
        ...credentials,
        tableName,
      });
      if (res.data.success) {
        message.success(`Semua data dalam tabel "${tableName}" telah dikosongkan`);
        fetchTableData(tableName);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal mengosongkan tabel');
    }
  };

  // ---------- DROP TABLE ----------
  const handleDropTable = async (tableName) => {
    try {
      const res = await axios.post(`${API_URL}/table/drop`, {
        ...credentials,
        tableName,
      });
      if (res.data.success) {
        message.success(`Tabel "${tableName}" berhasil dihapus`);
        setTables(res.data.tables);
        setOpenTabs(prev => prev.filter(t => t !== tableName));
        setActiveTab('query');
        setTableDataCache(prev => {
          const next = { ...prev };
          delete next[tableName];
          return next;
        });
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menghapus tabel');
    }
  };

  // ---------- CREATE TABLE BUILDER ----------
  const handleAddColumnToNewTable = () => {
    setNewTableColumns(prev => [
      ...prev,
      { name: `col_${prev.length + 1}`, type: 'TEXT', primaryKey: false, autoIncrement: false, notNull: false, defaultValue: '' }
    ]);
  };

  const handleRemoveColumnFromNewTable = (index) => {
    if (newTableColumns.length <= 1) {
      message.warning('Tabel minimal harus memiliki 1 kolom');
      return;
    }
    setNewTableColumns(prev => prev.filter((_, i) => i !== index));
  };

  const handleNewTableColumnChange = (index, field, value) => {
    setNewTableColumns(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'primaryKey' && value) {
        // Uncheck other primary keys if auto-increment is on
        updated.forEach((c, idx) => {
          if (idx !== index) c.primaryKey = false;
        });
      }
      return updated;
    });
  };

  const handleAddInitialRow = () => {
    setInitialRows(prev => [...prev, {}]);
  };

  const handleInitialRowChange = (rowIndex, colName, value) => {
    setInitialRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [colName]: value };
      return updated;
    });
  };

  const handleFillSampleData = () => {
    const sample1 = {};
    const sample2 = {};
    newTableColumns.forEach((col, idx) => {
      if (col.autoIncrement) return;
      if (col.type.includes('INT') || col.type.includes('NUM') || col.type.includes('REAL')) {
        sample1[col.name] = (idx + 1) * 100;
        sample2[col.name] = (idx + 2) * 150;
      } else if (col.type === 'BOOLEAN') {
        sample1[col.name] = 1;
        sample2[col.name] = 0;
      } else if (col.type.includes('DATE')) {
        sample1[col.name] = '2024-01-01';
        sample2[col.name] = '2024-02-15';
      } else {
        sample1[col.name] = `Sample ${col.name} A`;
        sample2[col.name] = `Sample ${col.name} B`;
      }
    });
    setInitialRows([sample1, sample2]);
    message.info('Data sample awal diisikan!');
  };

  const handleCreateNewTableSubmit = async () => {
    const cleanTableName = newTableName.trim();
    if (!cleanTableName) {
      message.error('Nama tabel wajib diisi');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cleanTableName)) {
      message.error('Nama tabel hanya boleh berisi huruf, angka, dan underscore, diawali huruf/_');
      return;
    }
    if (newTableColumns.length === 0) {
      message.error('Minimal harus mendefinisikan 1 kolom');
      return;
    }
    // Validate column names
    const names = newTableColumns.map(c => c.name.trim());
    if (names.some(n => !n)) {
      message.error('Semua nama kolom harus diisi');
      return;
    }
    if (new Set(names).size !== names.length) {
      message.error('Nama kolom tidak boleh ada yang duplikat');
      return;
    }

    try {
      const payload = {
        ...credentials,
        tableName: cleanTableName,
        columns: newTableColumns,
        initialData: includeInitialData ? initialRows.filter(r => Object.keys(r).length > 0) : [],
      };

      const res = await axios.post(`${API_URL}/table/create`, payload);
      if (res.data.success) {
        message.success(`Tabel "${cleanTableName}" berhasil dibuat!`);
        setNewTableModalVisible(false);
        setNewTableName('');
        setIncludeInitialData(false);
        setInitialRows([{}]);
        setTables(res.data.tables);
        
        // Open the newly created table
        handleTableClick(cleanTableName);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal membuat tabel baru');
    }
  };

  // ---------- KEYBOARD SHORTCUTS ----------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setSearchModalVisible(true);
        setSearchKeyword('');
        setSelectedSearchIndex(0);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeTab === 'query') {
        e.preventDefault();
        handleExecuteQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, handleExecuteQuery]);

  // ---------- QUICK SEARCH KEYBOARD NAV ----------
  const filteredTablesForSearch = tables.filter(t =>
    t.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.min(prev + 1, filteredTablesForSearch.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredTablesForSearch.length > 0) {
      e.preventDefault();
      handleTableClick(filteredTablesForSearch[selectedSearchIndex]);
      setSearchModalVisible(false);
      setSearchKeyword('');
    }
  };

  // ---------- SIDEBAR FILTERED TABLES ----------
  const filteredSidebarTables = tables.filter(t =>
    t.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  // ---------- TAB CLOSE ----------
  const handleTabEdit = (targetKey, action) => {
    if (action === 'remove' && targetKey !== 'query' && targetKey !== 'metrics') {
      const newTabs = openTabs.filter(t => t !== targetKey);
      setOpenTabs(newTabs);
      if (activeTab === targetKey) {
        setActiveTab(newTabs[newTabs.length - 1] || 'metrics');
      }
    }
  };

  // ---------- RENDER: AUTHENTICATION CHECK ----------
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <Spin size="large" tip="Memuat akun..." />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPortal onAuthSuccess={handleAuthSuccess} />;
  }

  // ---------- RENDER: RESTORING SESSION SPLASH ----------
  if (isRestoringSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div className="session-restore-splash">
          <div className="restore-logo-wrapper">
            <img src="/logo.png" alt="ai-jogja" className="restore-logo-img" />
          </div>
          <h3 style={{ color: '#0f172a', marginTop: 20, marginBottom: 8, fontSize: 18, fontWeight: 700 }}>
            Menghubungkan Kembali ke Database...
          </h3>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
            Memulihkan sesi aktif dan tab kerja Anda
          </p>
        </div>
      </div>
    );
  }

  // ---------- RENDER: DATABASE SLOTS HUB ----------
  if (!isConnected) {
    return (
      <DatabaseSlotsHub
        user={currentUser}
        slots={savedDbConnections}
        onRefreshSlots={fetchUserConnections}
        onSelectSlot={handleSelectSavedConnection}
        onLogout={handleLogout}
      />
    );
  }

  // ---------- RENDER: QUERY TAB ----------
  const renderQueryTab = () => (
    <div className="tab-panel query-editor-wrapper">
      <TextArea
        ref={queryInputRef}
        className="query-textarea"
        rows={7}
        value={querySQL}
        onChange={(e) => setQuerySQL(e.target.value)}
        placeholder="-- Tulis query SQL di sini...\nSELECT * FROM your_table LIMIT 10;"
      />
      <div className="query-toolbar">
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={handleExecuteQuery}
          loading={queryLoading}
          style={{ fontWeight: 500 }}
        >
          Run Query
        </Button>
        <span className="header-shortcut-hint">Ctrl + Enter</span>
        {queryResult.data.length > 0 && (
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => exportCSV(queryResult.columns, queryResult.data, 'query_result')}
            style={{ marginLeft: 'auto' }}
          >
            Export CSV
          </Button>
        )}
      </div>
      <div className="query-result-section">
        {queryResult.columns.length > 0 && (
          <>
            <div className="query-result-info">
              <span className="query-result-badge">
                {queryResult.data.length} rows
              </span>
              {queryTime && (
                <span style={{ color: '#5c6070' }}>⏱ {queryTime}ms</span>
              )}
            </div>
            <Table
              columns={queryResult.columns}
              dataSource={queryResult.data}
              rowKey={(_, index) => index}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 50, size: 'small', showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
              size="small"
              bordered
            />
          </>
        )}
        {queryResult.columns.length === 0 && !queryLoading && (
          <div className="empty-state">
            <CodeOutlined />
            <span className="empty-state-text">Tulis query dan tekan Run</span>
            <span className="empty-state-hint">Gunakan Ctrl+Enter untuk eksekusi cepat</span>
          </div>
        )}
      </div>
    </div>
  );

  // ---------- RENDER: TABLE TAB ----------
  const renderTableTab = (tableName) => {
    const data = tableDataCache[tableName];
    const structure = tableStructure[tableName];
    const isStructureCollapsed = structureCollapsed[tableName];

    const currentOrder = customColumnOrder[tableName] || data?.rawColumns || [];
    const hidden = hiddenColumns[tableName] || [];
    const visibleColumnKeys = currentOrder.filter(c => !hidden.includes(c));

    // Sort structure rows according to current column order
    const sortedStructure = structure
      ? [...structure].sort((a, b) => {
          const idxA = currentOrder.indexOf(a.column_name);
          const idxB = currentOrder.indexOf(b.column_name);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        })
      : [];

    // Construct columns for data table with Move Left / Right buttons & Direct Edit Column actions
    const tableDisplayColumns = [
      ...visibleColumnKeys.map((colKey, colIdx) => {
        const isEditingThis = inlineEditingCol === `${tableName}.${colKey}`;
        return {
          title: (
            <div className="col-header-container">
              <span
                style={{ cursor: 'pointer', fontWeight: 600 }}
                title="Klik dua kali atau gunakan ikon edit untuk mengubah nama kolom"
                onDoubleClick={() => {
                  setInlineEditingCol(`${tableName}.${colKey}`);
                  setInlineColNewName(colKey);
                }}
              >
                {colKey}
              </span>
              <span style={{ display: 'inline-flex', gap: 2, marginLeft: 'auto', alignItems: 'center' }}>
                <Popover
                  content={
                    <div style={{ width: 230, padding: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#0f172a' }}>
                        ✏️ Ubah Nama Kolom
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                        Kolom: <Tag color="purple">{colKey}</Tag>
                      </div>
                      <Input
                        size="small"
                        value={inlineColNewName}
                        onChange={(e) => setInlineColNewName(e.target.value)}
                        onPressEnter={() => handleRenameColumnSubmit(tableName, colKey, inlineColNewName)}
                        placeholder="Nama kolom baru..."
                        autoFocus
                        style={{ marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <Button
                          size="small"
                          onClick={() => setInlineEditingCol(null)}
                        >
                          Batal
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          loading={renameLoading}
                          onClick={() => handleRenameColumnSubmit(tableName, colKey, inlineColNewName)}
                          style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                        >
                          Simpan
                        </Button>
                      </div>
                    </div>
                  }
                  title={null}
                  trigger="click"
                  open={isEditingThis}
                  onOpenChange={(open) => {
                    if (open) {
                      setInlineEditingCol(`${tableName}.${colKey}`);
                      setInlineColNewName(colKey);
                    } else {
                      setInlineEditingCol(null);
                    }
                  }}
                  placement="bottomRight"
                >
                  <Tooltip title="Klik Edit Langsung (Ubah nama kolom)">
                    <Button
                      className="col-move-btn col-edit-btn"
                      icon={<EditOutlined style={{ color: '#7c3aed' }} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditingCol(`${tableName}.${colKey}`);
                        setInlineColNewName(colKey);
                      }}
                    />
                  </Tooltip>
                </Popover>
                <Tooltip title="Pindahkan kolom ke kiri">
                  <Button
                    className="col-move-btn"
                    icon={<ArrowLeftOutlined />}
                    disabled={colIdx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveColumn(tableName, colKey, 'left');
                    }}
                  />
                </Tooltip>
                <Tooltip title="Pindahkan kolom ke kanan">
                  <Button
                    className="col-move-btn"
                    icon={<ArrowRightOutlined />}
                    disabled={colIdx === visibleColumnKeys.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveColumn(tableName, colKey, 'right');
                    }}
                  />
                </Tooltip>
              </span>
            </div>
          ),
          dataIndex: colKey,
          key: colKey,
          ellipsis: true,
          width: 180,
        render: (value) => {
          if (value === null) return <span style={{ color: '#5c6070', fontStyle: 'italic' }}>NULL</span>;
          if (typeof value === 'boolean') return <span style={{ color: value ? '#00b894' : '#e17055' }}>{String(value)}</span>;
          if (typeof value === 'object') return <span style={{ color: '#fdcb6e' }}>{JSON.stringify(value)}</span>;
          return String(value);
        },
      };
    }),
      {
        title: 'Actions',
        key: '__actions__',
        fixed: 'right',
        width: 100,
        render: (_, record) => (
          <Space size="small">
            <Tooltip title="Edit baris">
              <Button
                type="text"
                size="small"
                className="row-action-btn"
                icon={<EditOutlined style={{ color: '#a29bfe' }} />}
                onClick={() => openEditRowModal(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Hapus baris ini?"
              okText="Hapus"
              cancelText="Batal"
              okType="danger"
              onConfirm={() => handleDeleteRow(record)}
            >
              <Tooltip title="Hapus baris">
                <Button
                  type="text"
                  size="small"
                  className="row-action-btn"
                  icon={<DeleteOutlined style={{ color: '#e17055' }} />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      }
    ];

    return (
      <div className="tab-panel" key={tableName}>
        {/* Table View Header */}
        <div className="table-view-header">
          <div className="table-view-title">
            <h3>{tableName}</h3>
            {data && <span className="table-badge">{data.total ?? data.data.length} rows</span>}
            {structure && <span className="table-badge" style={{ background: 'rgba(0, 184, 148, 0.12)', color: '#00b894' }}>{structure.length} columns</span>}
          </div>
          <div className="table-view-actions">
            <Tooltip title="Refresh data & struktur">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchTableData(tableName);
                  fetchTableStructure(tableName);
                }}
              >
                Refresh
              </Button>
            </Tooltip>
            {data && (
              <Tooltip title="Export CSV">
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => exportCSV(data.rawColumns, data.data, tableName)}
                >
                  Export CSV
                </Button>
              </Tooltip>
            )}
            <Popconfirm
              title={`Kosongkan semua data tabel "${tableName}"?`}
              description="Aksi ini akan menghapus semua record di dalam tabel."
              okText="Kosongkan"
              cancelText="Batal"
              okType="danger"
              onConfirm={() => handleTruncateTable(tableName)}
            >
              <Button size="small" icon={<ClearOutlined />} danger>
                Truncate
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`Hapus tabel "${tableName}" secara permanen?`}
              description="Aksi ini tidak dapat dibatalkan!"
              okText="Hapus Tabel"
              cancelText="Batal"
              okType="danger"
              onConfirm={() => handleDropTable(tableName)}
            >
              <Button size="small" icon={<DeleteOutlined />} danger type="primary">
                Drop Table
              </Button>
            </Popconfirm>
          </div>
        </div>

        {/* Action Toolbar Strip */}
        <div className="table-toolbar-strip">
          <div className="toolbar-group">
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                addRowForm.resetFields();
                setAddRowModalVisible(true);
              }}
              style={{ background: '#6C5CE7', borderColor: '#6C5CE7' }}
            >
              Insert Row
            </Button>
            <Button
              size="small"
              icon={<AppstoreAddOutlined />}
              onClick={() => {
                addColumnForm.resetFields();
                setAddColumnModalVisible(true);
              }}
            >
              Add Column
            </Button>
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setColumnManageModalVisible(true)}
            >
              Columns & Order ({visibleColumnKeys.length}/{currentOrder.length})
            </Button>
          </div>

          <div className="toolbar-group">
            <span style={{ fontSize: 11, color: '#8b8fa3' }}>
              💡 Gunakan tombol <b>✏️ Edit</b> di judul kolom untuk ubah nama langsung, atau <b>⬅ ➡</b> untuk memindahkan urutan
            </span>
          </div>
        </div>

        {/* Structure section */}
        <div className="structure-section">
          <div
            className={`structure-toggle ${isStructureCollapsed ? 'collapsed' : ''}`}
            onClick={() => setStructureCollapsed(prev => ({ ...prev, [tableName]: !prev[tableName] }))}
          >
            <DownOutlined />
            <KeyOutlined />
            <span>Structure</span>
            {structure && <span style={{ fontWeight: 400, color: '#5c6070' }}>({structure.length} columns)</span>}
          </div>
          {!isStructureCollapsed && structure && (
            <Table
              columns={[
                {
                  title: 'Column',
                  dataIndex: 'column_name',
                  key: 'column_name',
                  width: 200,
                  render: (val, record) => (
                    <span>
                      <span className={record.is_primary_key ? 'pk-column' : ''}>
                        {val}
                      </span>
                      {record.is_primary_key && <span className="pk-badge">PK</span>}
                    </span>
                  ),
                },
                {
                  title: 'Type',
                  dataIndex: 'data_type',
                  key: 'data_type',
                  width: 150,
                  render: (val, record) => (
                    <span className="type-badge">
                      {val}
                      {record.character_maximum_length ? `(${record.character_maximum_length})` : ''}
                    </span>
                  ),
                },
                {
                  title: 'Nullable',
                  dataIndex: 'is_nullable',
                  key: 'is_nullable',
                  width: 100,
                  render: (val) => (
                    <span className={val === 'YES' ? 'nullable-yes' : 'nullable-no'}>
                      {val === 'YES' ? 'Yes' : 'No'}
                    </span>
                  ),
                },
                {
                  title: 'Default',
                  dataIndex: 'column_default',
                  key: 'column_default',
                  ellipsis: true,
                  render: (val) => val
                    ? <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#a29bfe' }}>{val}</span>
                    : <span style={{ color: '#3a3e4a' }}>—</span>,
                },
                {
                  title: 'Action',
                  key: 'action',
                  width: 155,
                  render: (_, record, sIdx) => (
                    <Space size={2}>
                      <Tooltip title="Ubah nama kolom (Rename)">
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined style={{ color: '#7c3aed' }} />}
                          onClick={() => openRenameColumnModal(tableName, record.column_name)}
                        />
                      </Tooltip>
                      <Tooltip title="Geser kolom ke atas / kiri">
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowUpOutlined />}
                          disabled={sIdx === 0}
                          onClick={() => moveColumn(tableName, record.column_name, 'left')}
                        />
                      </Tooltip>
                      <Tooltip title="Geser kolom ke bawah / kanan">
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowDownOutlined />}
                          disabled={sIdx === sortedStructure.length - 1}
                          onClick={() => moveColumn(tableName, record.column_name, 'right')}
                        />
                      </Tooltip>
                      <Popconfirm
                        title={`Hapus kolom "${record.column_name}"?`}
                        description="Data pada kolom ini akan terhapus permanen."
                        okText="Hapus Kolom"
                        cancelText="Batal"
                        okType="danger"
                        onConfirm={() => handleDropColumn(record.column_name)}
                      >
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
              dataSource={sortedStructure}
              rowKey="column_name"
              pagination={false}
              size="small"
              bordered
              style={{ marginBottom: 16 }}
            />
          )}
          {!isStructureCollapsed && !structure && (
            <div className="loading-overlay"><Spin size="small" /> <span style={{ marginLeft: 8 }}>Loading structure...</span></div>
          )}
        </div>

        {/* Data section */}
        <div className="data-section">
          <div className="section-label">
            <TableOutlined />
            <span>Data Records</span>
          </div>
          {data ? (
            <Table
              columns={tableDisplayColumns}
              dataSource={data.data}
              rowKey={(_, index) => index}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 50, size: 'small', showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200] }}
              size="small"
              bordered
            />
          ) : (
            <div className="loading-overlay"><Spin size="small" /> <span style={{ marginLeft: 8 }}>Loading data...</span></div>
          )}
        </div>
      </div>
    );
  };

  // ---------- TAB ITEMS ----------
  const tabItems = openTabs.map(tabKey => {
    if (tabKey === 'metrics') {
      return {
        key: 'metrics',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <DashboardOutlined style={{ fontSize: 13, color: '#4f46e5' }} />
            Ringkasan & Metrik
          </span>
        ),
        children: (
          <DatabaseMetricsDashboard
            credentials={credentials}
            onNavigateToQuery={() => {
              if (!openTabs.includes('query')) setOpenTabs(prev => [...prev, 'query']);
              setActiveTab('query');
            }}
            onOpenTable={(tableName) => handleTableClick(tableName)}
          />
        ),
        closable: false,
      };
    }
    if (tabKey === 'query') {
      return {
        key: 'query',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CodeOutlined style={{ fontSize: 13, color: '#0891b2' }} />
            Query
          </span>
        ),
        children: renderQueryTab(),
        closable: false,
      };
    }
    return {
      key: tabKey,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TableOutlined style={{ fontSize: 12 }} />
          {tabKey}
        </span>
      ),
      children: renderTableTab(tabKey),
      closable: true,
    };
  });

  // Active table structure for Add/Edit row modals
  const currentActiveStructure = (activeTab && activeTab !== 'query' && activeTab !== 'metrics')
    ? (tableStructure[activeTab] || [])
    : [];

  // ---------- RENDER: MAIN LAYOUT ----------
  return (
    <div className="app-layout">
      {/* Header */}
      <div className="app-header">
        <div className="header-logo">
          <img src="/logo.png" alt="ai-jogja Logo" className="header-logo-img" />
          <span className="header-logo-text">App Database</span>
          <span className="header-logo-badge">ai-jogja</span>
        </div>
        <div className="header-connection-info">
          <span className="header-connection-dot" />
          <span>{credentials?.database}@{credentials?.host}</span>
        </div>
        <div className="header-actions">
          <Tooltip title="Kembali ke Dashboard Pilihan Slot Database">
            <Button
              size="small"
              icon={<SwapOutlined style={{ color: '#4f46e5' }} />}
              onClick={() => setIsConnected(false)}
              style={{ borderRadius: 6, fontWeight: 500 }}
            >
              Ganti Database
            </Button>
          </Tooltip>
          <span className="header-shortcut-hint">Ctrl+P Search</span>
          <UserHeader
            user={currentUser}
            onLogout={handleLogout}
            savedConnectionsCount={savedDbConnections.length}
          />
          <Button
            className="disconnect-btn"
            size="small"
            icon={<DisconnectOutlined />}
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="app-body">
        {/* Sidebar */}
        <div className="app-sidebar">
          {/* Quick Nav Links */}
          <div className="sidebar-quick-nav">
            <div
              className={`sidebar-nav-item ${activeTab === 'metrics' ? 'active' : ''}`}
              onClick={() => {
                if (!openTabs.includes('metrics')) setOpenTabs(prev => ['metrics', ...prev]);
                setActiveTab('metrics');
              }}
            >
              <DashboardOutlined style={{ color: '#4f46e5', fontSize: 14 }} />
              <span>Ringkasan & Metrik</span>
            </div>
            <div
              className={`sidebar-nav-item ${activeTab === 'query' ? 'active' : ''}`}
              onClick={() => {
                if (!openTabs.includes('query')) setOpenTabs(prev => [...prev, 'query']);
                setActiveTab('query');
              }}
            >
              <CodeOutlined style={{ color: '#0891b2', fontSize: 14 }} />
              <span>Query Editor</span>
            </div>
          </div>

          <Divider style={{ margin: '8px 0', borderColor: '#f1f5f9' }} />

          <div className="sidebar-search">
            <Input
              placeholder="Cari tabel..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              onChange={(e) => setSidebarSearch(e.target.value)}
              value={sidebarSearch}
              allowClear
            />
          </div>

          <div className="sidebar-header-action">
            <div className="sidebar-section-title" style={{ padding: 0 }}>
              TABEL ({filteredSidebarTables.length})
            </div>
            <Button
              className="new-table-btn"
              icon={<PlusOutlined />}
              onClick={() => setNewTableModalVisible(true)}
            >
              + Tabel Baru
            </Button>
          </div>

          <div className="sidebar-tables">
            {filteredSidebarTables.map(t => (
              <div
                key={t}
                className={`sidebar-table-item ${activeTab === t ? 'active' : ''}`}
                onClick={() => handleTableClick(t)}
              >
                <TableOutlined />
                <span>{t}</span>
              </div>
            ))}
            {filteredSidebarTables.length === 0 && (
              <div style={{ padding: '16px', color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
                Tidak ada tabel ditemukan
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="app-content">
          <div className="app-tabs">
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={tabItems}
              type="editable-card"
              onEdit={handleTabEdit}
              hideAdd
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-item">
          <span className="status-bar-dot connected" />
          <span>Connected</span>
        </div>
        <div className="status-bar-item">
          <span>{credentials?.type ? credentials.type.toUpperCase() : (credentials?.database === 'demo' ? 'SQLITE' : 'POSTGRESQL')}</span>
        </div>
        <div className="status-bar-item">
          <span>{credentials?.host}:{credentials?.port}</span>
        </div>
        <div className="status-bar-item">
          <span>{tables.length} tabel</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: CREATE NEW TABLE WITH INITIAL DATA */}
      {/* ============================================================ */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TableOutlined style={{ color: '#6C5CE7' }} />
            <span>Buat Tabel Baru (Create Table)</span>
          </div>
        }
        open={newTableModalVisible}
        onCancel={() => setNewTableModalVisible(false)}
        width={720}
        okText="Buat Tabel Sekarang"
        cancelText="Batal"
        onOk={handleCreateNewTableSubmit}
        centered
        destroyOnClose
      >
        <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
          {/* Table Name */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Nama Tabel (Table Name)</Text>
            <Input
              placeholder="Contoh: users, inventory, invoices..."
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              prefix={<TableOutlined style={{ color: '#8b8fa3' }} />}
            />
          </div>

          <Divider style={{ margin: '14px 0', borderColor: '#2d3139' }} />

          {/* Columns Builder */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>Definisi Kolom ({newTableColumns.length} kolom)</Text>
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddColumnToNewTable}
                style={{ color: '#a29bfe', borderColor: '#6C5CE7' }}
              >
                Tambah Kolom
              </Button>
            </div>

            {newTableColumns.map((col, index) => (
              <div key={index} className="builder-column-row">
                <Input
                  placeholder="Nama kolom"
                  value={col.name}
                  onChange={(e) => handleNewTableColumnChange(index, 'name', e.target.value)}
                  style={{ width: 140 }}
                />
                <Select
                  value={col.type}
                  onChange={(val) => handleNewTableColumnChange(index, 'type', val)}
                  style={{ width: 130 }}
                >
                  {COLUMN_TYPES.map(t => (
                    <Option key={t} value={t}>{t}</Option>
                  ))}
                </Select>
                <Checkbox
                  checked={col.primaryKey}
                  onChange={(e) => handleNewTableColumnChange(index, 'primaryKey', e.target.checked)}
                >
                  PK
                </Checkbox>
                <Checkbox
                  checked={col.autoIncrement}
                  disabled={!col.primaryKey}
                  onChange={(e) => handleNewTableColumnChange(index, 'autoIncrement', e.target.checked)}
                >
                  Auto
                </Checkbox>
                <Checkbox
                  checked={col.notNull}
                  onChange={(e) => handleNewTableColumnChange(index, 'notNull', e.target.checked)}
                >
                  Not Null
                </Checkbox>
                <Input
                  placeholder="Default"
                  value={col.defaultValue}
                  onChange={(e) => handleNewTableColumnChange(index, 'defaultValue', e.target.value)}
                  style={{ width: 90 }}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemoveColumnFromNewTable(index)}
                />
              </div>
            ))}
          </div>

          <Divider style={{ margin: '14px 0', borderColor: '#2d3139' }} />

          {/* Initial Data Builder */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <Text strong style={{ marginRight: 8 }}>Sertakan Data Awal (Initial Data)</Text>
                <Switch
                  checked={includeInitialData}
                  onChange={setIncludeInitialData}
                  size="small"
                />
              </div>
              {includeInitialData && (
                <Space>
                  <Button size="small" onClick={handleFillSampleData}>
                    Isi Sample Otomatis
                  </Button>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={handleAddInitialRow}>
                    Tambah Baris
                  </Button>
                </Space>
              )}
            </div>

            {includeInitialData && (
              <div>
                {initialRows.map((rowObj, rIdx) => (
                  <div key={rIdx} className="initial-row-box">
                    <div className="initial-row-title">
                      <span>Baris #{rIdx + 1}</span>
                      {initialRows.length > 1 && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => setInitialRows(prev => prev.filter((_, i) => i !== rIdx))}
                        />
                      )}
                    </div>
                    <Row gutter={[8, 8]}>
                      {newTableColumns.map((col, cIdx) => (
                        <Col span={8} key={cIdx}>
                          <div style={{ fontSize: 10, color: '#8b8fa3', marginBottom: 2 }}>
                            {col.name} {col.autoIncrement ? '(auto)' : ''}
                          </div>
                          <Input
                            size="small"
                            placeholder={col.autoIncrement ? 'Auto' : col.type}
                            value={rowObj[col.name] ?? ''}
                            onChange={(e) => handleInitialRowChange(rIdx, col.name, e.target.value)}
                          />
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: ADD COLUMN */}
      {/* ============================================================ */}
      <Modal
        title={`Tambah Kolom Baru ke Tabel "${activeTab}"`}
        open={addColumnModalVisible}
        onCancel={() => setAddColumnModalVisible(false)}
        onOk={() => addColumnForm.submit()}
        okText="Tambah Kolom"
        cancelText="Batal"
        destroyOnClose
      >
        <Form
          form={addColumnForm}
          layout="vertical"
          onFinish={handleAddColumnSubmit}
          initialValues={{ columnType: 'TEXT', notNull: false }}
        >
          <Form.Item
            label="Nama Kolom"
            name="columnName"
            rules={[
              { required: true, message: 'Nama kolom wajib diisi' },
              { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Format nama tidak valid' }
            ]}
          >
            <Input placeholder="Contoh: phone_number, status, notes..." />
          </Form.Item>

          <Form.Item label="Tipe Data" name="columnType" rules={[{ required: true }]}>
            <Select>
              {COLUMN_TYPES.map(t => (
                <Option key={t} value={t}>{t}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Nilai Default (Opsional)" name="defaultValue">
            <Input placeholder="Contoh: 'active', 0, NULL" />
          </Form.Item>

          <Form.Item name="notNull" valuePropName="checked">
            <Checkbox>NOT NULL (Kolom tidak boleh kosong)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2.5: RENAME COLUMN (Klik Edit Langsung) */}
      {/* ============================================================ */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#7c3aed', fontSize: 18 }} />
            <span>Ubah Nama Kolom (Rename Column)</span>
          </div>
        }
        open={renameColumnModalVisible}
        onCancel={() => {
          setRenameColumnModalVisible(false);
          renameColumnForm.resetFields();
        }}
        onOk={() => renameColumnForm.submit()}
        confirmLoading={renameLoading}
        okText="Simpan Nama Baru"
        cancelText="Batal"
        okButtonProps={{ style: { background: '#7c3aed', borderColor: '#7c3aed' } }}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Text style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
            Tabel: <b style={{ color: '#0f172a' }}>{renamingColumn.tableName || activeTab}</b>
          </Text>
          <Text style={{ fontSize: 12, color: '#64748b' }}>
            Kolom saat ini: <Tag color="purple" style={{ fontWeight: 600 }}>{renamingColumn.oldName}</Tag>
          </Text>
        </div>
        <Form
          form={renameColumnForm}
          layout="vertical"
          onFinish={(values) =>
            handleRenameColumnSubmit(
              renamingColumn.tableName || activeTab,
              renamingColumn.oldName,
              values.newColumnName
            )
          }
        >
          <Form.Item
            name="newColumnName"
            label="Nama Kolom Baru"
            rules={[
              { required: true, message: 'Nama kolom baru tidak boleh kosong' },
              {
                validator: (_, val) => {
                  if (val && val.trim() === renamingColumn.oldName) {
                    return Promise.reject(new Error('Nama baru tidak boleh sama dengan nama saat ini'));
                  }
                  if (val && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val.trim())) {
                    return Promise.reject(new Error('Format tidak valid. Awali huruf/underscore dan gunakan karakter alfanumerik.'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input
              placeholder="Contoh: nip_baru, user_email, full_name..."
              autoFocus
              prefix={<EditOutlined style={{ color: '#94a3b8' }} />}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: COLUMNS ORDER & VISIBILITY */}
      {/* ============================================================ */}
      <Modal
        title={`Kelola Urutan & Tampilan Kolom: "${activeTab}"`}
        open={columnManageModalVisible}
        onCancel={() => setColumnManageModalVisible(false)}
        footer={[
          <Button key="reset" onClick={() => resetColumnOrder(activeTab)}>
            Reset ke Default
          </Button>,
          <Button key="close" type="primary" onClick={() => setColumnManageModalVisible(false)}>
            Selesai
          </Button>,
        ]}
      >
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Atur urutan kolom dan visibilitasnya di tabel data:
          </Text>
          {(customColumnOrder[activeTab] || tableDataCache[activeTab]?.rawColumns || []).map((col, idx, arr) => {
            const isHidden = (hiddenColumns[activeTab] || []).includes(col);
            return (
              <div
                key={col}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid #2d3139',
                  borderRadius: 6,
                  marginBottom: 6,
                  opacity: isHidden ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Checkbox
                    checked={!isHidden}
                    onChange={() => toggleColumnVisibility(activeTab, col)}
                  />
                  <Text strong={!isHidden}>{col}</Text>
                </div>
                <Space>
                  <Tooltip title="Ubah Nama Kolom (Rename)">
                    <Button
                      size="small"
                      icon={<EditOutlined style={{ color: '#7c3aed' }} />}
                      onClick={() => openRenameColumnModal(activeTab, col)}
                    >
                      Rename
                    </Button>
                  </Tooltip>
                  <Button
                    size="small"
                    icon={<ArrowLeftOutlined />}
                    disabled={idx === 0}
                    onClick={() => moveColumn(activeTab, col, 'left')}
                  >
                    Atas / Kiri
                  </Button>
                  <Button
                    size="small"
                    icon={<ArrowRightOutlined />}
                    disabled={idx === arr.length - 1}
                    onClick={() => moveColumn(activeTab, col, 'right')}
                  >
                    Bawah / Kanan
                  </Button>
                </Space>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: INSERT ROW */}
      {/* ============================================================ */}
      <Modal
        title={`Tambah Baris Baru ke "${activeTab}"`}
        open={addRowModalVisible}
        onCancel={() => setAddRowModalVisible(false)}
        onOk={() => addRowForm.submit()}
        okText="Simpan Baris"
        cancelText="Batal"
        destroyOnClose
        width={560}
      >
        <Form form={addRowForm} layout="vertical" onFinish={handleAddRowSubmit}>
          <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 6 }}>
            {currentActiveStructure.map((col) => (
              <Form.Item
                key={col.column_name}
                label={
                  <span>
                    <b>{col.column_name}</b>{' '}
                    <span style={{ fontSize: 11, color: '#8b8fa3' }}>
                      ({col.data_type}
                      {col.is_primary_key ? ' - Primary Key' : ''}
                      {col.is_nullable === 'NO' ? ' - Required' : ''})
                    </span>
                  </span>
                }
                name={col.column_name}
                rules={
                  col.is_nullable === 'NO' && !col.is_primary_key && !col.column_default
                    ? [{ required: true, message: `${col.column_name} harus diisi` }]
                    : []
                }
              >
                <Input placeholder={col.column_default ? `Default: ${col.column_default}` : `Isi ${col.column_name}`} />
              </Form.Item>
            ))}
          </div>
        </Form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 5: EDIT ROW */}
      {/* ============================================================ */}
      <Modal
        title={`Edit Baris di "${activeTab}"`}
        open={editRowModalVisible}
        onCancel={() => setEditRowModalVisible(false)}
        onOk={() => editRowForm.submit()}
        okText="Perbarui Baris"
        cancelText="Batal"
        destroyOnClose
        width={560}
      >
        <Form form={editRowForm} layout="vertical" onFinish={handleEditRowSubmit}>
          <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 6 }}>
            {currentActiveStructure.map((col) => (
              <Form.Item
                key={col.column_name}
                label={
                  <span>
                    <b>{col.column_name}</b>{' '}
                    <span style={{ fontSize: 11, color: '#8b8fa3' }}>
                      ({col.data_type}
                      {col.is_primary_key ? ' - Primary Key' : ''})
                    </span>
                  </span>
                }
                name={col.column_name}
              >
                <Input disabled={col.is_primary_key} />
              </Form.Item>
            ))}
          </div>
        </Form>
      </Modal>

      {/* Quick Search Modal */}
      <Modal
        className="quick-search-modal"
        open={searchModalVisible}
        onCancel={() => setSearchModalVisible(false)}
        footer={null}
        width={480}
        closable={false}
        centered
        destroyOnClose
      >
        <div className="quick-search-input">
          <Input
            ref={searchInputRef}
            placeholder="Search tables..."
            autoFocus
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              setSelectedSearchIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            prefix={<SearchOutlined style={{ color: '#5c6070' }} />}
            suffix={<span className="header-shortcut-hint">Ctrl+P</span>}
          />
        </div>
        <div className="quick-search-results">
          {filteredTablesForSearch.map((t, idx) => (
            <div
              key={t}
              className={`quick-search-item ${idx === selectedSearchIndex ? 'selected' : ''}`}
              onClick={() => {
                handleTableClick(t);
                setSearchModalVisible(false);
                setSearchKeyword('');
              }}
              onMouseEnter={() => setSelectedSearchIndex(idx)}
            >
              <TableOutlined />
              <span>{t}</span>
            </div>
          ))}
          {filteredTablesForSearch.length === 0 && (
            <div className="quick-search-empty">
              {searchKeyword ? `No tables matching "${searchKeyword}"` : 'Start typing to search...'}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Koneksi Tersimpan Per-Akun */}
      <SavedConnectionsModal
        visible={savedConnectionsModalVisible}
        onClose={() => setSavedConnectionsModalVisible(false)}
        connections={savedDbConnections}
        onSelectConnection={handleSelectSavedConnection}
        onDeleteConnection={handleDeleteSavedConnection}
        onAddNew={() => {
          setSavedConnectionsModalVisible(false);
          setIsConnected(false);
        }}
      />
    </div>
  );
}

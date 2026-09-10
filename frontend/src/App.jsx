import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Input, Button, Table, Tabs, Modal, message, Form, Typography, Space, Spin, Tooltip,
  Popconfirm, Select, Checkbox, Switch, Tag, Badge, Card, Divider, Row, Col, Segmented,
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
} from '@ant-design/icons';

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
  const [activeTab, setActiveTab] = useState('query');
  const [openTabs, setOpenTabs] = useState(['query']);
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

  // Modals state
  const [newTableModalVisible, setNewTableModalVisible] = useState(false);
  const [addColumnModalVisible, setAddColumnModalVisible] = useState(false);
  const [columnManageModalVisible, setColumnManageModalVisible] = useState(false);
  const [addRowModalVisible, setAddRowModalVisible] = useState(false);
  const [editRowModalVisible, setEditRowModalVisible] = useState(false);
  const [editingRowRecord, setEditingRowRecord] = useState(null);

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
    try {
      let str = (rawStr || '').replace(/[\r\n\t]/g, '').trim();
      if (!str) return null;
      if (!str.includes('://')) {
        str = 'postgresql://' + str;
      }
      const url = new URL(str);
      const port = url.port || (url.protocol.startsWith('postgres') ? '5432' : '3001');
      const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const user = decodeURIComponent(url.username || '');
      const password = decodeURIComponent(url.password || '');
      const host = url.hostname || '';
      if (!host && !database) return null;
      return { host, port, database, user, password };
    } catch {
      return null;
    }
  }, []);

  const [parsedPreview, setParsedPreview] = useState(() => {
    const initialUri = 'postgresql://uazuSleyutH953G5A.jkt1_003:b56aabd50b51c19d747f830f@pgsql-dbas-jkt1-003.sumobase.my.id:6432/db658b2889efac70aa';
    try {
      const url = new URL(initialUri);
      return {
        host: url.hostname || '',
        port: url.port || '6432',
        database: decodeURIComponent(url.pathname.replace(/^\//, '')),
        user: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
      };
    } catch {
      return null;
    }
  });

  const handleConnStringInput = (val) => {
    setConnString(val);
    const parsed = parseConnectionString(val);
    if (parsed) {
      setParsedPreview(parsed);
      connectionForm.setFieldsValue(parsed);
    } else {
      setParsedPreview(null);
    }
  };

  const handleSelectPreset = (uri) => {
    setConnString(uri);
    const parsed = parseConnectionString(uri);
    if (parsed) {
      setParsedPreview(parsed);
      connectionForm.setFieldsValue(parsed);
    }
    message.info('Connection string preset dimuat');
  };

  const handleConnectWithUri = () => {
    const parsed = parseConnectionString(connString);
    if (!parsed || !parsed.host || !parsed.database) {
      message.error('Format Connection String tidak valid. Contoh: postgresql://user:pass@host:5432/dbname');
      return;
    }
    connectionForm.setFieldsValue(parsed);
    handleConnect(parsed);
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
      const res = await axios.post(`${API_URL}/connect`, values);
      if (res.data.success) {
        setCredentials(values);
        setTables(res.data.tables);
        setIsConnected(true);
        message.success(`Terhubung! Ditemukan ${res.data.tables.length} tabel.`);
        setTableDataCache({});
        setTableStructure({});

        const nextOpenTabs = (initialTabs && Array.isArray(initialTabs) && initialTabs.length > 0)
          ? initialTabs
          : (res.data.tables.length > 0 ? ['query', res.data.tables[0]] : ['query']);
        const nextActiveTab = initialActiveTab || (res.data.tables.length > 0 ? res.data.tables[0] : 'query');

        setOpenTabs(nextOpenTabs);
        setActiveTab(nextActiveTab);

        if (nextActiveTab !== 'query') {
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
    setOpenTabs(['query']);
    setActiveTab('query');
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
    if (newTab !== 'query') {
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
    if (action === 'remove' && targetKey !== 'query') {
      const newTabs = openTabs.filter(t => t !== targetKey);
      setOpenTabs(newTabs);
      if (activeTab === targetKey) {
        setActiveTab(newTabs[newTabs.length - 1] || 'query');
      }
    }
  };

  // ---------- RENDER: RESTORING SESSION SPLASH ----------
  if (isRestoringSession) {
    return (
      <div className="connection-page">
        <div className="session-restore-splash">
          <div className="restore-logo-wrapper">
            <img src="/logo.png" alt="ai-jogja" className="restore-logo-img" />
          </div>
          <h3 style={{ color: '#fff', marginTop: 20, marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
            Menghubungkan Kembali ke Database...
          </h3>
          <p style={{ color: '#8b8fa3', fontSize: 13, margin: 0 }}>
            Memulihkan sesi aktif dan tab kerja Anda
          </p>
        </div>
      </div>
    );
  }

  // ---------- RENDER: CONNECTION PAGE ----------
  if (!isConnected) {
    return (
      <div className="connection-page">
        <div className="connection-card">
          <div className="connection-logo">
            <div className="connection-logo-brand">
              <img src="/logo.png" alt="ai-jogja Logo" className="connection-logo-img" />
              <div className="connection-logo-title-group">
                <span className="connection-logo-text">App Database</span>
              </div>
            </div>
          </div>
          <p className="connection-subtitle">Connect to your database</p>

          {/* Mode Switcher */}
          <Segmented
            className="conn-mode-segmented"
            block
            value={connectionMode}
            onChange={setConnectionMode}
            options={[
              { label: <span><LinkOutlined /> Connection String</span>, value: 'uri' },
              { label: <span><SettingOutlined /> Manual Parameters</span>, value: 'manual' },
            ]}
          />

          {/* Quick Presets */}
          <div className="presets-container">
            <span style={{ fontSize: 11, color: '#8b8fa3' }}>Presets:</span>
            <Button
              className="preset-chip"
              size="small"
              onClick={() => handleSelectPreset('postgresql://uazuSleyutH953G5A.jkt1_003:b56aabd50b51c19d747f830f@pgsql-dbas-jkt1-003.sumobase.my.id:6432/db658b2889efac70aa')}
            >
              🐘 SumoPod PG
            </Button>
            <Button
              className="preset-chip"
              size="small"
              onClick={() => handleSelectPreset('postgresql://demo:demo@localhost:3001/demo')}
            >
              ⚡ Demo SQLite (Local)
            </Button>
          </div>

          {/* MODE 1: Connection String */}
          {connectionMode === 'uri' ? (
            <div>
              <div style={{ marginBottom: 6 }}>
                <Text strong style={{ fontSize: 12 }}>Connection URI / URL</Text>
              </div>
              <TextArea
                rows={3}
                value={connString}
                onChange={(e) => handleConnStringInput(e.target.value)}
                placeholder="postgresql://username:password@host:port/database"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
              />

              {parsedPreview ? (
                <div className="parsed-preview-box">
                  <div className="parsed-preview-header">
                    <span>Parsed Components (Auto-Split)</span>
                    <Tag color="purple" style={{ marginRight: 0, fontSize: 10 }}>Valid URI</Tag>
                  </div>
                  <div className="parsed-preview-grid">
                    <div className="parsed-preview-item">
                      <span className="parsed-preview-label">Host</span>
                      <span className="parsed-preview-val">{parsedPreview.host || '—'}</span>
                    </div>
                    <div className="parsed-preview-item">
                      <span className="parsed-preview-label">Port</span>
                      <span className="parsed-preview-val">{parsedPreview.port || '5432'}</span>
                    </div>
                    <div className="parsed-preview-item">
                      <span className="parsed-preview-label">Database</span>
                      <span className="parsed-preview-val">{parsedPreview.database || '—'}</span>
                    </div>
                    <div className="parsed-preview-item">
                      <span className="parsed-preview-label">Username</span>
                      <span className="parsed-preview-val">{parsedPreview.user || '—'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 8, marginBottom: 16, color: '#e17055', fontSize: 11 }}>
                  ⚠️ Format URI belum valid. Contoh: <code>postgresql://user:pass@host:5432/dbname</code>
                </div>
              )}

              <Button
                type="primary"
                loading={loading}
                block
                size="large"
                icon={<ThunderboltOutlined />}
                onClick={handleConnectWithUri}
                style={{ height: 44, fontWeight: 600, marginTop: 4 }}
              >
                {loading ? connectingStatus || 'Menghubungkan...' : 'Parse & Connect'}
              </Button>
            </div>
          ) : (
            /* MODE 2: Manual Parameters */
            <Form
              form={connectionForm}
              layout="vertical"
              onFinish={handleConnect}
              requiredMark={false}
              size="large"
            >
              <Form.Item label="Host" name="host" rules={[{ required: true, message: 'Host diperlukan' }]}>
                <Input placeholder="localhost" prefix={<span style={{ color: '#5c6070', fontSize: 12 }}>🖥</span>} />
              </Form.Item>
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item label="Port" name="port" rules={[{ required: true, message: 'Port diperlukan' }]} style={{ flex: 1 }}>
                  <Input placeholder="5432" />
                </Form.Item>
                <Form.Item label="Database" name="database" rules={[{ required: true, message: 'Database diperlukan' }]} style={{ flex: 2 }}>
                  <Input placeholder="my_database" />
                </Form.Item>
              </div>
              <Form.Item label="Username" name="user" rules={[{ required: true, message: 'Username diperlukan' }]}>
                <Input placeholder="postgres" />
              </Form.Item>
              <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Password diperlukan' }]}>
                <Input.Password placeholder="••••••••" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                  icon={<ThunderboltOutlined />}
                  style={{ height: 44, fontWeight: 600 }}
                >
                  {loading ? connectingStatus || 'Menghubungkan...' : 'Connect'}
                </Button>
              </Form.Item>
            </Form>
          )}

          {/* Remember Login Checkbox */}
          <div style={{ marginTop: 14, marginBottom: 12 }}>
            <Checkbox
              checked={rememberLogin}
              onChange={(e) => {
                setRememberLogin(e.target.checked);
                try {
                  localStorage.setItem('appdb_remember', e.target.checked ? 'true' : 'false');
                  if (!e.target.checked) {
                    localStorage.removeItem('appdb_session');
                  }
                } catch { /* ignore */ }
              }}
            >
              <span style={{ fontSize: 12, color: '#a29bfe' }}>
                Ingat data login & simpan sesi (Auto-reconnect saat browser di-refresh)
              </span>
            </Checkbox>
          </div>

          {/* Saved History List */}
          {savedHistory.length > 0 && (
            <div className="history-box">
              <div className="history-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <HistoryOutlined style={{ color: '#6C5CE7' }} />
                  Riwayat Koneksi Tersimpan ({savedHistory.length})
                </span>
                <Button
                  type="link"
                  size="small"
                  onClick={clearAllHistory}
                  style={{ padding: 0, fontSize: 10, color: '#8b8fa3' }}
                >
                  Bersihkan
                </Button>
              </div>
              <div className="history-list">
                {savedHistory.map((hist) => (
                  <div
                    key={hist.id}
                    className="history-item-row"
                    onClick={() => handleApplyHistory(hist)}
                  >
                    <div className="history-item-title">
                      <DatabaseOutlined style={{ fontSize: 12, color: '#a29bfe' }} />
                      <span>{hist.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="history-item-meta">
                        {hist.user} • {new Date(hist.timestamp).toLocaleDateString()}
                      </span>
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined style={{ fontSize: 10, color: '#e17055' }} />}
                        onClick={(e) => deleteHistoryItem(hist.id, e)}
                        style={{ height: 20, width: 20, padding: 0 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Branding */}
          <div className="login-footer-attribution">
            <span className="footer-ai-jogja-badge">AI-JOGJA</span>
            <span className="footer-creator-text">Dibuat oleh <strong>Fajar Wahyudi</strong></span>
          </div>
        </div>
      </div>
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

    // Construct columns for data table with Move Left / Right buttons & Edit/Delete actions
    const tableDisplayColumns = [
      ...visibleColumnKeys.map((colKey, colIdx) => ({
        title: (
          <div className="col-header-container">
            <span>{colKey}</span>
            <span style={{ display: 'inline-flex', gap: 2, marginLeft: 'auto' }}>
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
      })),
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
              💡 Gunakan tombol <b>⬅ ➡</b> di judul kolom untuk memindahkan urutan kolom
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
                  width: 130,
                  render: (_, record, sIdx) => (
                    <Space size={2}>
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
    if (tabKey === 'query') {
      return {
        key: 'query',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CodeOutlined style={{ fontSize: 13 }} />
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
  const currentActiveStructure = (activeTab && activeTab !== 'query')
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
          <span className="header-shortcut-hint">Ctrl+P Search</span>
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
          <div className="sidebar-search">
            <Input
              placeholder="Search tables..."
              prefix={<SearchOutlined style={{ color: '#5c6070' }} />}
              onChange={(e) => setSidebarSearch(e.target.value)}
              value={sidebarSearch}
              allowClear
            />
          </div>

          <div className="sidebar-header-action">
            <div className="sidebar-section-title" style={{ padding: 0 }}>
              TABLES
              <span className="sidebar-table-count">{filteredSidebarTables.length}</span>
            </div>
            <Button
              className="new-table-btn"
              icon={<PlusOutlined />}
              onClick={() => setNewTableModalVisible(true)}
            >
              + New Table
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
              <div style={{ padding: '16px', color: '#5c6070', fontSize: 12, textAlign: 'center' }}>
                No tables found
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
          <span>{credentials?.database === 'demo' ? 'SQLite (Demo)' : 'PostgreSQL'}</span>
        </div>
        <div className="status-bar-item">
          <span>{credentials?.host}:{credentials?.port}</span>
        </div>
        <div className="status-bar-item">
          <span>{tables.length} tables</span>
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
    </div>
  );
}

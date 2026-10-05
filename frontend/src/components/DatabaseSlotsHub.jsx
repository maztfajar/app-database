import React, { useState } from 'react';
import {
  Card, Button, Typography, Tag, Modal, Form, Input, Select,
  Row, Col, Popconfirm, message, Tooltip, Empty, Segmented, Space, Switch, Alert,
} from 'antd';
import {
  PlusOutlined, DatabaseOutlined, ThunderboltOutlined, EditOutlined,
  DeleteOutlined, CheckCircleOutlined, SettingOutlined, LinkOutlined,
  GlobalOutlined, DesktopOutlined, SearchOutlined, ReloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { parseDatabaseUri } from '../utils/dbUriParser';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const DB_TYPES = [
  { value: 'postgres', label: 'PostgreSQL', icon: '🐘', defaultPort: '5432', color: 'blue' },
  { value: 'mysql', label: 'MySQL / MariaDB', icon: '🐬', defaultPort: '3306', color: 'cyan' },
  { value: 'sqlite', label: 'SQLite', icon: '⚡', defaultPort: '3001', color: 'purple' },
  { value: 'mssql', label: 'SQL Server (MSSQL)', icon: '🏢', defaultPort: '1433', color: 'geekblue' },
  { value: 'other', label: 'Lainnya (SQL/Generic)', icon: '🗄️', defaultPort: '5432', color: 'default' },
];

export default function DatabaseSlotsHub({
  user,
  slots = [],
  onRefreshSlots,
  onSelectSlot,
  onLogout,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [slotForm] = Form.useForm();
  const [configMode, setConfigMode] = useState('uri'); // 'uri' | 'manual'
  const [selectedType, setSelectedType] = useState('postgres');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [connectingSlotId, setConnectingSlotId] = useState(null);
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  const openCreateModal = (preset = null) => {
    setEditingSlot(null);
    setTestResult(null);
    slotForm.resetFields();
    if (preset) {
      setSelectedType(preset.type || 'postgres');
      setConfigMode(preset.connection_string ? 'uri' : 'manual');
      slotForm.setFieldsValue({
        name: preset.name,
        type: preset.type || 'postgres',
        connection_string: preset.connection_string || '',
        host: preset.host || 'localhost',
        port: preset.port || '5432',
        database_name: preset.database_name || '',
        username: preset.username || '',
      });
    } else {
      setSelectedType('postgres');
      setConfigMode('uri');
      slotForm.setFieldsValue({
        type: 'postgres',
        port: '5432',
      });
    }
    setModalVisible(true);
  };

  const openEditModal = async (slot) => {
    setEditingSlot(slot);
    setTestResult(null);
    try {
      const res = await axios.get(`/api/user/connections/${slot.id}/credentials`);
      if (res.data.success) {
        const creds = res.data.credentials;
        setSelectedType(creds.type || slot.type || 'postgres');
        const hasUri = !!creds.connection_string;
        setConfigMode(hasUri ? 'uri' : 'manual');
        slotForm.setFieldsValue({
          name: creds.name || slot.name,
          type: creds.type || slot.type || 'postgres',
          connection_string: creds.connection_string || '',
          host: creds.host || '',
          port: creds.port ? String(creds.port) : '5432',
          database_name: creds.database || slot.database_name || '',
          username: creds.user || slot.username || '',
          password: creds.password || '',
          ssl: creds.ssl,
        });
        setModalVisible(true);
      }
    } catch (err) {
      message.error('Gagal memuat rincian slot database.');
    }
  };

  const handleSwitchToPort6543 = () => {
    const currUri = slotForm.getFieldValue('connection_string') || '';
    if (currUri.includes(':5432')) {
      const updated = currUri.replace(':5432', ':6543');
      slotForm.setFieldsValue({ connection_string: updated });
      message.success('Port berhasil dialihkan ke 6543 (Transaction Mode)! Menguji ulang koneksi...');
      setTimeout(() => {
        handleTestConnection();
      }, 200);
    } else if (slotForm.getFieldValue('port') === '5432' || slotForm.getFieldValue('port') === 5432) {
      slotForm.setFieldsValue({ port: '6543' });
      message.success('Port berhasil diubah ke 6543! Menguji ulang koneksi...');
      setTimeout(() => {
        handleTestConnection();
      }, 200);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestResult(null);
      const values = slotForm.getFieldsValue();
      let testPayload = {};

      if (configMode === 'uri') {
        const rawUri = values.connection_string?.trim();
        if (!rawUri) {
          message.warning('Harap masukkan Connection URI / URL terlebih dahulu.');
          return;
        }
        const parsed = parseDatabaseUri(rawUri);
        if (!parsed) {
          setTestResult({
            success: false,
            message: 'Format Connection URI tidak valid. Contoh: postgresql://user:pass@host:port/dbname',
          });
          return;
        }
        testPayload = {
          ...parsed,
          type: parsed.type || values.type,
          connection_string: rawUri,
        };
      } else {
        if (!values.host || !values.database_name) {
          message.warning('Harap isi Host dan Nama Database terlebih dahulu.');
          return;
        }
        testPayload = {
          type: values.type,
          host: values.host?.trim(),
          port: values.port ? parseInt(values.port) : (values.type === 'mysql' ? 3306 : 5432),
          database: values.database_name?.trim(),
          user: values.username?.trim(),
          password: values.password || '',
          ssl: !!values.ssl,
        };
      }

      setTestingConn(true);
      const res = await axios.post('/api/connect/test', testPayload);
      if (res.data.success) {
        setTestResult({
          success: true,
          message: res.data.message || `Terhubung ke ${res.data.engine}! Ditemukan ${res.data.tableCount} tabel.`,
        });
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Koneksi gagal.';
      setTestResult({
        success: false,
        message: errMsg,
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleSaveSlot = async () => {
    try {
      const values = await slotForm.validateFields();
      setSaving(true);

      const payload = {
        name: values.name.trim(),
        type: values.type,
        ssl: values.ssl ? 1 : 0,
      };

      if (configMode === 'uri') {
        const rawUri = values.connection_string?.trim() || null;
        payload.connection_string = rawUri;
        const parsed = rawUri ? parseDatabaseUri(rawUri) : null;
        if (parsed) {
          payload.type = parsed.type || values.type;
          payload.host = parsed.host;
          payload.port = parsed.port;
          payload.database_name = parsed.database;
          payload.username = parsed.user;
          payload.password = parsed.password;
          payload.ssl = parsed.ssl ? 1 : (values.ssl ? 1 : 0);
        }
      } else {
        payload.host = values.host?.trim();
        payload.port = values.port ? parseInt(values.port) : null;
        payload.database_name = values.database_name?.trim();
        payload.username = values.username?.trim();
        payload.password = values.password || '';
        payload.connection_string = null;
      }

      if (editingSlot) {
        const res = await axios.put(`/api/user/connections/${editingSlot.id}`, payload);
        if (res.data.success) {
          message.success('Slot database berhasil diperbarui!');
          setModalVisible(false);
          if (onRefreshSlots) onRefreshSlots();
        }
      } else {
        const res = await axios.post('/api/user/connections', payload);
        if (res.data.success) {
          message.success('Slot database baru berhasil ditambahkan!');
          setModalVisible(false);
          if (onRefreshSlots) onRefreshSlots();
        }
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menyimpan slot database');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    try {
      const res = await axios.delete(`/api/user/connections/${slotId}`);
      if (res.data.success) {
        message.success('Slot database berhasil dihapus.');
        if (onRefreshSlots) onRefreshSlots();
      }
    } catch (err) {
      message.error('Gagal menghapus slot database.');
    }
  };

  const handleConnectSlot = async (slot) => {
    setConnectingSlotId(slot.id);
    try {
      await onSelectSlot(slot);
    } finally {
      setConnectingSlotId(null);
    }
  };

  const filteredSlots = slots.filter((s) => {
    const matchesType = filterType === 'all' || (s.type || 'postgres').toLowerCase() === filterType.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.database_name && s.database_name.toLowerCase().includes(q)) ||
      (s.host && s.host.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const getDbBadge = (type) => {
    const item = DB_TYPES.find((t) => t.value === (type || 'postgres').toLowerCase()) || DB_TYPES[0];
    return (
      <Tag color={item.color} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
        <span style={{ marginRight: 4 }}>{item.icon}</span> {item.label}
      </Tag>
    );
  };

  return (
    <div className="slots-hub-container">
      {/* Top Navigation Bar */}
      <div className="slots-hub-nav">
        <div className="slots-hub-brand">
          <img src="/logo.png" alt="ai-jogja" className="slots-hub-logo" />
          <div>
            <span className="slots-hub-title">App Database</span>
            <span className="slots-hub-subtitle">ai-jogja Workspace</span>
          </div>
        </div>

        <div className="slots-hub-user-panel">
          <div className="slots-user-chip">
            <span className="slots-user-avatar">
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </span>
            <div className="slots-user-meta">
              <span className="slots-user-name">{user?.name || 'Pengguna'}</span>
              <span className="slots-user-email">{user?.email}</span>
            </div>
          </div>
          <Button
            danger
            size="small"
            type="default"
            onClick={onLogout}
            style={{ borderRadius: 8, fontSize: 12 }}
          >
            Keluar
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="slots-hub-body">
        {/* Banner Section */}
        <div className="slots-hub-banner">
          <div className="banner-content">
            <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
              Slot Database Anda
            </Title>
            <Paragraph style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
              Pilih slot database yang ingin Anda kelola, atau konfigurasikan slot baru untuk PostgreSQL, MySQL, MariaDB, SQLite, dan SQL Server.
            </Paragraph>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => openCreateModal()}
            style={{
              height: 44,
              borderRadius: 8,
              fontWeight: 600,
              background: '#4f46e5',
              borderColor: '#4f46e5',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            }}
          >
            + Tambah Slot Database
          </Button>
        </div>

        {/* Toolbar: Search, Filter Type, Refresh */}
        <div className="slots-hub-toolbar">
          <Input
            placeholder="Cari slot database (nama, host, database)..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 360, borderRadius: 8 }}
            allowClear
          />

          <Segmented
            value={filterType}
            onChange={setFilterType}
            options={[
              { label: 'Semua', value: 'all' },
              { label: '🐘 PostgreSQL', value: 'postgres' },
              { label: '🐬 MySQL/MariaDB', value: 'mysql' },
              { label: '⚡ SQLite', value: 'sqlite' },
              { label: '🏢 MSSQL', value: 'mssql' },
            ]}
            style={{ background: '#f1f5f9', padding: 3, borderRadius: 8 }}
          />

          <Button
            icon={<ReloadOutlined />}
            onClick={onRefreshSlots}
            style={{ marginLeft: 'auto', borderRadius: 8 }}
            title="Muat ulang daftar slot"
          >
            Refresh
          </Button>
        </div>

        {/* Slots Grid */}
        <div className="slots-grid">
          {/* Add Slot Card Prompt */}
          <div className="slot-card add-slot-card" onClick={() => openCreateModal()}>
            <div className="add-slot-icon">
              <PlusOutlined style={{ fontSize: 24, color: '#4f46e5' }} />
            </div>
            <span className="add-slot-text">Tambah Slot Database Baru</span>
            <span className="add-slot-subtext">PostgreSQL • MySQL • MariaDB • SQLite • MSSQL</span>
          </div>

          {filteredSlots.map((slot) => {
            const isLocal = slot.host === 'localhost' || slot.host === '127.0.0.1';
            const isConnecting = connectingSlotId === slot.id;

            return (
              <div key={slot.id} className="slot-card">
                <div className="slot-card-header">
                  <div className="slot-card-badge-group">
                    {getDbBadge(slot.type)}
                    {isLocal && (
                      <Tag color="orange" style={{ fontSize: 10, borderRadius: 6 }}>
                        <DesktopOutlined /> Localhost
                      </Tag>
                    )}
                  </div>
                  <div className="slot-card-actions">
                    <Tooltip title="Edit konfigurasi slot">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined style={{ color: '#64748b' }} />}
                        onClick={() => openEditModal(slot)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Hapus slot database ini?"
                      description="Slot koneksi akan dihapus dari akun Anda."
                      okText="Hapus"
                      cancelText="Batal"
                      okType="danger"
                      onConfirm={() => handleDeleteSlot(slot.id)}
                    >
                      <Tooltip title="Hapus slot">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>

                <div className="slot-card-body">
                  <h4 className="slot-card-title">{slot.name}</h4>
                  <div className="slot-card-detail">
                    <span className="slot-label">Database:</span>
                    <span className="slot-value code-font">{slot.database_name || '—'}</span>
                  </div>
                  <div className="slot-card-detail">
                    <span className="slot-label">Host:</span>
                    <span className="slot-value code-font">{slot.host || '—'}:{slot.port || '5432'}</span>
                  </div>
                  <div className="slot-card-detail">
                    <span className="slot-label">User:</span>
                    <span className="slot-value">{slot.username || '—'}</span>
                  </div>
                </div>

                <div className="slot-card-footer">
                  <Button
                    type="primary"
                    block
                    icon={<ThunderboltOutlined />}
                    loading={isConnecting}
                    onClick={() => handleConnectSlot(slot)}
                    style={{
                      height: 38,
                      borderRadius: 8,
                      fontWeight: 600,
                      background: '#4f46e5',
                      borderColor: '#4f46e5',
                    }}
                  >
                    {isConnecting ? 'Menghubungkan...' : 'Akses Database'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State when no slots configured */}
        {filteredSlots.length === 0 && (
          <div className="slots-empty-box">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  {searchQuery ? `Tidak ada slot yang cocok dengan "${searchQuery}"` : 'Belum ada slot database yang dikonfigurasi.'}
                </span>
              }
            >
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                  Mulai dengan menambahkan slot koneksi baru atau gunakan salah satu preset:
                </Text>
                <Space wrap>
                  <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={() => openCreateModal()}
                  >
                    Buat Slot Baru
                  </Button>
                  <Button
                    onClick={() => openCreateModal({
                      name: 'Demo SQLite (Lokal)',
                      type: 'sqlite',
                      host: 'localhost',
                      port: 3001,
                      database_name: 'demo',
                      username: 'demo',
                    })}
                  >
                    ⚡ Preset SQLite Lokal
                  </Button>
                  <Button
                    onClick={() => openCreateModal({
                      name: 'SumoPod PostgreSQL Cloud',
                      type: 'postgres',
                      connection_string: 'postgresql://uazuSleyutH953G5A.jkt1_003:b56aabd50b51c19d747f830f@pgsql-dbas-jkt1-003.sumobase.my.id:6432/db658b2889efac70aa',
                    })}
                  >
                    🐘 Preset SumoPod PG
                  </Button>
                </Space>
              </div>
            </Empty>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: TAMBAH / EDIT SLOT DATABASE */}
      {/* ========================================================= */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DatabaseOutlined style={{ color: '#4f46e5', fontSize: 18 }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>
              {editingSlot ? 'Edit Konfigurasi Slot Database' : 'Tambah Slot Database Baru'}
            </span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={640}
        centered
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            Batal
          </Button>,
          <Button
            key="test"
            icon={<ThunderboltOutlined />}
            loading={testingConn}
            onClick={handleTestConnection}
            style={{
              borderColor: '#6366f1',
              color: '#4f46e5',
              fontWeight: 500,
              background: '#f5f3ff',
            }}
          >
            ⚡ Tes Koneksi
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={saving}
            onClick={handleSaveSlot}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              borderColor: '#7c3aed',
              fontWeight: 600,
            }}
          >
            {editingSlot ? 'Simpan Perubahan' : 'Simpan & Tambahkan Slot'}
          </Button>,
        ]}
      >
        <Form form={slotForm} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          {/* Diagnostic Test Result Banner */}
          {testResult && (
            <Alert
              style={{ marginBottom: 16, borderRadius: 10 }}
              message={
                testResult.success
                  ? 'Koneksi Berhasil Terhubung!'
                  : (testResult.message.includes('EMAXCONNSESSION') || testResult.message.includes('15')
                      ? 'Batas Pool Supabase Session Mode Penuh (15 Klien)'
                      : 'Gagal Terhubung ke Database')
              }
              description={
                <div>
                  <div style={{ marginBottom: (testResult.message.includes('EMAXCONNSESSION') || testResult.message.includes('15')) ? 10 : 0 }}>
                    {testResult.message}
                  </div>
                  {!testResult.success && (testResult.message.includes('EMAXCONNSESSION') || testResult.message.includes('15')) && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleSwitchToPort6543}
                      style={{
                        background: '#059669',
                        borderColor: '#059669',
                        fontWeight: 600,
                        marginTop: 4,
                      }}
                    >
                      ⚡ Beralih Otomatis ke Port 6543 (Transaction Mode) & Uji Ulang
                    </Button>
                  )}
                </div>
              }
              type={testResult.success ? 'success' : (testResult.message.includes('EMAXCONNSESSION') ? 'warning' : 'error')}
              showIcon
              closable
              onClose={() => setTestResult(null)}
            />
          )}

          {/* Label Slot */}
          <Form.Item
            label={<Text strong>Nama Slot Database</Text>}
            name="name"
            rules={[{ required: true, message: 'Nama slot wajib diisi' }]}
          >
            <Input placeholder="Contoh: Database Produksi, DB Kasir Toko, Inventory PostgreSQL..." />
          </Form.Item>

          {/* Database Type Selector */}
          <Form.Item
            label={<Text strong>Jenis Database (Engine)</Text>}
            name="type"
            rules={[{ required: true, message: 'Pilih jenis database' }]}
          >
            <Select
              value={selectedType}
              onChange={(val) => {
                setSelectedType(val);
                const item = DB_TYPES.find((t) => t.value === val);
                if (item && configMode === 'manual') {
                  slotForm.setFieldsValue({ port: item.defaultPort });
                }
              }}
            >
              {DB_TYPES.map((t) => (
                <Option key={t.value} value={t.value}>
                  <span style={{ marginRight: 6 }}>{t.icon}</span> {t.label} (Default port: {t.defaultPort})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Mode Switcher: URI vs Manual Parameters */}
          <div style={{ marginBottom: 16 }}>
            <Segmented
              block
              value={configMode}
              onChange={setConfigMode}
              options={[
                { label: <span><LinkOutlined /> Connection String / URI</span>, value: 'uri' },
                { label: <span><SettingOutlined /> Parameter Manual</span>, value: 'manual' },
              ]}
            />
          </div>

          {configMode === 'uri' ? (
            <div>
              <Form.Item
                label={<Text strong>Connection URI / URL</Text>}
                name="connection_string"
                rules={[{ required: true, message: 'Connection string wajib diisi' }]}
                extra={
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                    <div>Format umum: <code>postgresql://user:password@host:port/dbname</code> atau <code>mysql://user:password@host:3306/dbname</code></div>
                    <div style={{ color: '#059669', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>⚡</span> <b>Pengguna Supabase:</b> Gunakan port <b>6543</b> (Transaction Pooler) untuk menghindari batas 15 koneksi pada port 5432.
                    </div>
                    <div style={{ color: '#8b5cf6', marginTop: 2 }}>
                      💡 Tip: Jika password mengandung karakter khusus (misal <code>#</code>, <code>@</code>, atau <code>:</code>), sistem otomatis mengurainya secara aman.
                    </div>
                  </div>
                }
              >
                <TextArea
                  rows={3}
                  placeholder={
                    selectedType === 'mysql'
                      ? 'mysql://root:password@localhost:3306/my_database'
                      : 'postgresql://postgres:password@localhost:5432/my_database'
                  }
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                />
              </Form.Item>
            </div>
          ) : (
            <div>
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item
                    label={<Text strong>Host / Server</Text>}
                    name="host"
                    rules={[{ required: true, message: 'Host wajib diisi' }]}
                    extra={<span style={{ fontSize: 11, color: '#64748b' }}>Bisa localhost, IP publik, domain, atau tunnel</span>}
                  >
                    <Input placeholder="localhost atau db.contoh.com" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label={<Text strong>Port</Text>}
                    name="port"
                    rules={[{ required: true, message: 'Port wajib diisi' }]}
                  >
                    <Input placeholder="5432 / 3306" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={<Text strong>Nama Database</Text>}
                name="database_name"
                rules={[{ required: true, message: 'Nama database wajib diisi' }]}
              >
                <Input placeholder="contoh: db_penjualan, postgres, appdb" />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    label={<Text strong>Username</Text>}
                    name="username"
                    rules={[{ required: true, message: 'Username database wajib diisi' }]}
                  >
                    <Input placeholder="postgres / root" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label={<Text strong>Password</Text>}
                    name="password"
                  >
                    <Input.Password placeholder="•••••••• (kosongkan jika tanpa password)" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="ssl" valuePropName="checked" style={{ marginBottom: 8 }}>
                <Switch size="small" /> <span style={{ marginLeft: 8, fontSize: 13, color: '#475569' }}>Gunakan Koneksi Terenkripsi SSL/TLS</span>
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}

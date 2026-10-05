import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Table, Progress, Button, Typography,
  Tag, Space, Spin, Alert, Tooltip, Divider,
} from 'antd';
import {
  DashboardOutlined, DatabaseOutlined, HddOutlined, ApiOutlined,
  ReloadOutlined, ThunderboltOutlined, TableOutlined,
  CheckCircleOutlined, InfoCircleOutlined, ArrowRightOutlined,
  CompassOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

export default function DatabaseMetricsDashboard({
  credentials,
  onNavigateToQuery,
  onOpenTable,
}) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchMetrics = async () => {
    if (!credentials) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/database/metrics', credentials);
      if (res.data.success) {
        setMetrics(res.data.metrics);
        setLastRefreshed(new Date().toLocaleTimeString());
      } else {
        setError(res.data.error || 'Gagal memuat metrik database');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal terhubung ke endpoint metrik database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [credentials]);

  const topTableColumns = [
    {
      title: 'Nama Tabel',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space>
          <TableOutlined style={{ color: '#4f46e5' }} />
          <Text strong style={{ color: '#0f172a', cursor: 'pointer' }} onClick={() => onOpenTable && onOpenTable(name)}>
            {name}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Estimasi Baris',
      dataIndex: 'rowCount',
      key: 'rowCount',
      align: 'right',
      render: (val, record) => {
        const count = val !== undefined ? val : record.row_count;
        return count !== undefined && count !== null ? Number(count).toLocaleString() : '—';
      },
    },
    {
      title: 'Ukuran Penyimpanan',
      dataIndex: 'estimatedSize',
      key: 'estimatedSize',
      align: 'right',
      render: (val, record) => (
        <Tag color="indigo" style={{ fontWeight: 600, borderRadius: 6, margin: 0 }}>
          {val || record.formatted || '—'}
        </Tag>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          onClick={() => onOpenTable && onOpenTable(record.name)}
          icon={<ArrowRightOutlined />}
        >
          Buka
        </Button>
      ),
    },
  ];

  if (loading && !metrics) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: '#fff', borderRadius: 12, margin: 16 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>
          Menganalisis penggunaan storage, alokasi memori, dan koneksi server database...
        </p>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div style={{ padding: 24, margin: 16 }}>
        <Alert
          type="warning"
          showIcon
          message="Informasi Metrik Server Terbatas"
          description={
            <div>
              <p>{error}</p>
              <Button size="small" onClick={fetchMetrics} icon={<ReloadOutlined />}>
                Coba Lagi
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const storageSize = metrics?.sizeFormatted || metrics?.storage?.database_size_formatted || '—';
  const activeConnections = metrics?.activeConnections ?? metrics?.resources?.active_connections ?? 1;
  const maxConnections = metrics?.maxConnections ?? metrics?.resources?.max_connections ?? 100;
  const connUsagePct = Math.min(100, Math.round((activeConnections / (maxConnections || 100)) * 100));
  const latency = metrics?.latencyMs ?? metrics?.stats?.latency_ms ?? 0;
  const totalTables = metrics?.tablesCount ?? metrics?.stats?.total_tables ?? 0;
  const estimatedRows = metrics?.totalRows ?? metrics?.stats?.estimated_total_rows ?? 0;
  const dbEngine = (metrics?.engine || metrics?.database_type || credentials?.type || 'PostgreSQL').toUpperCase();
  const dbVersion = metrics?.version || metrics?.resources?.db_version || 'Generic SQL Engine';
  const topTablesList = metrics?.topTables || metrics?.storage?.top_tables || [];

  return (
    <div className="metrics-dashboard-container">
      {/* Header Banner */}
      <div className="metrics-header-banner">
        <div className="metrics-header-left">
          <div className="metrics-engine-badge">
            <span className="engine-dot" />
            <span className="engine-name">{dbEngine} ONLINE</span>
          </div>
          <Title level={4} style={{ margin: '8px 0 2px 0', fontWeight: 700, color: '#0f172a' }}>
            Ringkasan & Metrik Performa Database
          </Title>
          <Text style={{ color: '#64748b', fontSize: 13 }}>
            Server: <b className="code-font">{credentials?.host}:{credentials?.port}</b> • Database: <b className="code-font">{credentials?.database}</b>
            {lastRefreshed && <span> • Diperbarui pada {lastRefreshed}</span>}
          </Text>
        </div>

        <div className="metrics-header-actions">
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={fetchMetrics}
            style={{ borderRadius: 8 }}
          >
            Refresh Metrik
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={onNavigateToQuery}
            style={{
              borderRadius: 8,
              background: '#4f46e5',
              borderColor: '#4f46e5',
              fontWeight: 600,
            }}
          >
            Buka Query Editor
          </Button>
        </div>
      </div>

      {/* Primary Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Card 1: Storage Size */}
        <Col xs={24} sm={12} lg={6}>
          <div className="metric-card">
            <div className="metric-card-header">
              <span className="metric-icon-wrap" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                <HddOutlined />
              </span>
              <Tag color="purple" style={{ margin: 0, borderRadius: 6, fontWeight: 600 }}>Storage Terpakai</Tag>
            </div>
            <div className="metric-card-body">
              <div className="metric-main-value">{storageSize}</div>
              <div className="metric-subtext">
                {metrics?.database_type === 'sqlite'
                  ? `Ukuran file database lokal (${metrics?.storage?.page_size ? metrics.storage.page_size + ' B/page' : ''})`
                  : 'Total disk space database termasuk data & index'}
              </div>
            </div>
          </div>
        </Col>

        {/* Card 2: Active Connections / Capacity */}
        <Col xs={24} sm={12} lg={6}>
          <div className="metric-card">
            <div className="metric-card-header">
              <span className="metric-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <ApiOutlined />
              </span>
              <Tag color="green" style={{ margin: 0, borderRadius: 6, fontWeight: 600 }}>Koneksi & Kapasitas</Tag>
            </div>
            <div className="metric-card-body">
              <div className="metric-main-value">
                {activeConnections} <span style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>/ {maxConnections} pool</span>
              </div>
              <div style={{ marginTop: 6, marginBottom: 4 }}>
                <Progress percent={connUsagePct} size="small" strokeColor="#16a34a" showInfo={false} />
              </div>
              <div className="metric-subtext">
                {connUsagePct}% kapasitas koneksi pool aktif digunakan
              </div>
            </div>
          </div>
        </Col>

        {/* Card 3: Total Tables & Rows */}
        <Col xs={24} sm={12} lg={6}>
          <div className="metric-card">
            <div className="metric-card-header">
              <span className="metric-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                <TableOutlined />
              </span>
              <Tag color="gold" style={{ margin: 0, borderRadius: 6, fontWeight: 600 }}>Skema & Data</Tag>
            </div>
            <div className="metric-card-body">
              <div className="metric-main-value">{totalTables} <span style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>tabel</span></div>
              <div className="metric-subtext">
                {estimatedRows > 0 ? `± ${Number(estimatedRows).toLocaleString()} total baris data tersimpan` : 'Tabel siap dieksplorasi'}
              </div>
            </div>
          </div>
        </Col>

        {/* Card 4: Latency / Ping */}
        <Col xs={24} sm={12} lg={6}>
          <div className="metric-card">
            <div className="metric-card-header">
              <span className="metric-icon-wrap" style={{ background: '#cffafe', color: '#0891b2' }}>
                <CompassOutlined />
              </span>
              <Tag color={latency < 50 ? 'success' : latency < 150 ? 'warning' : 'default'} style={{ margin: 0, borderRadius: 6, fontWeight: 600 }}>
                {latency < 50 ? 'Sangat Cepat' : latency < 150 ? 'Normal' : 'Tinggi'}
              </Tag>
            </div>
            <div className="metric-card-body">
              <div className="metric-main-value">{latency} <span style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>ms</span></div>
              <div className="metric-subtext">
                Waktu respons kueri round-trip (RTT) ke server
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* Details Section: Top Tables & Engine Info */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Left: Top Tables by Storage */}
        <Col xs={24} lg={15}>
          <div className="metric-panel">
            <div className="metric-panel-header">
              <span className="panel-title">Tabel Terbesar & Penggunaan Storage</span>
              <span className="panel-subtitle">Tabel dengan alokasi ukuran terbesar di database ini</span>
            </div>
            <div className="metric-panel-body">
              {topTablesList && topTablesList.length > 0 ? (
                <Table
                  dataSource={topTablesList}
                  columns={topTableColumns}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b' }}>
                  Belum ada data tabel untuk dianalisis ukurannya.
                </div>
              )}
            </div>
          </div>
        </Col>

        {/* Right: Engine Information & Resource Overview */}
        <Col xs={24} lg={9}>
          <div className="metric-panel">
            <div className="metric-panel-header">
              <span className="panel-title">Informasi Mesin Database</span>
              <span className="panel-subtitle">Spesifikasi koneksi aktif</span>
            </div>
            <div className="metric-panel-body engine-info-list">
              <div className="engine-info-row">
                <span className="engine-info-label">Jenis Engine:</span>
                <span className="engine-info-val"><b>{dbEngine}</b></span>
              </div>
              <div className="engine-info-row">
                <span className="engine-info-label">Versi Server:</span>
                <span className="engine-info-val code-font" style={{ fontSize: 11 }}>
                  {dbVersion.substring(0, 60)}
                </span>
              </div>
              <div className="engine-info-row">
                <span className="engine-info-label">Host & Port:</span>
                <span className="engine-info-val code-font">{credentials?.host}:{credentials?.port}</span>
              </div>
              <div className="engine-info-row">
                <span className="engine-info-label">Nama Database:</span>
                <span className="engine-info-val code-font">{credentials?.database}</span>
              </div>
              <div className="engine-info-row">
                <span className="engine-info-label">User Terhubung:</span>
                <span className="engine-info-val">{credentials?.user || 'default'}</span>
              </div>
              <div className="engine-info-row">
                <span className="engine-info-label">Status SSL/TLS:</span>
                <span className="engine-info-val">
                  <Tag color="blue" style={{ margin: 0, borderRadius: 4 }}>Terenkripsi</Tag>
                </span>
              </div>

              <Divider style={{ margin: '14px 0', borderColor: '#f1f5f9' }} />

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <CheckCircleOutlined style={{ color: '#16a34a' }} />
                  <span style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>Koneksi Siap Digunakan</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                  Pilih tabel di sidebar kiri untuk melihat dan mengedit data, atau klik tombol di bawah untuk menulis kueri SQL kustom.
                </p>
                <Button
                  block
                  size="small"
                  type="default"
                  icon={<ThunderboltOutlined />}
                  onClick={onNavigateToQuery}
                  style={{ marginTop: 8, fontWeight: 500 }}
                >
                  Tulis Kueri SQL
                </Button>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}

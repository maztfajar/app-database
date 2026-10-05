import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Modal, Typography, Table, Tag, Descriptions, Card, Space, Divider, Alert, Spin } from 'antd';
import {
  SafetyCertificateOutlined, LockOutlined, CloudServerOutlined,
  CheckCircleOutlined, HistoryOutlined, KeyOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function SecurityModal({ visible, onClose, user }) {
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchLogs();
    }
  }, [visible]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const token = localStorage.getItem('appdb_jwt_token');
      const res = await axios.get('/api/auth/security/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch security logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const columns = [
    {
      title: 'Aktivitas Keamanan',
      dataIndex: 'action',
      key: 'action',
      render: (action) => {
        let color = 'default';
        if (action.includes('SUCCESS') || action === 'REGISTER') color = 'green';
        if (action.includes('FAILED') || action.includes('LOCKED')) color = 'red';
        if (action.includes('GOOGLE')) color = 'blue';
        return <Tag color={color} style={{ fontWeight: 600 }}>{action}</Tag>;
      },
    },
    {
      title: 'Keterangan',
      dataIndex: 'details',
      key: 'details',
      render: (text) => <Text style={{ fontSize: 12, color: '#c4c8d8' }}>{text || '-'}</Text>,
    },
    {
      title: 'Alamat IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (ip) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{ip || 'Localhost'}</Tag>,
    },
    {
      title: 'Waktu',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (t) => <Text style={{ fontSize: 11, color: '#8b8fa3' }}>{new Date(t).toLocaleString('id-ID')}</Text>,
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#6C5CE7', fontSize: 20 }} />
          <span>Status Keamanan Siber &amp; Audit Trail Akun</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={720}
      centered
    >
      <div style={{ marginTop: 15 }}>
        {/* Security Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Card size="small" style={{ background: '#13151a', borderColor: '#2d3139' }}>
            <Space align="start">
              <LockOutlined style={{ color: '#52c41a', fontSize: 22, marginTop: 2 }} />
              <div>
                <Text style={{ color: '#8b8fa3', fontSize: 11, display: 'block' }}>KREDENSIAL DB</Text>
                <Text strong style={{ color: '#fff', fontSize: 13 }}>AES-256-GCM</Text>
                <div style={{ fontSize: 11, color: '#52c41a' }}>Terenkripsi Standar Militer</div>
              </div>
            </Space>
          </Card>

          <Card size="small" style={{ background: '#13151a', borderColor: '#2d3139' }}>
            <Space align="start">
              <KeyOutlined style={{ color: '#a29bfe', fontSize: 22, marginTop: 2 }} />
              <div>
                <Text style={{ color: '#8b8fa3', fontSize: 11, display: 'block' }}>KATA SANDI AKUN</Text>
                <Text strong style={{ color: '#fff', fontSize: 13 }}>Bcrypt 12 Rounds</Text>
                <div style={{ fontSize: 11, color: '#a29bfe' }}>Tahan Rainbow Tables</div>
              </div>
            </Space>
          </Card>

          <Card size="small" style={{ background: '#13151a', borderColor: '#2d3139' }}>
            <Space align="start">
              <CloudServerOutlined style={{ color: '#1890ff', fontSize: 22, marginTop: 2 }} />
              <div>
                <Text style={{ color: '#8b8fa3', fontSize: 11, display: 'block' }}>ISOLASI DATA</Text>
                <Text strong style={{ color: '#fff', fontSize: 13 }}>Multi-Tenant</Text>
                <div style={{ fontSize: 11, color: '#1890ff' }}>Per-User Isolated Storage</div>
              </div>
            </Space>
          </Card>
        </div>

        {/* Account Details */}
        <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Nama Akun">{user?.name}</Descriptions.Item>
          <Descriptions.Item label="Email Terdaftar">{user?.email}</Descriptions.Item>
          <Descriptions.Item label="Metode Autentikasi">
            <Tag color={user?.auth_provider === 'google' ? 'blue' : 'purple'}>
              {user?.auth_provider === 'google' ? 'Google Account' : 'Email & Password (OTP)'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status Akun">
            <Tag color="success" icon={<CheckCircleOutlined />}>Terverifikasi &amp; Aman</Tag>
          </Descriptions.Item>
        </Descriptions>

        {/* Audit Logs Table */}
        <Divider orientation="left" style={{ borderColor: '#2d3139', color: '#a0a4b8', fontSize: 13, margin: '14px 0' }}>
          <Space>
            <HistoryOutlined />
            <span>Riwayat Aktivitas &amp; Log Keamanan Siber Terkini</span>
          </Space>
        </Divider>

        {loadingLogs ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin tip="Memuat log keamanan..." />
          </div>
        ) : (
          <Table
            dataSource={logs}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
            style={{ borderRadius: 6, overflow: 'hidden' }}
          />
        )}
      </div>
    </Modal>
  );
}

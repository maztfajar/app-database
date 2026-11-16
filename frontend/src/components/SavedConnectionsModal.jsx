import React, { useState } from 'react';
import { Modal, Table, Button, Space, Tag, Popconfirm, Typography, Empty, Input } from 'antd';
import {
  DatabaseOutlined, ThunderboltOutlined, DeleteOutlined, PlusOutlined, SearchOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export default function SavedConnectionsModal({
  visible,
  onClose,
  connections = [],
  loading = false,
  onSelectConnection,
  onDeleteConnection,
  onAddNew,
}) {
  const [searchKw, setSearchKw] = useState('');

  const filteredConnections = connections.filter((c) => {
    const q = searchKw.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.database_name && c.database_name.toLowerCase().includes(q)) ||
      (c.host && c.host.toLowerCase().includes(q)) ||
      (c.type && c.type.toLowerCase().includes(q))
    );
  });
  const columns = [
    {
      title: 'Nama Slot',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong style={{ color: '#0f172a' }}>{text}</Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {record.database_name ? `DB: ${record.database_name}` : 'Demo / Default'}
          </div>
        </div>
      ),
    },
    {
      title: 'Tipe Engine',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        let color = 'blue';
        if (type === 'mysql') color = 'cyan';
        if (type === 'sqlite') color = 'purple';
        if (type === 'mssql') color = 'geekblue';
        return <Tag color={color} style={{ textTransform: 'uppercase', fontWeight: 600 }}>{type}</Tag>;
      },
    },
    {
      title: 'Host & Port',
      key: 'host',
      render: (_, record) => (
        <Text style={{ fontSize: 12, color: '#334155', fontFamily: 'monospace' }}>
          {record.host ? `${record.host}:${record.port || 5432}` : 'Localhost'}
        </Text>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="primary"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => {
              onSelectConnection(record);
              onClose();
            }}
            style={{
              background: '#4f46e5',
              borderColor: '#4f46e5',
              fontSize: 12,
            }}
          >
            Akses Database
          </Button>

          <Popconfirm
            title="Hapus slot database ini?"
            description="Slot ini akan dihapus dari akun Anda."
            onConfirm={() => onDeleteConnection(record.id)}
            okText="Hapus"
            cancelText="Batal"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Hapus koneksi"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <DatabaseOutlined style={{ color: '#4f46e5' }} />
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Slot Database Akun Anda</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Tutup
        </Button>,
        <Button
          key="add"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            onClose();
            if (onAddNew) onAddNew();
          }}
          style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
        >
          Tambah Slot Baru
        </Button>,
      ]}
      width={780}
      centered
    >
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <Input
            placeholder="Cari slot database (nama, host, tipe, db)..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={searchKw}
            onChange={(e) => setSearchKw(e.target.value)}
            allowClear
            style={{ borderRadius: 6 }}
          />
        </div>
        <Table
          dataSource={filteredConnections}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          pagination={{ pageSize: 5 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#64748b' }}>
                    {searchKw ? `Tidak ada slot yang cocok dengan "${searchKw}"` : 'Belum ada slot database tersimpan di akun Anda.'}
                  </span>
                }
              />
            ),
          }}
        />
      </div>
    </Modal>
  );
}

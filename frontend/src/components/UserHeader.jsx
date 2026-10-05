import React from 'react';
import { Avatar, Typography, Space, Button, Popconfirm, Tooltip } from 'antd';
import {
  LogoutOutlined, DatabaseOutlined, GoogleOutlined,
  SwapOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export default function UserHeader({
  user,
  onLogout,
  savedConnectionsCount = 0,
  onOpenSlotsHub,
}) {
  if (!user) return null;

  // Generate initials for avatar
  const initials = (user.name || user.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="user-header-pill">
      <Space size={10}>
        {/* Avatar */}
        {user.avatar_url ? (
          <Avatar src={user.avatar_url} size={30} />
        ) : (
          <Avatar
            size={30}
            style={{
              background: '#4f46e5',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
        )}

        {/* User Info */}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
              {user.name}
            </Text>
            {user.auth_provider === 'google' && (
              <Tooltip title="Masuk dengan Akun Google">
                <GoogleOutlined style={{ color: '#ea4335', fontSize: 12 }} />
              </Tooltip>
            )}
          </div>
          <Text style={{ color: '#64748b', fontSize: 11 }}>{user.email}</Text>
        </div>

        {/* Change Database Slot Button */}
        {onOpenSlotsHub && (
          <Tooltip title="Ganti ke slot database lain di akun Anda">
            <Button
              size="small"
              type="default"
              icon={<SwapOutlined style={{ color: '#4f46e5' }} />}
              onClick={onOpenSlotsHub}
              style={{
                borderRadius: 6,
                fontSize: 12,
                borderColor: '#e2e8f0',
                color: '#334155',
                fontWeight: 500,
              }}
            >
              Ganti Database
            </Button>
          </Tooltip>
        )}

        {/* Logout Button */}
        <Popconfirm
          title="Keluar dari Akun?"
          description="Anda perlu masuk kembali untuk mengakses database tersimpan Anda."
          okText="Ya, Keluar"
          cancelText="Batal"
          onConfirm={onLogout}
          okButtonProps={{ danger: true }}
        >
          <Button
            size="small"
            type="text"
            danger
            icon={<LogoutOutlined />}
            title="Keluar dari akun"
            style={{ borderRadius: 6 }}
          />
        </Popconfirm>
      </Space>
    </div>
  );
}

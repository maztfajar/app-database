import React, { useState } from 'react';
import {
  Modal, Input, Button, Typography, Tag, Table, Space, Empty, Spin, Alert, Collapse, Tooltip,
} from 'antd';
import {
  SearchOutlined, TableOutlined, ArrowRightOutlined, DatabaseOutlined, ReloadOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

export default function GlobalDatabaseSearchModal({
  visible,
  onClose,
  credentials,
  onSelectTable,
}) {
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    if (!credentials) return;

    setSearching(true);
    setErrorMsg(null);
    try {
      const res = await axios.post('/api/database/search', {
        ...credentials,
        keyword: keyword.trim(),
        maxRowsPerTable: 25,
      });
      if (res.data.success) {
        setResultData(res.data);
      } else {
        setErrorMsg(res.data.error || 'Pencarian gagal.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Gagal melakukan pencarian database.');
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    setKeyword('');
    setResultData(null);
    setErrorMsg(null);
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
      destroyOnClose
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: '#eef2ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <SearchOutlined />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Pencarian Database Menggunakan Kata Kunci
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
              Mencari data di semua kolom pada setiap tabel dalam database {credentials?.database ? `"${credentials.database}"` : ''}
            </div>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 16 }}>
        {/* Search Input Bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Input
            placeholder="Ketik kata kunci pencarian (misal: nama, email, status, id, kota)..."
            size="large"
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            style={{ borderRadius: 8 }}
            autoFocus
          />
          <Button
            type="primary"
            size="large"
            loading={searching}
            onClick={handleSearch}
            icon={<SearchOutlined />}
            style={{
              background: '#4f46e5',
              borderColor: '#4f46e5',
              borderRadius: 8,
              fontWeight: 600,
              padding: '0 24px',
            }}
          >
            Cari
          </Button>
        </div>

        {errorMsg && (
          <Alert
            type="error"
            message={errorMsg}
            showIcon
            closable
            onClose={() => setErrorMsg(null)}
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        {/* Results Section */}
        {searching && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>
              Memindai seluruh tabel database untuk kata kunci "{keyword}"...
            </div>
          </div>
        )}

        {!searching && resultData && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: '#f8fafc',
                borderRadius: 8,
                marginBottom: 16,
                border: '1px solid #e2e8f0',
              }}
            >
              <Space>
                <Text strong style={{ color: '#0f172a' }}>
                  Hasil Pencarian untuk:
                </Text>
                <Tag color="indigo" style={{ fontWeight: 600, fontSize: 13, borderRadius: 6 }}>
                  "{resultData.keyword}"
                </Tag>
                <Tag color={resultData.totalFound > 0 ? 'green' : 'orange'} style={{ borderRadius: 6, fontWeight: 600 }}>
                  {resultData.totalFound} baris ditemukan
                </Tag>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  (di {resultData.totalTablesWithMatches} tabel)
                </span>
              </Space>
              <Button size="small" type="text" onClick={handleClear} style={{ color: '#64748b' }}>
                Bersihkan
              </Button>
            </div>

            {resultData.totalFound === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#64748b' }}>
                    Tidak ada baris data yang cocok dengan kata kunci "{resultData.keyword}" di semua tabel.
                  </span>
                }
              />
            ) : (
              <Collapse
                defaultActiveKey={resultData.results.map((r) => r.tableName)}
                style={{ background: 'transparent', border: 'none' }}
              >
                {resultData.results.map((tableResult) => {
                  const sampleRow = tableResult.matchedRows[0] || {};
                  const colKeys = Object.keys(sampleRow);
                  const previewCols = colKeys.map((k) => {
                    const maxLen = Math.max(
                      k.length,
                      ...tableResult.matchedRows.slice(0, 30).map((r) =>
                        r[k] === null || r[k] === undefined ? 4 : Math.min(String(r[k]).length, 32)
                      )
                    );
                    const autoWidth = Math.max(70, Math.min(240, Math.ceil(maxLen * 7.6 + 26)));
                    return {
                      title: k,
                      dataIndex: k,
                      key: k,
                      width: autoWidth,
                      render: (val) => {
                        if (val === null || val === undefined) {
                          return <span className="cell-null">NULL</span>;
                        }
                        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
                        const lower = str.toLowerCase();
                        const kw = (resultData.keyword || '').toLowerCase();
                        if (kw && lower.includes(kw)) {
                          return (
                            <div className="cell-wrap-text" style={{ background: '#fef08a', padding: '1px 4px', borderRadius: 3, fontWeight: 600 }}>
                              {str}
                            </div>
                          );
                        }
                        return <div className="cell-wrap-text">{str}</div>;
                      },
                    };
                  });

                  return (
                    <Panel
                      key={tableResult.tableName}
                      header={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                          <Space>
                            <TableOutlined style={{ color: '#4f46e5' }} />
                            <Text strong style={{ color: '#0f172a', fontSize: 14 }}>
                              {tableResult.tableName}
                            </Text>
                            <Tag color="geekblue" style={{ borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                              {tableResult.matchCount} baris cocok
                            </Tag>
                          </Space>
                          <Button
                            type="link"
                            size="small"
                            icon={<ArrowRightOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectTable) {
                                onSelectTable(tableResult.tableName, resultData.keyword);
                              }
                              onClose();
                            }}
                            style={{ fontWeight: 600, color: '#4f46e5' }}
                          >
                            Buka Tabel Ini
                          </Button>
                        </div>
                      }
                      style={{
                        marginBottom: 12,
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                      }}
                    >
                      <Table
                        columns={previewCols}
                        dataSource={tableResult.matchedRows}
                        rowKey={(_, idx) => idx}
                        size="small"
                        bordered
                        pagination={tableResult.matchedRows.length > 5 ? { pageSize: 5, size: 'small' } : false}
                        scroll={{ x: 'max-content' }}
                      />
                    </Panel>
                  );
                })}
              </Collapse>
            )}
          </div>
        )}

        {!searching && !resultData && (
          <div style={{ padding: '30px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
            <DatabaseOutlined style={{ fontSize: 36, color: '#94a3b8', marginBottom: 12 }} />
            <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
              Cari Cepat di Seluruh Database
            </div>
            <div style={{ color: '#64748b', fontSize: 12, maxWidth: 500, margin: '8px auto 0' }}>
              Masukkan kata kunci apapun di atas untuk mencari data di semua tabel sekaligus. Anda dapat membuka tabel hasil pencarian dan melihat semua datanya dengan scroll penuh.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

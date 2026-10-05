import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#4f46e5',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBgLayout: '#f8fafc',
          colorBorder: '#e2e8f0',
          colorBorderSecondary: '#f1f5f9',
          colorText: '#0f172a',
          colorTextSecondary: '#475569',
          colorTextTertiary: '#94a3b8',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          borderRadius: 8,
          fontSize: 13,
          controlHeight: 38,
        },
        components: {
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#475569',
            rowHoverBg: '#f8fafc',
            borderColor: '#e2e8f0',
            cellPaddingBlock: 10,
            cellPaddingInline: 14,
            headerBorderRadius: 6,
          },
          Card: {
            colorBgContainer: '#ffffff',
            colorBorderSecondary: '#e2e8f0',
          },
          Menu: {
            itemHeight: 36,
            iconSize: 14,
          },
          Tabs: {
            cardBg: '#f8fafc',
            itemSelectedColor: '#4f46e5',
            itemHoverColor: '#312e81',
            inkBarColor: '#4f46e5',
          },
          Input: {
            activeBorderColor: '#4f46e5',
            hoverBorderColor: '#6366f1',
            colorBgContainer: '#ffffff',
          },
          Button: {
            primaryShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
          },
          Modal: {
            contentBg: '#ffffff',
            headerBg: '#ffffff',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);

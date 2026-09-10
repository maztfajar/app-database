import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#6C5CE7',
          colorBgContainer: '#1a1d23',
          colorBgElevated: '#22262e',
          colorBgLayout: '#13151a',
          colorBorder: '#2d3139',
          colorBorderSecondary: '#252830',
          colorText: '#e4e6eb',
          colorTextSecondary: '#8b8fa3',
          colorTextTertiary: '#5c6070',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          borderRadius: 8,
          fontSize: 13,
          controlHeight: 36,
        },
        components: {
          Table: {
            headerBg: '#1e2128',
            headerColor: '#a0a4b8',
            rowHoverBg: '#252830',
            borderColor: '#2d3139',
            cellPaddingBlock: 10,
            cellPaddingInline: 14,
            headerBorderRadius: 0,
          },
          Menu: {
            darkItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(108, 92, 231, 0.15)',
            darkItemHoverBg: 'rgba(108, 92, 231, 0.08)',
            darkItemSelectedColor: '#a29bfe',
            itemHeight: 36,
            iconSize: 14,
          },
          Tabs: {
            cardBg: '#1a1d23',
            itemSelectedColor: '#a29bfe',
            itemHoverColor: '#e4e6eb',
            inkBarColor: '#6C5CE7',
          },
          Input: {
            activeBorderColor: '#6C5CE7',
            hoverBorderColor: '#4a3fb5',
          },
          Button: {
            primaryShadow: '0 2px 8px rgba(108, 92, 231, 0.35)',
          },
          Modal: {
            contentBg: '#1e2128',
            headerBg: '#1e2128',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);

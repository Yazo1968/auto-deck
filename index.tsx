import './globals.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageProvider } from './components/StorageProvider';
import { ToastProvider } from './components/ToastNotification';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <StorageProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StorageProvider>
  </React.StrictMode>,
);

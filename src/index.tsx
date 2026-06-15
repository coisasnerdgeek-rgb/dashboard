import * as React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './services/queryClient';

// Limpeza de localStorage para evitar erro de cota (QuotaExceededError)
// O spreadsheetData agora é lido diretamente do Supabase.
try {
  const data = localStorage.getItem('spreadsheetData');
  if (data && data.length > 1000) {
    console.log('🧹 Limpando dados redundantes do localStorage para liberar espaço...');
    localStorage.removeItem('spreadsheetData');
  }
} catch (e) {
  console.error('Falha ao limpar localStorage:', e);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <App />
      </AppProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
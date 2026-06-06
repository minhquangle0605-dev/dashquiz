import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ThemeRoot } from '@/components/ThemeRoot';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PwaInstallPrompt } from '@/components/shared/PwaInstallPrompt';
import { PwaUpdatePrompt } from '@/components/shared/PwaUpdatePrompt';
import { SocketProvider } from '@/providers/SocketProvider';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SocketProvider>
          <ThemeRoot>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
            <PwaInstallPrompt />
            <PwaUpdatePrompt />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                },
              }}
            />
          </ThemeRoot>
        </SocketProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

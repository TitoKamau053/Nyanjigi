if (process.env.NODE_ENV === 'production') {
  // @ts-ignore
  console.log = () => {};
  // @ts-ignore
  console.warn = () => {};
  // @ts-ignore
  console.error = () => {};
  // @ts-ignore
  console.info = () => {};
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);

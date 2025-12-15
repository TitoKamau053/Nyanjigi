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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

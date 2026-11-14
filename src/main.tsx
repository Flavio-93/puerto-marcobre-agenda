import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { TareasProvider } from './context/TareasContext';
import { ThemeProvider } from './context/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <TareasProvider>
          <App />
        </TareasProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// Registro activo de Service Worker para PWA en Android e iOS
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('✅ [PWA] Service Worker registrado exitosamente con scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('⚠️ [PWA] Error registrando Service Worker:', err);
      });
  });
}

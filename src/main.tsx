import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Vite emite `vite:preloadError` cuando un chunk lazy falla en cargar (404, red, OneDrive
// lock durante sync). El handler default es `window.location.reload()`, lo que se
// percibe como auto-reload silencioso de la app cada 3-5 min cuando preview corre sobre
// `dist/` dentro de OneDrive. Cancelamos el reload y dejamos que la nav fallida
// surfacee como error normal — el usuario puede recargar manualmente si la app rompe.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  console.warn('[vite:preloadError] chunk no disponible — reload automático cancelado', event);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

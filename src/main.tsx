import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// StrictMode duplica effects y queries en cada render para detectar bugs.
// En desarrollo es útil; en producción CAUSA contención de queries paralelas
// idénticas al SDK Supabase, multiplicando timeouts y race conditions.
const root = createRoot(document.getElementById('root')!);

if (import.meta.env.DEV) {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  root.render(<App />);
}

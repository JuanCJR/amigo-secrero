import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './anim/gsap';
import './styles.css';
import { App } from './App';
import { fx } from './anim/fx';
import { jm } from './mascot/controller';

if (import.meta.env.DEV) (window as unknown as { jm: typeof jm }).jm = jm;

async function boot() {
  if (import.meta.env.VITE_DEMO) {
    document.body.classList.add('demo');
    (await import('./demo/mock')).installMock();
  }
  fx.mount();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
boot();

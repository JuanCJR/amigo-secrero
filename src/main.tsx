import '@fontsource/bagel-fat-one';
import '@fontsource-variable/figtree';
import './lib/gsap';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);

import { resetDemo } from './mock';
import { flag, tokens } from '../api';

/** Franja mínima solo para la demo: cambiar de vista y reiniciar. */
export function DemoBar({ org, onSwitch }: { org: boolean; onSwitch: (org: boolean) => void }) {
  const reset = () => {
    resetDemo(); tokens.set('p', null); tokens.set('a', null);
    ['tour', 'draw_seen'].forEach(flag.del);
    for (let i = 1; i < 40; i++) flag.del('revealed_' + i);
    location.hash = ''; location.reload();
  };
  return (
    <div className="demo-bar" role="region" aria-label="Controles de la demo">
      <span className="demo-hint">Claves de prueba<br />Personas 1111 · Org. 123456</span>
      <div className="demo-btns">
        <button className={!org ? 'on' : ''} onClick={() => onSwitch(false)}>Participante</button>
        <button className={org ? 'on' : ''} onClick={() => onSwitch(true)}>Organizador</button>
        <button onClick={reset}>Reiniciar</button>
      </div>
    </div>
  );
}

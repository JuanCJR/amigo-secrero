// Vista previa de José 3D: /jose3d.html?mood=celebrating&yaw=0.6&t=1.2&clear=1&look=toon
// Usa el mismo controlador que la app, así se prueban los ánimos reales.
import { JoseController, type Mood } from './controller3d';

const q = new URLSearchParams(location.search);
const clear = q.has('clear');
if (clear) {
  document.body.classList.add('clear');
  document.documentElement.style.background = 'transparent';
}
const ctrl = new JoseController(document.getElementById('stage')!, {
  transparent: clear,
  background: '#0F4A37',
  framing: 'portrait',
  smoke: true,
  capture: q.has('t'),
  look: q.get('look') === 'toon' ? 'toon' : 'pixar',
});
const yaw = Number(q.get('yaw') || 0);
if (yaw) ctrl.stage.onFrame = () => void (ctrl.rig.turn = yaw);

const moods: Mood[] = ['idle', 'talking', 'pointing', 'thinking', 'celebrating', 'worried', 'sleeping', 'covering', 'peeking'];
const labels: Record<Mood, string> = {
  idle: 'Tranqui',
  talking: 'Habla',
  pointing: 'Señala',
  thinking: 'Piensa',
  celebrating: 'Celebra',
  worried: 'Preocupado',
  sleeping: 'Duerme',
  covering: 'Se tapa',
  peeking: 'Espía',
};
const apply = (m: Mood) => {
  if (m === 'pointing') ctrl.setMood('pointing', { target: { x: innerWidth, y: innerHeight * 0.3 } });
  else ctrl.setMood(m);
  if (m === 'talking') ctrl.talk(true);
  else ctrl.talk(false);
};
apply((q.get('mood') as Mood) || 'idle');

// renders fijos: dejar que las transiciones terminen y avisar
const fixed = q.get('t');
if (fixed !== null) setTimeout(() => (document.body.dataset.ready = '1'), Number(fixed) * 1000 + 200);

const bar = document.querySelector('.moods')!;
for (const m of moods) {
  const b = document.createElement('button');
  b.textContent = labels[m];
  b.setAttribute('aria-pressed', String(m === ctrl.mood));
  b.onclick = () => {
    apply(m);
    bar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  };
  bar.appendChild(b);
}
(window as unknown as { jose: JoseController }).jose = ctrl;

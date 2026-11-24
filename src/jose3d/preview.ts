// Vista previa de José 3D: /jose3d.html?mood=wave&yaw=0.6&t=1.2&clear=1
import { JoseStage, type Mood3D } from './stage';

const q = new URLSearchParams(location.search);
const clear = q.has('clear');
if (clear) document.body.classList.add('clear');
if (clear) document.documentElement.style.background = 'transparent';
const stage = new JoseStage(document.getElementById('stage')!, {
  transparent: clear,
  capture: q.has('t'),
  yaw: Number(q.get('yaw') || 0),
  followPointer: !q.has('t'),
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
});
stage.setMood((q.get('mood') as Mood3D) || 'idle');

const fixed = q.get('t');
if (fixed !== null) {
  stage.renderAt(Number(fixed));
  document.body.dataset.ready = '1';
} else {
  stage.start();
}

const moods: Mood3D[] = ['idle', 'wave', 'celebrate', 'worried', 'thinking', 'sleep'];
const labels: Record<Mood3D, string> = { idle: 'Tranqui', wave: 'Saluda', celebrate: 'Celebra', worried: 'Preocupado', thinking: 'Pensando', sleep: 'Duerme' };
const bar = document.querySelector('.moods')!;
for (const m of moods) {
  const b = document.createElement('button');
  b.textContent = labels[m];
  b.setAttribute('aria-pressed', String(m === stage.mood));
  b.onclick = () => {
    stage.setMood(m);
    bar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  };
  bar.appendChild(b);
}
(window as any).jose = stage;

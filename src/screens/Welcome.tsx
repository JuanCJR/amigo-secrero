import { useRef } from 'react';
import { gsap, useGSAP, SplitText, motion } from '../lib/gsap';
import { useSay } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { knownGroups, seen } from '../lib/storage';

export function Welcome() {
  useScreenMeta({});
  const { navigate } = useRouter();
  const groups = knownGroups();
  const first = !seen.has('hello');
  useSay(
    groups.length
      ? { text: '¡Volviste, qué bueno! Toca tu grupo para entrar, o arma uno nuevo con el botón rojo.', point: '.known-group' }
      : {
          text: first
            ? '¡Hola! Soy José Miguel y voy a ser tu guía, tranqui. Toca el botón rojo para armar tu amigo secreto.'
            : 'Toca el botón rojo para armar un amigo secreto nuevo. Yo te acompaño en cada paso.',
          point: '.screen-cta .btn',
        },
  );
  seen.mark('hello');
  const title = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      if (motion.reduced) return;
      const split = SplitText.create(title.current!.querySelector('.hero-word'), { type: 'chars' });
      gsap.from(split.chars, {
        y: -80,
        rotation: () => gsap.utils.random(-40, 40),
        scaleY: 1.4,
        opacity: 0,
        duration: 1,
        ease: 'landing',
        stagger: 0.05,
        delay: 0.2,
      });
      gsap.to(split.chars, {
        y: -6,
        duration: 0.9,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.08, repeat: -1, yoyo: true },
        delay: 1.4,
      });
    },
    { scope: title },
  );

  return (
    <Screen cta={<Btn onClick={() => navigate('/crear/1')}>Armar un amigo secreto</Btn>}>
      <h1 className="hero-title" ref={title}>
        <span className="hero-word">Amigo Secreto</span>
        <span className="hero-sub" data-anim="pop">
          con José Miguel
        </span>
      </h1>
      <ul className="how" aria-label="Cómo funciona">
        {[
          ['🎩', 'Sorteo mágico', 'Nadie se saca a sí mismo y nadie ve el de otro.'],
          ['🎁', 'Revelación', 'Cada uno abre su regalo y descubre a quién le toca.'],
          ['📝', 'Lista de deseos', 'Pegas links de regalos y tu amigo secreto los ve.'],
        ].map(([icon, t, s]) => (
          <li key={t} data-anim="pop" className="how-item">
            <span className="how-icon" aria-hidden="true">
              {icon}
            </span>
            <span>
              <strong>{t}</strong>
              <small>{s}</small>
            </span>
          </li>
        ))}
      </ul>
      {groups.length > 0 && (
        <div className="known">
          <div className="group-label" data-anim="pop">
            Tus grupos
          </div>
          {groups.map((g) => (
            <button
              key={g.gid + g.role}
              className="known-group"
              data-anim="pop"
              onClick={() => navigate(g.role === 'admin' ? `/g/${g.gid}/admin` : `/g/${g.gid}`)}
            >
              <strong>{g.title}</strong>
              <small>{g.role === 'admin' ? 'Eres organizador' : `Entras como ${g.name}`}</small>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}

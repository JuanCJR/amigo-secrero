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
      const split = SplitText.create(title.current!.querySelectorAll('.hero-word'), { type: 'chars' });
      // las letras caen como papelitos y quedan quietas: nada de rebote infinito
      gsap.from(split.chars, {
        y: -60,
        rotation: () => gsap.utils.random(-25, 25),
        opacity: 0,
        duration: 0.8,
        ease: 'landing',
        stagger: 0.04,
        delay: 0.2,
      });
    },
    { scope: title },
  );

  return (
    <Screen cta={<Btn onClick={() => navigate('/crear/1')}>Armar un amigo secreto</Btn>}>
      <h1 className="hero-title" ref={title} aria-label="Amigo secreto">
        <span className="hero-word" aria-hidden="true">
          Amigo
        </span>
        <span className="hero-word" aria-hidden="true">
          Secre<span className="hero-accent">to</span>
        </span>
      </h1>
      <div className="ticket how-ticket" data-anim="pop">
        <div className="ticket-body">
          <span className="ticket-kicker">Cómo funciona</span>
          <p>Anotas los nombres, mandas un link al grupo y cada uno abre su papelito. Nadie ve el de nadie, ni siquiera tú.</p>
        </div>
        <div className="ticket-stub" aria-hidden="true">
          Nº1
        </div>
      </div>
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

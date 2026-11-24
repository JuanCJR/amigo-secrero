import { useLayoutEffect, useRef, useState } from 'react';
import { gsap, motion } from '../lib/gsap';
import { Avatar, randomSeed } from './Avatar';
import { Btn } from './Btn';
import { Field } from './Field';

export interface NameEntry {
  id?: string;
  name: string;
  avatar: string;
}

/** Editor de participantes: cada nombre "aterriza" en la lista con su avatar aleatorio. */
export function NamesEditor({
  value,
  onChange,
  onError,
}: {
  value: NameEntry[];
  onChange: (v: NameEntry[]) => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const justAdded = useRef<string | null>(null);

  useLayoutEffect(() => {
    const key = justAdded.current;
    if (!key || !list.current) return;
    justAdded.current = null;
    const el = list.current.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
    if (!el || motion.reduced) return;
    const from = input.current!.getBoundingClientRect();
    const to = el.getBoundingClientRect();
    gsap
      .timeline()
      .from(el, {
        x: from.left + 20 - to.left,
        y: from.top - to.top,
        scale: 0.6,
        rotation: -20,
        duration: 0.55,
        ease: 'power3.out',
      })
      .to(el, { scaleY: 0.82, scaleX: 1.12, duration: 0.08, ease: 'power2.in' })
      .to(el, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1.2,0.4)' });
  }, [value]);

  const add = () => {
    const name = text.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!name) {
      onError('Ya po, weón, primero escribe un nombre en el cuadro y después toca Agregar.');
      input.current?.focus();
      return;
    }
    if (value.some((v) => v.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) {
      onError(`Oe weón, ya hay un ${name} en la lista. Ponle una inicial, como "${name} G.", pa no armar la cagá.`);
      return;
    }
    if (value.length >= 40) {
      onError('¡Puta la weá, ya son 40! Ese es el máximo, culiao. Saca a alguien si querí meter a otro.');
      return;
    }
    const avatar = randomSeed();
    justAdded.current = avatar;
    onChange([...value, { name, avatar }]);
    setText('');
    input.current?.focus();
  };

  const remove = (i: number, el: HTMLElement) => {
    const done = () => onChange(value.filter((_, j) => j !== i));
    if (motion.reduced) return done();
    gsap.to(el, { scale: 0, rotation: 25, y: 30, opacity: 0, duration: 0.35, ease: 'back.in(2)', onComplete: done });
  };

  const reroll = (i: number, el: Element) => {
    const next = [...value];
    next[i] = { ...next[i], avatar: randomSeed() };
    if (!motion.reduced) {
      gsap
        .timeline()
        .to(el, { rotationY: 90, scale: 0.8, duration: 0.18, ease: 'power2.in', onComplete: () => onChange(next) })
        .to(el, { rotationY: 0, scale: 1, duration: 0.6, ease: 'elastic.out(1.1,0.45)' });
    } else onChange(next);
  };

  return (
    <div className="names-editor">
      <div className="add-row" data-anim="pop">
        <Field
          ref={input}
          label="Nombre"
          placeholder="Ej: Camila"
          value={text}
          enterKeyHint="done"
          autoComplete="off"
          maxLength={30}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Btn variant="soft" className="add-btn" onClick={add} anim={false} aria-label="Agregar nombre" id="add-name">
          + Agregar
        </Btn>
      </div>
      <ul className="names-list" ref={list}>
        {value.map((p, i) => (
          <li key={p.id || p.avatar} data-key={p.avatar} className="name-chip" data-anim="pop">
            <button className="avatar-btn" onClick={(e) => reroll(i, e.currentTarget.firstElementChild!)} aria-label={`Cambiar avatar de ${p.name}`}>
              <Avatar seed={p.avatar} size={48} />
            </button>
            <span className="name-text">{p.name}</span>
            <button
              className="remove-btn"
              aria-label={`Quitar a ${p.name}`}
              onClick={(e) => remove(i, e.currentTarget.closest('li') as HTMLElement)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useLayoutEffect, useRef } from 'react';
import { gsap, motion, SplitText } from '../lib/gsap';
import { useJose } from './JoseProvider';

const CLOUD =
  'M24,62 C2,62 2,30 26,30 C26,8 62,2 76,20 C88,2 128,2 134,22 C152,6 194,16 186,44 C202,54 196,90 172,84 C164,100 120,100 110,88 C96,102 52,100 48,86 C26,96 4,80 24,62 Z';
const SPEECH =
  'M16,4 L184,4 C192,4 196,8 196,16 L196,84 C196,92 192,96 184,96 L16,96 C8,96 4,92 4,84 L4,16 C4,8 8,4 16,4 Z';

export function Bubble() {
  const { msg, smokeBurst, setTyping, setMood, ctrl, puff } = useJose();
  const wrap = useRef<HTMLDivElement>(null);
  const shape = useRef<SVGPathElement>(null);
  const textEl = useRef<HTMLSpanElement>(null);
  const oldEl = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const typer = useRef<gsap.core.Tween | null>(null);
  const shown = useRef(false);
  const pendingPoint = useRef<number>(0);

  useLayoutEffect(() => {
    if (!msg || !wrap.current || !textEl.current) return;
    const el = wrap.current;
    const R = motion.reduced;
    typer.current?.kill();
    window.clearTimeout(pendingPoint.current);

    // estado de ánimo
    const c = ctrl();
    const resolvePoint = (tries = 0) => {
      if (!msg.point) return;
      const target = typeof msg.point === 'string' ? document.querySelector<HTMLElement>(msg.point) : msg.point;
      if (!target) {
        if (tries < 15) pendingPoint.current = window.setTimeout(() => resolvePoint(tries + 1), 120);
        return;
      }
      const r = target.getBoundingClientRect();
      setMood('pointing', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    };
    if (!msg.keepMood && c) {
      if (msg.point) pendingPoint.current = window.setTimeout(() => resolvePoint(), 250);
      else c.setMood(msg.mood ?? 'idle');
    }

    // aparición desde el humo
    const tl = gsap.timeline();
    const updating = shown.current;
    if (!shown.current) {
      shown.current = true;
      const r = el.getBoundingClientRect();
      smokeBurst({ x: r.left + 20, y: r.top + r.height / 2 }, 6);
      gsap.set(shape.current, { morphSVG: CLOUD });
      tl.fromTo(
        el,
        { scale: 0.2, opacity: 0, rotation: -8 },
        { scale: 1, opacity: 1, rotation: 0, duration: R ? 0.2 : 0.7, ease: 'elastic.out(1,0.55)', delay: R ? 0 : 0.3 },
      ).to(shape.current, { morphSVG: SPEECH, duration: R ? 0 : 0.55, ease: 'back.out(1.6)' }, R ? 0 : 0.42);
      if (!R && tailRef.current)
        tl.fromTo(tailRef.current.children, { scale: 0 }, { scale: 1, stagger: 0.07, duration: 0.4, ease: 'back.out(3)' }, 0.2);
    } else if (!R) {
      tl.to(el, { scaleX: 1.04, scaleY: 0.9, duration: 0.1, ease: 'power2.in' })
        .to(el, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1.1,0.4)' })
        .to(shape.current, { morphSVG: CLOUD, duration: 0.14, ease: 'power2.in' }, 0)
        .to(shape.current, { morphSVG: SPEECH, duration: 0.5, ease: 'back.out(2)' }, 0.14);
    }

    // máquina de escribir
    const text = msg.text;
    const t = textEl.current;
    if (R) {
      t.textContent = text;
      return;
    }
    // el mensaje anterior se disuelve en humo mientras el nuevo empieza a escribirse
    const prev = t.textContent || '';
    const old = oldEl.current;
    let dissolving = false;
    if (prev && old && updating) {
      dissolving = true;
      gsap.killTweensOf(old);
      old.textContent = prev;
      gsap.set(old, { opacity: 1 });
      const split = SplitText.create(old, { type: 'words' });
      gsap.to(split.words, {
        y: () => gsap.utils.random(-26, -12),
        x: () => gsap.utils.random(-10, 10),
        rotation: () => gsap.utils.random(-25, 25),
        scale: 0.5,
        opacity: 0,
        duration: 0.42,
        ease: 'power2.in',
        stagger: { each: 0.012, from: 'random' },
        onComplete: () => {
          split.revert();
          old.textContent = '';
        },
      });
      const r = el.getBoundingClientRect();
      for (let i = 0; i < 5; i++)
        puff(r.left + gsap.utils.random(0.15, 0.85) * r.width, r.top + gsap.utils.random(0.2, 0.8) * r.height, { size: 30, rise: 40, life: 1.1 });
    }
    t.textContent = '';
    const o = { n: 0 };
    setTyping(true);
    typer.current = gsap.to(o, {
      n: text.length,
      duration: Math.min(3.2, text.length * 0.026),
      ease: 'none',
      delay: !updating ? 0.45 : dissolving ? 0.14 : 0.05,
      onUpdate: () => {
        t.textContent = text.slice(0, Math.round(o.n));
      },
      onComplete: () => setTyping(false),
    });
    return () => {
      setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg?.id]);

  const complete = () => {
    if (typer.current && typer.current.isActive()) {
      typer.current.progress(1);
      gsap.fromTo(wrap.current, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1,0.4)' });
    }
  };

  return (
    <div className="bubble-wrap" onClick={complete}>
      <div className="bubble-tail" ref={tailRef} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="bubble" ref={wrap} style={{ opacity: msg ? undefined : 0 }}>
        <svg className="bubble-bg" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
          <path ref={shape} d={SPEECH} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="bubble-text" ref={textEl} aria-hidden="true" />
        <span className="bubble-old" ref={oldEl} aria-hidden="true" />
        <span className="bubble-measure" aria-hidden="true">
          {msg?.text}
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {msg ? `José Miguel dice: ${msg.text}` : ''}
      </p>
    </div>
  );
}

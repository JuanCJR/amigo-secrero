import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, motion, SplitText } from '../lib/gsap';
import { useJose, JoseSlot } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { Avatar } from '../components/Avatar';
import { confetti } from '../components/confetti';
import { joseError } from '../lib/api';
import { isAuthError, useMatch, useMe } from '../lib/data';
import { seen } from '../lib/storage';

const HOLD_SECONDS = 1.6;

function GiftSvg() {
  return (
    <>
      <svg viewBox="0 0 200 200" className="gift-box" aria-hidden="true" overflow="visible">
        <path d="M30,92 L170,92 L162,190 L38,190 Z" fill="#E8443A" stroke="#3B2A2A" strokeWidth="4" strokeLinejoin="round" />
        <path d="M30,92 L170,92 L168,112 L32,112 Z" fill="#B5302A" opacity="0.5" />
        <path className="ribbon-v" d="M100,92 L100,190" stroke="#2E9E6E" strokeWidth="20" />
        <path d="M44,120 L44,180" stroke="#FF7A6E" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
        <path className="ribbon-end" d="M100,96 C80,120 70,150 62,176" stroke="#2E9E6E" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0" />
        <path className="ribbon-end" d="M100,96 C120,120 134,150 140,176" stroke="#2E9E6E" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0" />
      </svg>
      <svg viewBox="0 0 200 200" className="gift-lid" aria-hidden="true" overflow="visible">
        <rect x="20" y="66" width="160" height="32" rx="7" fill="#F05A50" stroke="#3B2A2A" strokeWidth="4" />
        <path className="ribbon-lid" d="M100,66 L100,98" stroke="#2E9E6E" strokeWidth="20" />
        <g className="bow">
          <path d="M100,66 C70,20 40,40 66,62 C76,70 90,68 100,66 Z" fill="#2E9E6E" stroke="#3B2A2A" strokeWidth="4" strokeLinejoin="round" />
          <path d="M100,66 C130,20 160,40 134,62 C124,70 110,68 100,66 Z" fill="#2E9E6E" stroke="#3B2A2A" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="100" cy="64" r="10" fill="#3FBF86" stroke="#3B2A2A" strokeWidth="4" />
        </g>
      </svg>
    </>
  );
}

export function Reveal({ gid }: { gid: string }) {
  useScreenMeta({ back: `/g/${gid}/inicio`, hero: true });
  const { navigate } = useRouter();
  const jose = useJose();
  const { data: me } = useMe(gid);
  const { data, error } = useMatch(gid);
  const pid = me?.me.id;
  const [phase, setPhase] = useState<'intro' | 'ready' | 'opening' | 'done'>('intro');
  const scene = useRef<HTMLDivElement>(null);
  const gift = useRef<HTMLButtonElement>(null);
  const holdTl = useRef<gsap.core.Timeline | null>(null);
  const openTl = useRef<gsap.core.Timeline | null>(null);
  const shake = useRef({ amp: 0, t: 0 });
  const holding = useRef(false);
  const openedAt = useRef(0);
  const ignoreClick = useRef(false);
  const sparkRef = useRef<HTMLDivElement>(null);
  const ambient = useRef<(gsap.core.Animation | gsap.core.Tween)[]>([]);

  useEffect(() => () => ambient.current.forEach((a) => a.kill()), []);

  /** Después de abrir: la caja rebota de vez en cuando, la carta flota y salen brillitos de adentro. */
  const startAmbient = () => {
    if (motion.reduced || !scene.current) return;
    const q = gsap.utils.selector(scene);
    const box = q('.gift-box')[0];
    const card = q('.gift-card')[0];
    ambient.current.push(
      gsap
        .timeline({ repeat: -1, repeatDelay: 1.8, delay: 0.6 })
        .to(box, { scaleY: 0.9, scaleX: 1.07, duration: 0.12, ease: 'power2.in', transformOrigin: '50% 95%' })
        .to(box, { scaleY: 1.06, scaleX: 0.96, duration: 0.14, ease: 'power2.out' })
        .to(box, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1.2,0.35)' })
        .to(card, { y: -10, duration: 0.18, ease: 'power2.out' }, 0.12)
        .to(card, { y: 0, duration: 0.6, ease: 'bounce.out' }, 0.3),
      gsap.to(card, { rotation: 2.5, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
    );
    const layer = sparkRef.current;
    if (!layer) return;
    const COLORS = ['#FFC15E', '#FFF3DD', '#FF8A3D', '#8FF0C2'];
    const spawn = () => {
      const el = document.createElement('i');
      el.className = Math.random() < 0.55 ? 'sp sp-star' : 'sp';
      el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      layer.appendChild(el);
      const w = layer.clientWidth;
      const life = gsap.utils.random(1.1, 1.8);
      gsap.set(el, { x: gsap.utils.random(0.1, 0.9) * w, y: 0, scale: 0, rotation: gsap.utils.random(0, 180) });
      gsap
        .timeline({ onComplete: () => el.remove() })
        .to(el, { scale: gsap.utils.random(0.8, 1.5), duration: 0.25, ease: 'back.out(3)' }, 0)
        .to(el, { y: gsap.utils.random(-150, -90), duration: life, ease: 'power1.out' }, 0)
        .to(el, { x: `+=${gsap.utils.random(-30, 30)}`, rotation: '+=180', duration: life, ease: 'sine.inOut' }, 0)
        .to(el, { scale: 0, opacity: 0, duration: 0.4, ease: 'power1.in' }, life - 0.4);
    };
    const loop = () => {
      spawn();
      const c = gsap.delayedCall(gsap.utils.random(0.07, 0.16), loop);
      ambient.current.push(c);
    };
    loop();
    const glow = q('.box-glow')[0];
    if (glow)
      ambient.current.push(
        gsap.fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }),
        gsap.to(glow, { scaleX: 1.15, opacity: 0.6, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.6 }),
      );
  };
  const repeat = pid ? seen.has(`reveal:${gid}:${pid}`) : false;
  const name = data?.receiver.name ?? '';

  useEffect(() => {
    if (!error) return;
    if (isAuthError(error)) navigate(`/g/${gid}`, { replace: true });
    else jose.say({ text: joseError(error), mood: 'worried' });
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  // el regalo tiembla según cuánta presión lleva (solo transform)
  useEffect(() => {
    if (!gift.current || motion.reduced) return;
    const setR = gsap.quickSetter(gift.current, 'rotation', 'deg');
    const setX = gsap.quickSetter(gift.current, 'x', 'px');
    const tick = (_t: number, dt: number) => {
      const s = shake.current;
      if (s.amp < 0.01) return;
      s.t += dt / 1000;
      setR(Math.sin(s.t * 38) * s.amp * 9);
      setX(Math.sin(s.t * 51) * s.amp * 5);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  // entrada: José trae el regalo
  useGSAP(
    () => {
      if (!data || !me) return;
      const g = gift.current!;
      const q = gsap.utils.selector(scene);
      gsap.set(q('.gift-card'), { yPercent: 40, scale: 0.7, opacity: 0 });
      gsap.set(q('.card-flipper'), { rotationY: 0, transformPerspective: 900 });
      gsap.set(q('.hold-ring circle.fill'), { drawSVG: '0%' });
      if (motion.reduced) {
        setPhase('ready');
        jose.say({ text: repeat ? 'Toca el regalo pa verlo otra vez.' : 'Toca el regalo pa abrirlo y cachar quién es tu amigo secreto.', point: '.gift' });
        return;
      }
      if (repeat) {
        gsap.from(g, { scale: 0, rotation: -30, duration: 0.6, ease: 'back.out(2)' });
        setPhase('ready');
        jose.say({ text: 'Ya lo abriste antes, pero dale otra vez no más: toca el regalo.', point: '.gift' });
        return;
      }
      jose.say({ text: 'Te traje algo, hermanito. Déjame ponerlo aquí…', keepMood: true });
      gsap.delayedCall(0.8, () => {
        const ctrl = jose.ctrl();
        if (!ctrl) return;
        ctrl.holdPose('hold', 0.3);
        const s = g.getBoundingClientRect();
        const hands = ctrl.svgToScreen(100, 186);
        const dx = hands.x - (s.left + s.width / 2);
        const dy = hands.y - (s.top + s.height / 2);
        const tl = gsap.timeline({
          onComplete: () => {
            setPhase('ready');
            ctrl.setMood('idle');
            jose.say({ text: 'Mantén apretao el regalo hasta que se llene el círculo. Yo no miro, palabra de choro.', point: '.gift' });
          },
        });
        tl.set(g, { opacity: 1 })
          .from(g, { x: dx, y: dy, scale: 0.3, rotation: -25, duration: 0.01 })
          .to(ctrl.p.root, { scaleY: 0.85, scaleX: 1.1, duration: 0.2, ease: 'power2.in' }, 0.15)
          .to(ctrl.p.root, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' }, 0.35)
          .to(
            g,
            {
              motionPath: { path: [{ x: dx / 2, y: dy - 120 }, { x: 0, y: 0 }], curviness: 1.2 },
              scale: 1,
              rotation: 0,
              duration: 0.8,
              ease: 'power1.inOut',
            },
            0.3,
          )
          .to(g, { scaleY: 0.78, scaleX: 1.18, duration: 0.1, ease: 'power2.in', transformOrigin: '50% 100%' })
          .to(g, { scaleY: 1, scaleX: 1, duration: 0.8, ease: 'elastic.out(1.3,0.35)' })
          .call(() => ctrl.holdPose('rest'), [], 1.1);
      });
    },
    { scope: scene, dependencies: [!!data, !!me] },
  );

  const open = () => {
    if (phase === 'opening' || phase === 'done') return;
    setPhase('opening');
    openedAt.current = performance.now();
    ignoreClick.current = holding.current;
    holding.current = false;
    holdTl.current?.kill();
    const q = gsap.utils.selector(scene);
    const g = gift.current!;
    const ctrl = jose.ctrl();
    const card = q('.gift-card')[0] as HTMLElement;
    const nameEl = q('.card-name')[0] as HTMLElement;
    const finish = () => {
      setPhase('done');
      startAmbient();
      if (pid) seen.mark(`reveal:${gid}:${pid}`);
      jose.say({ text: `¡Te tocó el ${name}, loco! Toca el botón pa ver qué le tinca.`, mood: 'celebrating', point: '.screen-cta .btn' });
    };
    if (motion.reduced) {
      gsap.to(q('.gift-lid, .gift-box, .hold-ring'), { opacity: 0, duration: 0.25 });
      gsap.set(q('.card-flipper'), { rotationY: 180 });
      gsap.to(card, { opacity: 1, yPercent: -10, scale: 1, duration: 0.3 });
      nameEl.textContent = name;
      finish();
      return;
    }
    shake.current.amp = 0;
    gsap.set(g, { rotation: 0, x: 0 });
    const tl = gsap.timeline({ onComplete: finish });
    openTl.current = tl;
    if (repeat) tl.timeScale(2.4);
    // anticipación
    tl.call(() => ctrl?.setMood('covering'), [], 0);
    tl.to(q('.hold-ring'), { scale: 1.4, opacity: 0, duration: 0.4, ease: 'power2.out' }, 0);
    tl.to(g, { scaleY: 0.8, scaleX: 1.16, duration: 0.22, ease: 'power2.in', transformOrigin: '50% 100%' }, 0);
    // la cinta se desata y el moño sale volando
    tl.to(q('.ribbon-lid'), { drawSVG: '50% 50%', duration: 0.35, ease: 'power2.in' }, 0.25);
    tl.to(q('.ribbon-v'), { drawSVG: '100% 100%', duration: 0.45, ease: 'power2.in' }, 0.3);
    tl.set(q('.ribbon-end'), { opacity: 1, drawSVG: '0% 100%' }, 0.3);
    tl.set(q('.ribbon-v, .ribbon-lid'), { opacity: 0 }, 0.8);
    tl.to(q('.ribbon-end'), { drawSVG: '100% 100%', duration: 0.5, ease: 'power3.out', stagger: 0.05 }, 0.32);
    tl.set(q('.ribbon-end'), { opacity: 0 }, 0.9);
    tl.to(
      q('.bow'),
      { motionPath: { path: [{ x: 60, y: -120 }, { x: 160, y: -60 }, { x: 240, y: 200 }], curviness: 1.4 }, rotation: 600, svgOrigin: '100 60', duration: 1.1, ease: 'power1.in' },
      0.3,
    );
    // la tapa salta
    tl.to(g, { scaleY: 1.12, scaleX: 0.92, duration: 0.15, ease: 'power2.out' }, 0.8);
    tl.to(g, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1.2,0.35)' }, 0.95);
    tl.to(q('.gift-lid'), { y: -360, x: 140, rotation: 220, duration: 0.9, ease: 'power2.out' }, 0.8);
    tl.to(q('.gift-lid'), { scaleY: 1.25, scaleX: 0.9, duration: 0.12, yoyo: true, repeat: 1 }, 0.8);
    tl.fromTo(q('.rays'), { scale: 0, opacity: 0, rotation: 0 }, { scale: 1, opacity: 1, rotation: 90, duration: 1.4, ease: 'back.out(1.6)' }, 0.9);
    tl.call(() => {
      gsap.to(q('.rays'), { rotation: '+=360', duration: 12, ease: 'none', repeat: -1 });
    }, [], 2.3);
    // la carta sube y gira en 3D
    tl.call(() => ctrl?.setMood('peeking'), [], 1.2);
    tl.to(card, { opacity: 1, duration: 0.1 }, 1.3);
    tl.to(card, { yPercent: -95, scale: 1, duration: 0.7, ease: 'back.out(2.2)' }, 1.3);
    tl.set(card, { zIndex: 6 }, 1.6);
    tl.to(q('.card-flipper'), { rotationY: 180, duration: 0.8, ease: 'back.out(1.4)' }, 2.0);
    tl.to(card, { yPercent: -70, duration: 0.6, ease: 'power2.inOut' }, 2.2);
    // el nombre: scramble y rebote letra por letra
    tl.to(nameEl, { duration: 0.8, scrambleText: { text: name, chars: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ★?', speed: 0.6 } }, 2.5);
    tl.call(
      () => {
        const split = SplitText.create(nameEl, { type: 'chars' });
        gsap
          .timeline()
          .to(split.chars, { y: -18, scaleY: 1.25, scaleX: 0.85, duration: 0.16, ease: 'power2.out', stagger: 0.04 })
          .to(split.chars, { y: 0, scaleY: 1, scaleX: 1, duration: 0.7, ease: 'bounce.out', stagger: 0.04 }, 0.16);
        const r = card.getBoundingClientRect();
        confetti(r.left + r.width / 2, r.top + r.height / 3, { count: 100 });
        ctrl?.setMood('celebrating');
      },
      [],
      3.35,
    );
    tl.to({}, { duration: 0.9 }, 3.35);
  };

  // gesto: mantener presionado
  const startHold = () => {
    if (phase !== 'ready' || holding.current) return;
    if (motion.reduced || repeat) return open();
    holding.current = true;
    const q = gsap.utils.selector(scene);
    const ctrl = jose.ctrl();
    ctrl?.setMood('covering');
    holdTl.current?.kill();
    const tl = gsap.timeline({ onComplete: open });
    holdTl.current = tl;
    tl.to(q('.hold-ring circle.fill'), { drawSVG: '100%', duration: HOLD_SECONDS, ease: 'power1.in' }, 0)
      .to(shake.current, { amp: 1, duration: HOLD_SECONDS, ease: 'power2.in' }, 0)
      .to(q('.gift-scale'), { scale: 1.1, duration: HOLD_SECONDS, ease: 'power1.in' }, 0)
      .to(q('.hold-ring'), { scale: 1.06, duration: HOLD_SECONDS, ease: 'power1.in' }, 0)
      .call(() => ctrl?.react('flare'), [], HOLD_SECONDS * 0.5)
      .call(() => ctrl?.react('flare'), [], HOLD_SECONDS * 0.85);
  };
  const endHold = () => {
    if (!holding.current) return;
    holding.current = false;
    const tl = holdTl.current;
    if (!tl || tl.progress() >= 1) return;
    tl.pause();
    const q = gsap.utils.selector(scene);
    gsap.to(q('.hold-ring circle.fill'), { drawSVG: '0%', duration: 0.4, ease: 'power2.out' });
    gsap.to(shake.current, { amp: 0, duration: 0.3 });
    gsap.to(q('.gift-scale, .hold-ring'), { scale: 1, duration: 0.8, ease: 'elastic.out(1.2,0.3)' });
    gsap.to(gift.current, { rotation: 0, x: 0, duration: 0.6, ease: 'elastic.out(1,0.3)', delay: 0.3 });
    jose.say({ text: '¡Casi, casi! Mantenlo apretao un poquito más, hasta que se llene el círculo.', point: '.gift' });
  };

  const skip = () => {
    const tl = openTl.current;
    if (ignoreClick.current) {
      ignoreClick.current = false;
      return;
    }
    // el click que llega al soltar el regalo no cuenta como "saltar"
    if (phase === 'opening' && tl && tl.isActive() && performance.now() - openedAt.current > 600) tl.progress(1);
  };

  return (
    <Screen
      className="scene-screen"
      cta={
        phase === 'done' ? (
          <Btn onClick={() => navigate(`/g/${gid}/su-lista`)}>Ver qué le gustaría a {name}</Btn>
        ) : null
      }
    >
      <div className="scene reveal-scene" ref={scene} onClick={skip}>
        <div className="rays" aria-hidden="true" />
        <div className="gift-stage">
          <div className="box-glow" aria-hidden="true" />
          <div className="sparkles" ref={sparkRef} aria-hidden="true" />
          <svg className="hold-ring" viewBox="0 0 220 220" aria-hidden="true">
            <circle cx="110" cy="110" r="100" className="track" />
            <circle cx="110" cy="110" r="100" className="fill" transform="rotate(-90 110 110)" />
          </svg>
          <button
            ref={gift}
            className="gift"
            style={{ opacity: motion.reduced || repeat ? 1 : 0 }}
            aria-label={motion.reduced || repeat ? 'Tocar para abrir el regalo' : 'Mantén presionado para abrir el regalo'}
            disabled={phase === 'intro' || phase === 'done'}
            onPointerDown={(e) => {
              (e.target as Element).releasePointerCapture?.(e.pointerId);
              startHold();
            }}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                startHold();
              }
            }}
            onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && endHold()}
          >
            <span className="gift-scale">
              <div className="gift-card" data-flip-id={phase === 'done' ? 'card-their' : undefined}>
                <div className="card-flipper">
                  <div className="card-face card-front" aria-hidden="true">
                    <span>?</span>
                  </div>
                  <div className="card-face card-back">
                    {data && <Avatar seed={data.receiver.avatar} size={84} />}
                    <small>Le regalas a</small>
                    <strong className="card-name" aria-live="polite">
                      {motion.reduced ? '' : ' '}
                    </strong>
                  </div>
                </div>
              </div>
              <GiftSvg />
            </span>
          </button>
        </div>
        <JoseSlot className="scene-jose reveal-jose" />
      </div>
    </Screen>
  );
}

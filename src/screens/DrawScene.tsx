import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, motion } from '../lib/gsap';
import { useJose, JoseSlot } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { Avatar } from '../components/Avatar';
import { confetti } from '../components/confetti';
import { api, ApiError, joseError, type PublicGroup } from '../lib/api';
import { useAdmin, put } from '../lib/data';
import { drawGuard, seen, tokens } from '../lib/storage';
import { AdminGate, shareWhatsApp, useAdminLock } from './Admin';

function HatBack() {
  return (
    <svg viewBox="0 0 140 150" className="hat hat-back" aria-hidden="true">
      <ellipse cx="70" cy="33" rx="58" ry="15" fill="#5E1712" />
      <ellipse cx="70" cy="36" rx="48" ry="9" fill="#3A0D0A" />
    </svg>
  );
}
function HatFront() {
  return (
    <svg viewBox="0 0 140 150" className="hat hat-front" aria-hidden="true" overflow="visible">
      <path d="M14,34 C20,84 48,118 70,136 C92,118 120,84 126,34 C106,50 34,50 14,34 Z" fill="#E8443A" stroke="#3B2A2A" strokeWidth="3" strokeLinejoin="round" />
      <path d="M34,60 C44,92 58,110 70,122" stroke="#FF7A6E" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M8,30 C30,52 110,52 132,30 L132,40 C110,64 30,64 8,40 Z" fill="#FFF8EE" stroke="#3B2A2A" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="70" cy="140" r="11" fill="#FFF8EE" stroke="#3B2A2A" strokeWidth="3" />
    </svg>
  );
}
function Envelope() {
  return (
    <svg viewBox="0 0 40 28" aria-hidden="true">
      <rect x="1.5" y="1.5" width="37" height="25" rx="3" fill="#FFF3DD" stroke="#3B2A2A" strokeWidth="2" />
      <path d="M2,3 L20,16 L38,3" stroke="#3B2A2A" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <circle className="seal" cx="20" cy="16" r="5" fill="#E8443A" stroke="#3B2A2A" strokeWidth="1.5" />
    </svg>
  );
}

/** El sorteo solo corre con sesión de organizador y viniendo de la confirmación. */
export function DrawScene({ gid }: { gid: string }) {
  return (
    <AdminGate gid={gid}>
      <ArmedDraw gid={gid} />
    </AdminGate>
  );
}

function ArmedDraw({ gid }: { gid: string }) {
  const [armed] = useState(() => drawGuard.consume(gid));
  const { navigate } = useRouter();
  const { say } = useJose();
  useEffect(() => {
    if (armed) return;
    say({ text: 'El sorteo se hace desde el panel, después de confirmar po. Toca Hacer el sorteo cuando estén toos.', mood: 'thinking' });
    navigate(`/g/${gid}/admin`, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!armed) return <Screen>{null}</Screen>;
  return <DrawSceneInner gid={gid} />;
}

function DrawSceneInner({ gid }: { gid: string }) {
  useScreenMeta({ back: null, hero: true });
  const lock = useAdminLock();
  const { navigate } = useRouter();
  const jose = useJose();
  const { data } = useAdmin(gid);
  const [phase, setPhase] = useState<'running' | 'done' | 'error'>('running');
  const [group, setGroup] = useState<PublicGroup | null>(null);
  const scene = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const people = data?.group.participants ?? [];
  const started = useRef(false);

  // llamada real al sorteo (en paralelo con la animación)
  const drawPromise = useRef<Promise<PublicGroup> | null>(null);
  useEffect(() => {
    if (drawPromise.current) return;
    drawPromise.current = api<{ group: PublicGroup }>('/admin/draw', { method: 'POST', token: tokens.admin(gid) }).then((r) => r.group);
    drawPromise.current
      .then((g) => {
        put(`group:${gid}`, g);
        setGroup(g);
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          lock();
          return;
        }
        tlRef.current?.pause();
        setPhase('error');
        const ctrl = jose.ctrl();
        ctrl?.setHat(true);
        jose.say({
          text: e instanceof ApiError && e.code === 'already_drawn' ? 'Este sorteo ya estaba hecho, loco, no se repite. Toca Volver al panel pa compartir el link.' : joseError(e),
          mood: 'worried',
        });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useGSAP(
    (_ctx, contextSafe) => {
      if (!people.length || started.current) return;
      started.current = true;
      const root = scene.current!;
      const q = gsap.utils.selector(root);
      const avatars = q('.ring-av') as HTMLElement[];
      const papers = q('.paper') as HTMLElement[];
      const envs = q('.env') as HTMLElement[];
      const hats = q('.hat') as HTMLElement[];
      const n = people.length;
      const repeat = seen.has('draw-anim');

      jose.say({ text: 'Ya cabros, junten las manos que viene la magia. Toca la pantalla si querí adelantar.', keepMood: true });

      if (motion.reduced) {
        // versión sobria
        const W = root.clientWidth;
        const sz = Math.max(40, Math.min(64, (W - 40) / Math.min(n, 6)));
        avatars.forEach((a, i) => {
          const cols = Math.min(n, 5);
          gsap.set(a, { x: 16 + (i % cols) * ((W - 32) / cols), y: 20 + Math.floor(i / cols) * (sz + 30), width: sz, height: sz });
        });
        gsap.set(hats, { opacity: 0 });
        gsap.set(avatars, { opacity: 1 });
        const finish = () => {
          envs.forEach((e, i) => {
            const r = avatars[i].getBoundingClientRect();
            const s = root.getBoundingClientRect();
            gsap.set(e, { x: r.right - s.left - 22, y: r.bottom - s.top - 18, opacity: 1 });
          });
          setPhase('done');
          jose.setMood('celebrating');
          jose.say({ text: '¡Listo el pollo! Cada uno ya tiene su sobre sellao. Comparte el link pa que lo abran.', mood: 'celebrating' });
        };
        drawPromise.current?.then(() => gsap.delayedCall(0.6, finish)).catch(() => {});
        return;
      }

      // esperar a que José llegue a su lugar en la escena
      gsap.delayedCall(0.85, () => {
        const ctrl = jose.ctrl();
        if (!ctrl) return;
        const s = root.getBoundingClientRect();
        const toLocal = (p: { x: number; y: number }) => ({ x: p.x - s.left, y: p.y - s.top });
        const W = s.width;
        const unit = ctrl.svgToScreen(1, 0).x - ctrl.svgToScreen(0, 0).x;
        const over = toLocal(ctrl.svgToScreen(100, -46));
        const hatScale = (104 * unit) / 140;
        const openY = over.y;
        // anillo de participantes (arco superior)
        const rows = n > 10 ? 2 : 1;
        const perRow = Math.ceil(n / rows);
        const sz = Math.max(34, Math.min(64, (W * 1.25) / perRow));
        const rx = W / 2 - sz / 2 - 6;
        const ry = Math.max(70, openY - sz / 2 - 18);
        const pos = people.map((_, i) => {
          const row = rows === 2 ? i % 2 : 0;
          const idx = rows === 2 ? Math.floor(i / 2) : i;
          const cnt = rows === 2 ? (row === 0 ? Math.ceil(n / 2) : Math.floor(n / 2)) : n;
          const a = ((198 + (144 * (idx + (row ? 0.5 : 0))) / Math.max(1, cnt - (row ? 0 : 1))) * Math.PI) / 180;
          const k = row ? 0.62 : 1;
          return { x: W / 2 + rx * k * Math.cos(a), y: openY + ry * k * Math.sin(a) };
        });
        avatars.forEach((a, i) => gsap.set(a, { width: sz, height: sz, x: pos[i].x - sz / 2, y: pos[i].y - sz / 2 }));

        const hatRect = ctrl.hatScreenRect();
        const hatStart = toLocal({ x: hatRect.left + hatRect.width / 2, y: hatRect.top + hatRect.height / 2 });
        gsap.set(hats, { transformOrigin: '50% 22%', x: hatStart.x - 70, y: hatStart.y - 33, scale: hatRect.width / 140, rotation: 150, opacity: 0 });
        const opening = { x: over.x, y: openY };

        const tl = gsap.timeline({
          onComplete: contextSafe!(() => {
            seen.mark('draw-anim');
          }),
        });
        tlRef.current = tl;
        if (repeat) tl.timeScale(1.7);

        // 1. entrada de participantes
        tl.set(avatars, { opacity: 1 }, 0);
        tl.fromTo(
          avatars,
          { scale: 0, y: '+=70', rotation: () => gsap.utils.random(-50, 50) },
          { scale: 1, y: '-=70', rotation: 0, duration: 0.7, ease: 'back.out(2.4)', stagger: Math.min(0.07, 0.9 / n) },
          0,
        );
        // 2. anticipación: José se agacha y se saca el gorro
        tl.call(() => ctrl.holdPose('raise', 0.3), [], 0.25);
        tl.to(ctrl.p.root, { scaleY: 0.86, scaleX: 1.1, duration: 0.22, ease: 'power2.in' }, 0.25);
        tl.to(ctrl.p.root, { scaleY: 1.08, scaleX: 0.94, duration: 0.18, ease: 'power2.out' }, 0.47);
        tl.to(ctrl.p.root, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' }, 0.65);
        tl.call(() => {
          ctrl.setHat(false);
          ctrl.holdPose('overhead', 0.5);
        }, [], 0.55);
        tl.set(hats, { opacity: 1 }, 0.55);
        tl.to(hats, { x: opening.x - 70, y: opening.y - 33, scale: hatScale, rotation: 0, duration: 0.7, ease: 'back.out(1.7)' }, 0.55);

        // 3. papelitos vuelan al gorro
        const pStag = Math.min(0.09, 1.2 / n);
        papers.forEach((p, i) => {
          const from = pos[i];
          const t0 = 1.25 + i * pStag;
          tl.set(p, { x: from.x - 11, y: from.y - 8, scale: 0, opacity: 1, rotation: 0, zIndex: 7 }, t0 - 0.01);
          tl.to(p, { scale: 1, duration: 0.2, ease: 'back.out(3)' }, t0);
          tl.to(
            p,
            {
              motionPath: {
                path: [
                  { x: (from.x + opening.x) / 2 - 11, y: Math.min(from.y, opening.y) - 70 },
                  { x: opening.x - 11 + gsap.utils.random(-14, 14), y: opening.y + 4 },
                ],
                curviness: 1.3,
              },
              rotation: gsap.utils.random(360, 720) * (Math.random() < 0.5 ? -1 : 1),
              duration: 0.7,
              ease: 'power2.in',
            },
            t0 + 0.15,
          );
          tl.set(p, { zIndex: 3 }, t0 + 0.6);
          tl.to(p, { scale: 0.5, opacity: 0, duration: 0.12 }, t0 + 0.82);
          tl.to(hats, { scaleY: hatScale * 0.9, scaleX: hatScale * 1.06, duration: 0.07, ease: 'power2.out' }, t0 + 0.84);
          tl.to(hats, { scaleY: hatScale, scaleX: hatScale, duration: 0.45, ease: 'elastic.out(1.2,0.35)' }, t0 + 0.91);
        });
        const mixAt = 1.25 + n * pStag + 0.95;

        // 4. mezcla con física: el gorro se agita y los papelitos saltan
        tl.call(() => {
          ctrl.react('flare');
          ctrl.face('grin', 0);
        }, [], mixAt);
        tl.to(hats, { rotation: 16, duration: 2.2, ease: 'shakeUp' }, mixAt);
        tl.to(hats, { x: `+=${8}`, duration: 2.2, ease: 'jitter' }, mixAt);
        tl.to(ctrl.p.root, { rotation: 5, duration: 2.2, ease: 'shakeUp', svgOrigin: '100 244' }, mixAt);
        const jumpers = papers.slice(0, Math.min(papers.length, 10));
        for (let k = 0; k < 14; k++) {
          const p = jumpers[k % jumpers.length];
          const t = mixAt + 0.1 + k * 0.14;
          tl.set(p, { x: opening.x - 11, y: opening.y, opacity: 1, scale: 0.9, zIndex: 3, rotation: gsap.utils.random(0, 360) }, t);
          tl.to(p, { physics2D: { velocity: gsap.utils.random(260, 420), angle: gsap.utils.random(-125, -55), gravity: 1500 }, rotation: '+=540', duration: 0.5, ease: 'none' }, t);
          tl.set(p, { opacity: 0 }, t + 0.5);
        }
        for (let k = 0; k < 16; k++) {
          tl.call(() => jose.puff(opening.x + s.left + gsap.utils.random(-50, 50) * unit, opening.y + s.top + gsap.utils.random(-10, 10), { size: 34, rise: 90, life: 1.6 }), [], mixAt + k * 0.13);
        }

        // 5. pausa de anticipación (cámara lenta)
        const pauseAt = mixAt + 2.25;
        const floaters = papers.slice(0, Math.min(5, papers.length));
        tl.to(hats, { rotation: 0, duration: 0.5, ease: 'elastic.out(1,0.3)' }, pauseAt);
        tl.to(ctrl.p.root, { rotation: 0, duration: 0.4 }, pauseAt);
        floaters.forEach((p, i) => {
          tl.set(p, { x: opening.x - 11 + (i - 2) * 26 * unit * 1.4, y: opening.y - 30, opacity: 0, scale: 0.5, rotation: gsap.utils.random(-30, 30), zIndex: 7 }, pauseAt);
          tl.to(p, { opacity: 1, scale: 1, y: `-=${30 + (i % 2) * 18}`, duration: 0.9, ease: 'sine.out' }, pauseAt + i * 0.05);
        });
        tl.to(q('.scene-inner'), { scale: 1.06, duration: 0.95, ease: 'sine.inOut' }, pauseAt);
        tl.to(ctrl.p.glow, { scale: 2, duration: 0.2, yoyo: true, repeat: 3, ease: 'power2.inOut' }, pauseAt);
        tl.call(() => ctrl.lookAt(opening.x + s.left, opening.y + s.top - 40, true), [], pauseAt);

        // 6. clímax: squash & stretch y salen los sobres
        const boomAt = pauseAt + 1.0;
        tl.to(q('.scene-inner'), { scale: 1, duration: 0.6, ease: 'back.out(2)' }, boomAt);
        tl.to(hats, { scaleY: hatScale * 0.7, scaleX: hatScale * 1.22, duration: 0.15, ease: 'power2.in' }, boomAt);
        tl.to(hats, { scaleY: hatScale * 1.25, scaleX: hatScale * 0.84, duration: 0.12, ease: 'power2.out' }, boomAt + 0.15);
        tl.to(hats, { scaleY: hatScale, scaleX: hatScale, duration: 0.6, ease: 'elastic.out(1.2,0.3)' }, boomAt + 0.27);
        tl.to(floaters, { scale: 0, opacity: 0, rotation: '+=180', duration: 0.25, ease: 'back.in(2)' }, boomAt);
        const eStag = Math.min(0.07, 0.9 / n);
        envs.forEach((e, i) => {
          const to = pos[i];
          const t = boomAt + 0.2 + i * eStag;
          tl.set(e, { x: opening.x - 16, y: opening.y - 12, scale: 0.3, opacity: 1, rotation: 0 }, t);
          tl.to(
            e,
            {
              motionPath: {
                path: [
                  { x: (opening.x + to.x) / 2 - 16, y: Math.min(opening.y, to.y) - 90 },
                  { x: to.x + sz * 0.22 - 16, y: to.y + sz * 0.2 - 12 },
                ],
                curviness: 1.4,
              },
              rotation: gsap.utils.random(-540, 540),
              scale: 1,
              duration: 0.75,
              ease: 'power2.out',
            },
            t,
          );
          tl.to(e, { rotation: gsap.utils.random(-14, 14), duration: 0.5, ease: 'elastic.out(1,0.4)' }, t + 0.75);
          tl.fromTo(avatars[i], { scaleY: 1 }, { scaleY: 0.8, scaleX: 1.12, duration: 0.08, yoyo: true, repeat: 1, immediateRender: false }, t + 0.72);
        });
        const closeAt = boomAt + 0.2 + n * eStag + 0.7;
        // 7. cierre: confeti, José celebra y el gorro vuelve a su cabeza
        tl.call(() => confetti(opening.x + s.left, opening.y + s.top, { count: 90 }), [], boomAt + 0.2);
        tl.call(() => jose.setMood('celebrating'), [], boomAt + 0.3);
        tl.to(q('.env .seal'), { scale: 1.4, svgOrigin: '20 16', duration: 0.3, yoyo: true, repeat: 3, stagger: 0.02 }, closeAt);
        tl.to(hats, { x: hatStart.x - 70, y: hatStart.y - 33, scale: hatRect.width / 140, rotation: 150, duration: 0.6, ease: 'back.in(1.4)' }, closeAt);
        tl.set(hats, { opacity: 0 }, closeAt + 0.6);
        tl.call(() => ctrl.setHat(true), [], closeAt + 0.58);
        tl.call(
          contextSafe!(() => {
            drawPromise.current
              ?.then(() => {
                setPhase('done');
                jose.say({ text: '¡Listo el pollo! Cada uno ya tiene su sobre sellao. Comparte el link pa que lo abran.', mood: 'celebrating' });
              })
              .catch(() => {});
          }),
          [],
          closeAt + 0.7,
        );
      });
    },
    { scope: scene, dependencies: [people.length] },
  );

  // tocar para adelantar
  const skip = () => {
    const tl = tlRef.current;
    if (tl && tl.isActive() && tl.timeScale() < 5) {
      tl.timeScale(6);
      jose.say({ text: 'Ya po, rapidito entonces.', keepMood: true });
    }
  };

  return (
    <Screen
      className="scene-screen"
      cta={
        phase === 'running' ? null : phase === 'done' && group ? (
          <>
            <Btn onClick={() => shareWhatsApp(group)}>Compartir por WhatsApp</Btn>
            <button className="link-btn small" onClick={() => navigate(`/g/${gid}/admin`)}>
              Volver al panel
            </button>
          </>
        ) : (
          <Btn onClick={() => navigate(`/g/${gid}/admin`)}>Volver al panel</Btn>
        )
      }
    >
      <div className="scene" ref={scene} onClick={skip} aria-label="Animación del sorteo" role="img">
        <div className="scene-inner">
          {people.map((p) => (
            <div key={p.id} className="ring-av">
              <Avatar seed={p.avatar} size={64} alive={false} />
              <span className="ring-name">{p.name}</span>
            </div>
          ))}
          <HatBack />
          {people.map((p) => (
            <div key={p.id} className="paper" />
          ))}
          <HatFront />
          {people.map((p) => (
            <div key={p.id} className="env">
              <Envelope />
            </div>
          ))}
        </div>
        <JoseSlot className="scene-jose" />
      </div>
    </Screen>
  );
}

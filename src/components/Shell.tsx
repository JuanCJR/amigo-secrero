import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { gsap, motion } from '../lib/gsap';
import { useRouter } from '../lib/router';
import { Bubble } from '../jose/Bubble';
import { JoseSlot, useJose } from '../jose/JoseProvider';
import { isVoiceOn, onVoiceChange, setVoiceOn, speak, voiceSupported } from '../jose/voice';

function VoiceToggle() {
  const [on, setOn] = useState(isVoiceOn);
  const { msg } = useJose();
  useEffect(() => onVoiceChange(() => setOn(isVoiceOn())), []);
  if (!voiceSupported) return null;
  const toggle = () => {
    const next = !on;
    setVoiceOn(next);
    if (next && msg) speak(msg.text);
  };
  return (
    <button className="voice-btn" onClick={toggle} aria-pressed={on} aria-label={on ? 'Silenciar a José Miguel' : 'Activar la voz de José Miguel'}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        {on ? (
          <path d="M16.5 8.5 Q19 12 16.5 15.5 M19 6 Q23 12 19 18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M16.5 9.5 L21.5 14.5 M21.5 9.5 L16.5 14.5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

interface Meta {
  back?: string | null;
  backLabel?: string;
  step?: number;
  steps?: number;
  hero?: boolean;
}
const MetaCtx = createContext<(m: Meta) => void>(() => {});

/** Cada pantalla declara a dónde vuelve y en qué paso va. */
export function useScreenMeta(m: Meta) {
  const set = useContext(MetaCtx);
  const key = JSON.stringify(m);
  useLayoutEffect(() => set(m), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Stepper({ step, steps }: { step: number; steps: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const fills = ref.current.querySelectorAll<HTMLElement>('.step-fill');
    fills.forEach((f, i) => {
      const on = i < step;
      gsap.to(f, { scaleX: on ? 1 : 0, duration: motion.reduced ? 0 : 0.7, ease: 'elastic.out(1,0.6)', delay: i === step - 1 ? 0.2 : 0 });
    });
    const cur = ref.current.children[step - 1];
    if (cur && !motion.reduced) gsap.fromTo(cur, { scaleY: 1.8 }, { scaleY: 1, duration: 0.6, ease: 'elastic.out(1,0.4)', delay: 0.2 });
  }, [step, steps]);
  return (
    <div className="stepper" ref={ref} role="progressbar" aria-valuemin={1} aria-valuemax={steps} aria-valuenow={step} aria-label={`Paso ${step} de ${steps}`}>
      {Array.from({ length: steps }, (_, i) => (
        <div className="step" key={i}>
          <div className="step-fill" />
        </div>
      ))}
      <span className="step-label">
        Paso {step} de {steps}
      </span>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta>({});
  const { navigate } = useRouter();
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (backRef.current && !motion.reduced) gsap.fromTo(backRef.current, { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.5)' });
  }, [meta.back]);

  return (
    <MetaCtx.Provider value={setMeta}>
      <div className={`app ${meta.hero ? 'is-hero' : ''}`}>
        <header className="topbar">
          {meta.back ? (
            <button ref={backRef} className="back-btn" onClick={() => navigate(meta.back!)} aria-label={meta.backLabel || 'Volver atrás'}>
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                <path d="M15 5 L8 12 L15 19" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Volver</span>
            </button>
          ) : (
            <span className="back-spacer" />
          )}
          {meta.steps ? <Stepper step={meta.step || 1} steps={meta.steps} /> : <span className="topbar-fill" />}
          <VoiceToggle />
        </header>
        <section className="band">
          {!meta.hero && <JoseSlot className="band-slot" />}
          <Bubble />
        </section>
        {children}
      </div>
    </MetaCtx.Provider>
  );
}

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { gsap, motion } from '../lib/gsap';

export interface PinHandle {
  shake: () => void;
  success: () => Promise<void>;
  clear: () => void;
  focus: () => void;
}

/** 4 casillas grandes; cada número "salta" al escribirse. */
export const PinInput = forwardRef<PinHandle, { value: string; onChange: (v: string) => void; onDone?: (v: string) => void; label: string; autoFocus?: boolean }>(
  function PinInput({ value, onChange, onDone, label, autoFocus }, ref) {
    const boxes = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => ({
      shake() {
        if (motion.reduced) return;
        gsap.fromTo(boxes.current, { x: 0 }, { x: 14, duration: 0.6, ease: 'shake', clearProps: 'x' });
        gsap.fromTo(boxes.current!.children, { rotation: 0 }, { rotation: () => gsap.utils.random(-12, 12), duration: 0.5, ease: 'shake', stagger: 0.03 });
      },
      success() {
        return new Promise((res) => {
          if (motion.reduced) return res();
          gsap
            .timeline({ onComplete: () => res() })
            .to(boxes.current!.children, { y: -18, scaleY: 1.15, scaleX: 0.9, duration: 0.2, ease: 'power2.out', stagger: 0.07 })
            .to(boxes.current!.children, { y: 0, scaleY: 1, scaleX: 1, duration: 0.6, ease: 'bounce.out', stagger: 0.07 }, 0.2);
        });
      },
      clear() {
        onChange('');
        input.current?.focus();
      },
      focus() {
        input.current?.focus();
      },
    }));
    return (
      <label className="pin" onClick={() => input.current?.focus()}>
        <span className="sr-only">{label}</span>
        <input
          ref={input}
          className="pin-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
            const prev = value.length;
            onChange(v);
            if (v.length > prev && !motion.reduced) {
              const box = boxes.current?.children[v.length - 1];
              if (box)
              gsap.fromTo(box, { scale: 1.3, rotation: gsap.utils.random(-10, 10) }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' });
            }
            if (v.length === 4) onDone?.(v);
          }}
        />
        <div className="pin-boxes" ref={boxes} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`pin-box ${i < value.length ? 'is-filled' : ''} ${i === value.length ? 'is-current' : ''}`}>
              {i < value.length ? <span className="pin-dot" /> : null}
            </div>
          ))}
        </div>
      </label>
    );
  },
);

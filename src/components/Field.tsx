import { forwardRef, useRef, type InputHTMLAttributes } from 'react';
import { gsap, motion } from '../lib/gsap';

/** Input que responde: crece al enfocar y "late" con cada tecla. */
export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }>(function Field(
  { label, hint, className, onFocus, onBlur, onChange, ...rest },
  ref,
) {
  const wrap = useRef<HTMLLabelElement>(null);
  return (
    <label className={`field ${className ?? ''}`} ref={wrap} data-anim="pop">
      <span className="field-label">{label}</span>
      <input
        ref={ref}
        className="field-input"
        onFocus={(e) => {
          if (!motion.reduced) gsap.to(wrap.current, { scale: 1.025, duration: 0.5, ease: 'elastic.out(1,0.5)' });
          onFocus?.(e);
        }}
        onBlur={(e) => {
          if (!motion.reduced) gsap.to(wrap.current, { scale: 1, duration: 0.3 });
          onBlur?.(e);
        }}
        onChange={(e) => {
          if (!motion.reduced)
            gsap.fromTo(wrap.current!.querySelector('.field-label'), { y: -3 }, { y: 0, duration: 0.4, ease: 'elastic.out(1,0.3)' });
          onChange?.(e);
        }}
        {...rest}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
});

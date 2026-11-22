import { describe, expect, it } from 'vitest';
import { drawCycle } from './draw';

describe('drawCycle', () => {
  it('nadie se saca a sí mismo y es una biyección, en 2000 sorteos', () => {
    for (let n = 3; n <= 14; n++) {
      const ids = Array.from({ length: n }, (_, i) => i + 1);
      for (let k = 0; k < 150; k++) {
        const m = drawCycle(ids);
        expect(m.size).toBe(n);
        const receivers = new Set<number>();
        for (const [g, r] of m) {
          expect(g).not.toBe(r);
          receivers.add(r);
        }
        expect(receivers.size).toBe(n);
      }
    }
  });
  it('es un solo ciclo (nadie queda en parejas cerradas)', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (let k = 0; k < 200; k++) {
      const m = drawCycle(ids);
      let cur = 1;
      let steps = 0;
      do { cur = m.get(cur)!; steps++; } while (cur !== 1);
      expect(steps).toBe(ids.length);
    }
  });
  it('rechaza menos de 2 personas', () => {
    expect(() => drawCycle([1])).toThrow();
  });
});

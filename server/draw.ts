/**
 * Sorteo: algoritmo de Sattolo → un único ciclo aleatorio.
 * Garantiza que nadie se saque a sí mismo y que cada persona
 * sea sacada exactamente por una persona.
 */
export function drawCycle(ids: number[], rnd: () => number = Math.random): Map<number, number> {
  if (ids.length < 2) throw new Error('Se necesitan al menos 2 personas');
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * i); // j < i  (Sattolo)
    [order[i], order[j]] = [order[j], order[i]];
  }
  const result = new Map<number, number>();
  order.forEach((giver, i) => result.set(giver, order[(i + 1) % order.length]));
  return result;
}

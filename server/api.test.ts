import { describe, expect, it } from 'vitest';
process.env.DB_FILE = ':memory:';
process.env.VITEST = '1';
const { app } = await import('./index');

const j = (path: string, method = 'GET', body?: unknown, token?: string) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('privacidad del sorteo', () => {
  it('el organizador no ve resultados y cada quien ve solo el suyo', async () => {
    const st = await (await j('/api/state')).json();
    const ids: number[] = st.participants.map((p: any) => p.id);
    expect(ids.length).toBe(11);

    const tokens: Record<number, string> = {};
    for (const id of ids) {
      const r = await j('/api/claim', 'POST', { participantId: id, pin: '1234' });
      expect(r.status).toBe(200);
      tokens[id] = (await r.json()).token;
    }
    // un nombre ya tomado no se puede reclamar
    expect((await j('/api/claim', 'POST', { participantId: ids[0], pin: '9999' })).status).toBe(409);
    // clave mala
    expect((await j('/api/login', 'POST', { participantId: ids[0], pin: '0000' })).status).toBe(401);

    const a = await (await j('/api/admin/setup', 'POST', { pin: '123456' })).json();
    expect((await j('/api/reveal', undefined, undefined, a.token)).status).toBe(401); // admin no es participante
    expect((await j('/api/reveal', undefined, undefined, tokens[ids[0]])).status).toBe(409); // aún sin sorteo

    const d = await j('/api/admin/draw', 'POST', undefined, a.token);
    expect(d.status).toBe(200);
    expect(JSON.stringify(await d.json())).not.toMatch(/receiver|assign/i);
    expect((await j('/api/admin/draw', 'POST', undefined, a.token)).status).toBe(409); // irreversible

    const seen = new Set<number>();
    for (const id of ids) {
      const r = await (await j('/api/reveal', undefined, undefined, tokens[id])).json();
      expect(r.receiver.id).not.toBe(id);
      seen.add(r.receiver.id);
    }
    expect(seen.size).toBe(ids.length);
  });
});

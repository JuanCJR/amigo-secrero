import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, fmtDate, fmtMoney, flag, tokens, type Overview } from '../api';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { Keypad } from '../components/Keypad';
import { Tombola, type TombolaHandle } from '../components/Tombola';
import { MascotSlot, mk, type Msg } from '../mascot/Guide';
import { jm } from '../mascot/controller';
import { gsap, prefersReduced } from '../anim/gsap';

const TOTAL = 5;
type OR = 'boot' | 'login' | 'config' | 'people' | 'invite' | 'draw';
const useMsg = (first: Msg) => {
  const [m, setM] = useState(first);
  return [m, (t: string, k?: Msg['kind']) => setM(mk(t, k))] as const;
};
const A = { as: 'a' as const };
const link = () => (import.meta.env.VITE_DEMO ? location.href.split('#')[0] : location.origin);
const wa = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function OrganizerApp() {
  const [route, setRoute] = useState<OR>('boot');
  const [ov, setOv] = useState<Overview | null>(null);
  const stack = useRef<OR[]>([]);
  const [setup, setSetup] = useState(false);

  const go = (r: OR, replace = false) => {
    if (replace) stack.current[stack.current.length - 1] = r; else stack.current.push(r);
    setRoute(r);
  };
  const back = () => { if (stack.current.length > 1) { stack.current.pop(); setRoute(stack.current[stack.current.length - 1]); } };
  const reload = useCallback(async () => {
    try { const o = await api<Overview>('/admin/overview', A); setOv(o); return o; }
    catch (e) { if ((e as ApiError).status === 401) { tokens.set('a', null); stack.current = ['login']; setRoute('login'); } return null; }
  }, []);

  useEffect(() => {
    (async () => {
      const st = await api<{ organizerReady: boolean }>('/state').catch(() => ({ organizerReady: true }));
      setSetup(!st.organizerReady);
      let first: OR = 'login';
      if (tokens.get('a')) { const o = await reload(); if (o) first = o.state.drawn ? 'draw' : 'config'; }
      stack.current = [first]; setRoute(first);
    })();
  }, [reload]);

  if (route === 'boot') return <Screen step={0} total={TOTAL} label="Cargando" msg={mk('Un momentito, estoy prendiendo las luces…')} base="think" />;
  if (route === 'login') return <Login setup={setup} onDone={async () => { const o = await reload(); stack.current = []; go(o?.state.drawn ? 'draw' : 'config'); }} />;
  if (!ov) return <Screen step={0} total={TOTAL} label="Cargando" msg={mk('Un momentito…')} base="think" />;
  const props = { ov, setOv, reload, go, back };
  return route === 'config' ? <Config {...props} />
    : route === 'people' ? <People {...props} />
    : route === 'invite' ? <Invite {...props} />
    : <Draw {...props} />;
}
interface P { ov: Overview; setOv: (o: Overview) => void; reload: () => Promise<Overview | null>; go: (r: OR) => void; back: () => void }

/* ───────── 1) Clave de organizador ───────── */
function Login({ setup, onDone }: { setup: boolean; onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useMsg(mk(setup
    ? 'Hola, organizador. Crea una clave de 6 números: con ella solo tú podrás sortear.'
    : 'Hola, organizador. Escribe tu clave de 6 números para entrar.'));
  const bad = (t: string) => { setMsg(t, 'error'); setShake((s) => s + 1); setPin(''); };

  const submit = async () => {
    if (pin.length !== 6 || busy) return;
    if (setup && first === null) { setFirst(pin); setPin(''); setMsg('Perfecto. Escríbela otra vez para confirmar.'); return; }
    if (setup && first !== pin) { setFirst(null); bad('Mmm, no coinciden. Tranqui, empecemos de nuevo.'); return; }
    setBusy(true);
    try {
      const r = await api<{ token: string }>(setup ? '/admin/setup' : '/admin/login', { body: { pin } });
      tokens.set('a', r.token);
      setOk(true); setMsg('¡Listo! Ya eres el organizador.', 'success');
      await new Promise((res) => setTimeout(res, prefersReduced() ? 300 : 1000));
      onDone();
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'wrong_pin') bad(`Esa clave no coincide, pero no pasa nada. Prueba otra vez, te ${Number(err.data.left) === 1 ? 'queda 1 intento' : `quedan ${err.data.left} intentos`}.`);
      else if (err.code === 'locked') bad(`Demasiados intentos. Espera ${err.data.wait} segundos y vuelve a probar.`);
      else if (err.code === 'already_setup') { bad('Ya hay un organizador. Escribe su clave para entrar.'); }
      else bad('Se cortó la conexión. Revisa tu internet y toca el botón otra vez.');
    } finally { setBusy(false); }
  };
  return (
    <Screen step={1} total={TOTAL} label="Tu clave" msg={msg} base={ok ? 'celebrate' : 'idle'}
      onBack={first !== null ? () => { setFirst(null); setPin(''); } : undefined}
      footer={<Button pulse={pin.length === 6} disabled={pin.length !== 6} busy={busy} onClick={submit}>{setup ? (first === null ? 'Siguiente' : 'Crear mi clave') : 'Entrar'}</Button>}>
      <Keypad value={pin} length={6} onChange={setPin} shake={shake} ok={ok} />
    </Screen>
  );
}

/* ───────── 2) Fecha y monto ───────── */
function Config({ ov, setOv, go, back }: P) {
  const [date, setDate] = useState(ov.state.giftDate ?? '');
  const [amount, setAmount] = useState(ov.state.giftAmount ? String(ov.state.giftAmount) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useMsg(mk('Elige el día del intercambio y cuánto es el regalo. Todos lo verán en la app.'));
  const drawn = ov.state.drawn;
  const presets = [10000, 15000, 20000, 25000, 30000];
  const today = new Date().toISOString().slice(0, 10);

  const save = async () => {
    const n = Number(amount.replace(/\D/g, ''));
    if (!date) { setMsg('Falta el día. Toca la fecha, elige el día del intercambio y yo lo recuerdo.', 'error'); gsap.fromTo('#cfg-date', { x: 0 }, { x: 14, duration: 0.7, ease: 'jmShake' }); return; }
    if (!n || n < 500) { setMsg('Falta el monto. Toca uno de los botones o escribe cuánto es el regalo.', 'error'); gsap.fromTo('#cfg-amount', { x: 0 }, { x: 14, duration: 0.7, ease: 'jmShake' }); return; }
    setBusy(true);
    try {
      const o = await api<Overview>('/admin/settings', { ...A, method: 'PUT', body: { giftDate: date, giftAmount: n } });
      setOv(o); setMsg(`Anotado: ${fmtDate(date)}, regalo de hasta ${fmtMoney(n)}.`, 'success');
      await new Promise((r) => setTimeout(r, prefersReduced() ? 200 : 900));
      go('people');
    } catch { setMsg('No pude guardar. Revisa tu internet y toca «Guardar» otra vez.', 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Screen step={2} total={TOTAL} label="Fecha y monto" msg={msg} base="point" onBack={drawn ? undefined : back}
      footer={<Button pulse busy={busy} onClick={save}>Guardar y seguir</Button>}>
      <div className="card" data-pop>
        <label className="field-label" htmlFor="cfg-date">¿Qué día es el intercambio?</label>
        <div className="field" id="cfg-date-wrap">
          <input id="cfg-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {date && <p className="field-help">{fmtDate(date)}</p>}
      </div>
      <div className="card" data-pop>
        <label className="field-label" htmlFor="cfg-amount">¿Cuánto es el regalo (como máximo)?</label>
        <div className="chips">
          {presets.map((p) => (
            <button key={p} className={`chip ${Number(amount) === p ? 'chip--on' : ''}`}
              onClick={(e) => { setAmount(String(p)); if (!prefersReduced()) gsap.fromTo(e.currentTarget, { scale: 0.8 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1.4,.4)' }); }}>
              {fmtMoney(p)}
            </button>
          ))}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <input id="cfg-amount" inputMode="numeric" placeholder="Otro monto, por ejemplo 18000"
            value={amount ? Number(amount.replace(/\D/g, '')).toLocaleString('es-CL') : ''}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>
    </Screen>
  );
}

/* ───────── 3) Personas ───────── */
function People({ ov, setOv, go, back }: P) {
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<{ id: number; v: string } | null>(null);
  const [del, setDel] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const n = ov.overview.length;
  const drawn = ov.state.drawn;
  const [msg, setMsg] = useMsg(mk(`Esta es la lista de ${n} personas. Agrega, cambia o quita nombres y toca «Seguir».`));
  const guard = (e: unknown) => {
    const c = (e as ApiError).code;
    setMsg(c === 'duplicate' ? 'Ese nombre ya está en la lista. Agrégalo con otra letra, por ejemplo «Ana R».'
      : c === 'already_drawn' ? 'Ya se hizo el sorteo, así que la lista quedó fija.'
      : c === 'bad_name' ? 'Escribe un nombre para agregarlo a la lista.'
      : 'No pude hacerlo. Revisa tu internet y prueba otra vez.', 'error');
  };
  const add = async () => {
    if (!name.trim()) { guard({ code: 'bad_name' }); return; }
    setBusy(true);
    try { const o = await api<Overview>('/admin/participants', { ...A, body: { name } }); setOv(o); setName(''); setMsg(`¡${name.trim()} ya está en la lista!`, 'success'); }
    catch (e) { guard(e); } finally { setBusy(false); }
  };
  const rename = async () => {
    if (!edit) return;
    try { const o = await api<Overview>(`/admin/participants/${edit.id}`, { ...A, method: 'PATCH', body: { name: edit.v } }); setOv(o); setEdit(null); setMsg('Nombre cambiado.'); }
    catch (e) { guard(e); }
  };
  const remove = async () => {
    if (!del) return;
    try { const o = await api<Overview>(`/admin/participants/${del.id}`, { ...A, method: 'DELETE' }); setOv(o); setMsg(`Quité a ${del.name} de la lista.`); }
    catch (e) { guard(e); } finally { setDel(null); }
  };
  return (
    <Screen step={3} total={TOTAL} label="Personas" msg={msg} base="idle" onBack={back}
      footer={del ? (
        <div className="row-btns">
          <Button variant="ghost" onClick={() => { setDel(null); setMsg('Tranqui, lo dejé en la lista.'); }}>No, dejarlo</Button>
          <Button variant="danger" onClick={remove}>Sí, quitar</Button>
        </div>
      ) : <Button pulse disabled={n < 3} onClick={() => go('invite')}>{n < 3 ? 'Faltan personas (mínimo 3)' : 'Seguir'}</Button>}>
      <div className="people">
        {ov.overview.map((p) => (
          <div className="card person-row" key={p.id} data-pop>
            <Avatar p={p} size={46} />
            {edit?.id === p.id ? (
              <div className="field field--inline"><input autoFocus value={edit.v} maxLength={30} onChange={(e) => setEdit({ id: p.id, v: e.target.value })} aria-label={`Nuevo nombre para ${p.name}`} onKeyDown={(e) => e.key === 'Enter' && rename()} /></div>
            ) : <span className="person-name">{p.name}</span>}
            {!drawn && (edit?.id === p.id ? (
              <button className="mini-btn mini-btn--ok" onClick={rename} aria-label="Guardar el nombre"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-10" /></svg></button>
            ) : (
              <>
                <button className="mini-btn" onClick={() => setEdit({ id: p.id, v: p.name })} aria-label={`Cambiar el nombre de ${p.name}`}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" /></svg></button>
                <button className="mini-btn mini-btn--danger" onClick={() => { setDel({ id: p.id, name: p.name }); setMsg(`¿Quito a ${p.name} de la lista? Si ya entró, perderá su clave y sus ideas.`); }} aria-label={`Quitar a ${p.name}`}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg></button>
              </>
            ))}
          </div>
        ))}
        {!drawn && (
          <div className="card add-row" data-pop>
            <div className="field"><input value={name} maxLength={30} placeholder="Agregar a otra persona" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Nombre de la nueva persona" /></div>
            <Button variant="ghost" busy={busy} onClick={add}>Agregar</Button>
          </div>
        )}
      </div>
    </Screen>
  );
}

/* ───────── 4) Invitar y seguimiento ───────── */
function Invite({ ov, setOv, reload, go, back }: P) {
  const [reset, setReset] = useState<{ id: number; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const entered = ov.overview.filter((p) => p.claimed).length;
  const [msg, setMsg] = useMsg(mk('Pega este link en el grupo. Aquí abajo ves quién ya entró.'));
  const invite = `¡Amigo secreto! Entra aquí para elegir tu nombre y anotar ideas de regalo: ${link()}`;

  useEffect(() => { const t = setInterval(reload, 7000); return () => clearInterval(t); }, [reload]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link()); setCopied(true); setMsg('¡Copiado! Pégalo en el grupo de WhatsApp.', 'success'); setTimeout(() => setCopied(false), 2500); }
    catch { setMsg('No pude copiar solo. Mantén el dedo sobre el link y elige «Copiar».', 'error'); }
  };
  const doReset = async () => {
    if (!reset) return;
    try { const o = await api<Overview>(`/admin/participants/${reset.id}/reset-pin`, { ...A, body: {} }); setOv(o); setMsg(`Listo: ${reset.name} puede crear una clave nueva. Quedó anotado a la vista de todos.`); }
    catch { setMsg('No pude reiniciarla. Revisa tu internet y prueba otra vez.', 'error'); }
    finally { setReset(null); }
  };
  return (
    <Screen step={4} total={TOTAL} label="Invitar" msg={msg} base="point" onBack={back}
      footer={reset ? (
        <div className="row-btns">
          <Button variant="ghost" onClick={() => { setReset(null); setMsg('Tranqui, no toqué nada.'); }}>No, dejarla</Button>
          <Button variant="danger" onClick={doReset}>Sí, reiniciar</Button>
        </div>
      ) : <Button pulse onClick={() => go('draw')}>Seguir al sorteo</Button>}>
      <div className="card" data-pop>
        <label className="field-label">El link para todos</label>
        <div className="link-box">{link()}</div>
        <div className="row-btns" style={{ marginTop: 12 }}>
          <a className="btn btn--primary btn-link" href={wa(invite)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <Button variant="ghost" onClick={copy}>{copied ? '¡Copiado!' : 'Copiar link'}</Button>
        </div>
      </div>
      <div className="card" data-pop>
        <label className="field-label">Ya entraron {entered} de {ov.overview.length}</label>
        {ov.overview.map((p) => (
          <div className="prog-row" key={p.id}>
            <Avatar p={p} size={40} lit={p.claimed} />
            <div className="prog-text"><strong>{p.name}</strong><small>{p.claimed ? `Entró · ${p.wishCount} ${p.wishCount === 1 ? 'idea' : 'ideas'}` : 'Aún no entra'}</small></div>
            {p.claimed && <button className="mini-btn" onClick={() => { setReset({ id: p.id, name: p.name }); setMsg(`¿Reinicio la clave de ${p.name}? Solo si la olvidó; quedará anotado a la vista de todos.`); }} aria-label={`Reiniciar la clave de ${p.name}`}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" /></svg></button>}
          </div>
        ))}
      </div>
    </Screen>
  );
}

/* ───────── 5) El sorteo ───────── */
function Draw({ ov, setOv, go, back }: P) {
  const drawn = ov.state.drawn;
  const tomb = useRef<TombolaHandle>(null);
  const chips = useRef(new Map<number, HTMLElement>());
  const [phase, setPhase] = useState<'ready' | 'confirm' | 'playing' | 'done'>(drawn ? 'done' : 'ready');
  const [landed, setLanded] = useState<Set<number>>(() => new Set(drawn ? ov.overview.map((p) => p.id) : []));
  const missing = ov.overview.filter((p) => !p.claimed).length;
  const [msg, setMsg] = useMsg(mk(drawn
    ? 'El sorteo ya está hecho y nadie, ni yo, sabe quién le tocó. Avísales que entren a descubrirlo.'
    : 'Cuando estén todos, toca «Sortear». Ojo: no tiene vuelta atrás.'));
  const people = useMemo(() => ov.overview.map((p) => ({ id: p.id, name: p.name, color: p.color, lit: true })), [ov.overview]);
  const byId = (id: number) => ov.overview.find((p) => p.id === id)!;

  const onLand = (id: number) => {
    setLanded((s) => new Set(s).add(id));
    const el = chips.current.get(id)?.closest('.roster-chip');
    const nameEl = el?.querySelector('.chip-name');
    if (nameEl && !prefersReduced()) {
      gsap.to(nameEl, { duration: 0.7, ease: 'none', scrambleText: { text: byId(id).name, chars: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', speed: 0.7, revealDelay: 0.15 } });
      gsap.fromTo(el!, { scale: 0.8 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1.4,.35)' });
    }
  };

  const start = async (replay = false) => {
    setPhase('playing');
    setMsg('¡Agárrense, que giro la tómbola! Toca la pantalla para saltar la animación.');
    if (!replay) {
      try { const r = await api<Overview & { ok: boolean }>('/admin/draw', { ...A, body: {} }); setOv({ state: r.state, overview: r.overview }); }
      catch (e) {
        const c = (e as ApiError).code;
        setPhase('ready');
        setMsg(c === 'too_few' ? 'Necesito al menos 3 personas para sortear. Vuelve y agrega más.' : c === 'already_drawn' ? 'El sorteo ya estaba hecho. No hace falta repetirlo.' : 'No pude hacer el sorteo. Revisa tu internet y toca «Sortear» otra vez.', 'error');
        return;
      }
    }
    setLanded(new Set());
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const speed = replay || flag.get('draw_seen') ? 2.2 : 1;
    const res = await tomb.current!.play({
      chips: chips.current, speed, onLand,
      onPhase: (ph) => {
        if (ph === 'spin') setMsg('¡Mezclando, mezclando!');
        if (ph === 'hush') setMsg('Shhh… yo no miro.');
        if (ph === 'pop') setMsg('¡Ahí van los nombres!');
      },
    });
    flag.set('draw_seen');
    setPhase('done');
    setMsg(res === 'skipped'
      ? 'Listo, saltamos la animación. El sorteo está hecho y nadie sabe quién le tocó.'
      : '¡Listo! El sorteo está hecho y nadie, ni yo, sabe quién le tocó. Avísales que entren a descubrirlo.', 'success');
    jm.flash('celebrate', 2500);
  };
  const skip = () => { if (phase === 'playing') tomb.current?.skip(); };

  return (
    <Screen step={5} total={TOTAL} label="El sorteo" msg={msg} base="idle" bubbleOnly onBack={phase === 'playing' ? undefined : back}
      footer={phase === 'ready' ? (
        <Button pulse onClick={() => { setPhase('confirm'); setMsg(`¿Seguro? Esto no tiene vuelta atrás${missing ? `, y aún faltan ${missing} por entrar (verán su resultado después)` : ''}.`); }}>Sortear</Button>
      ) : phase === 'confirm' ? (
        <div className="row-btns">
          <Button variant="ghost" onClick={() => { setPhase('ready'); setMsg('Tranqui, sin apuro. Toca «Sortear» cuando estén todos.'); }}>Todavía no</Button>
          <Button onClick={() => start(false)}>Sí, sortear</Button>
        </div>
      ) : phase === 'playing' ? (
        <Button variant="ghost" onClick={skip}>Saltar la animación</Button>
      ) : (
        <>
          <a className="btn btn--primary btn-link" href={wa(`¡Ya se hizo el sorteo del amigo secreto! Entra a descubrir a quién le toca regalarte: ${link()}`)} target="_blank" rel="noopener noreferrer">Avisar por WhatsApp</a>
          <div className="row-btns">
            <Button variant="ghost" onClick={() => start(true)}>Ver otra vez</Button>
            <Button variant="ghost" onClick={() => go('invite')}>Seguimiento</Button>
          </div>
        </>
      )}>
      <div className="stage" onPointerDown={skip}>
        <div className="stage-jm"><MascotSlot /></div>
        <div className="stage-main"><Tombola ref={tomb} people={people} idle={false} /></div>
      </div>
      <div className="roster" aria-label="Participantes del sorteo">
        {ov.overview.map((p) => (
          <div key={p.id} className={`roster-chip ${landed.has(p.id) ? 'roster-chip--on' : ''}`}>
            <span className="chip-dot" ref={(el) => { if (el) chips.current.set(p.id, el); else chips.current.delete(p.id); }} style={{ background: landed.has(p.id) ? undefined : 'transparent' }}>
              {landed.has(p.id) && <Avatar p={p} size={26} />}
            </span>
            <span className="chip-name">{p.name}</span>
          </div>
        ))}
      </div>
    </Screen>
  );
}

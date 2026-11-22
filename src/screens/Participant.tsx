import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, fmtDate, fmtMoney, flag, tokens, type Person, type Wish } from '../api';
import { useApp } from '../ctx';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { Keypad } from '../components/Keypad';
import { EmptyBox, HowTo, WishCard } from '../components/Wish';
import { Tombola } from '../components/Tombola';
import { GiftReveal, type GiftHandle, type GiftPhase } from '../components/GiftReveal';
import { MascotSlot, mk, type Msg } from '../mascot/Guide';
import { jm } from '../mascot/controller';
import { Flip, gsap, prefersReduced, rand, useGSAP } from '../anim/gsap';
import { fx, centerOf } from '../anim/fx';
import { normalizeUrl } from '../util';

const TOTAL = 5;
const useMsg = (first: Msg) => {
  const [m, setM] = useState(first);
  return [m, (t: string, k?: Msg['kind']) => setM(mk(t, k))] as const;
};

/* ───────────────────────── Info (fecha y monto) ───────────────────────── */
function InfoCard() {
  const { pub } = useApp();
  if (!pub) return null;
  return (
    <div className="card info-card" data-pop>
      <div className="info-row">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#FFB347" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        <div><small>Día del intercambio</small><strong>{pub.giftDate ? fmtDate(pub.giftDate) : 'Por definir'}</strong></div>
      </div>
      <div className="info-row">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#FFB347" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><rect x="3" y="7" width="18" height="4" rx="1.5" /><path d="M12 7v14M12 7c-4-5-8-2-5 0M12 7c4-5 8-2 5 0" /></svg>
        <div><small>Regalo de hasta</small><strong>{pub.giftAmount ? fmtMoney(pub.giftAmount) : 'Por definir'}</strong></div>
      </div>
    </div>
  );
}

/* ───────────────────────── 0) Recorrido ───────────────────────── */
export function Welcome({ i }: { i: number }) {
  const { go, pub } = useApp();
  const root = useRef<HTMLDivElement>(null);
  const amount = pub?.giftAmount ? ` El regalo es de hasta ${fmtMoney(pub.giftAmount)}.` : '';
  const msgs = useMemo(() => [
    mk('¡Buenas! Soy José Miguel y hoy te guío en el amigo secreto. Te muestro cómo va.'),
    mk(`Te toca regalarle a alguien y nadie sabe a quién, ni yo.${amount}`),
    mk('Son tres pasos y yo voy contigo. ¿Vamos?'),
  ], [amount]);
  const rows = [
    { t: 'Elige tu nombre', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6' },
    { t: 'Anota ideas de regalo', d: 'M10 14l4-4M8 12l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 12l2-2a3.5 3.5 0 0 0-5-5l-2 2' },
    { t: 'Descubre a tu amigo', d: 'M4 12v8h16v-8M2 8h20v4H2zM12 8v12M12 8c-4-5-8-2-5 0M12 8c4-5 8-2 5 0' },
  ];

  useGSAP(() => {
    const paths = gsap.utils.toArray<SVGPathElement>('.tour-ico path', root.current!);
    if (prefersReduced()) return;
    gsap.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, stagger: 0.18, ease: 'power2.inOut', delay: 0.3 });
  }, { scope: root });
  useGSAP(() => {
    const els = gsap.utils.toArray<HTMLElement>('.tour-row', root.current!);
    els.forEach((el, k) => {
      const on = i === 1 ? k === 2 : i === 2;
      gsap.to(el, { scale: on ? 1.04 : 1, opacity: on || i === 0 ? 1 : 0.55, duration: 0.7, ease: 'back.out(2)', delay: i === 2 ? k * 0.18 : 0 });
    });
    if (i === 2 && !prefersReduced()) gsap.fromTo('.tour-ico', { rotation: -12, scale: 0.8 }, { rotation: 0, scale: 1, duration: 0.8, ease: 'elastic.out(1.4,.4)', stagger: 0.18 });
  }, { dependencies: [i], scope: root });

  const next = () => {
    if (i < 2) go({ n: 'welcome', i: i + 1 }, { replace: true });
    else { flag.set('tour'); go({ n: 'who' }); }
  };
  return (
    <Screen
      step={0} total={TOTAL} label="Bienvenida" msg={msgs[i]} base={i === 1 ? 'point' : 'idle'}
      onBack={i > 0 ? () => go({ n: 'welcome', i: i - 1 }, { replace: true }) : undefined}
      footer={<Button pulse onClick={next}>{i < 2 ? 'Siguiente' : '¡Vamos!'}</Button>}
    >
      <div ref={root} className="tour">
        {rows.map((r, k) => (
          <div className="card tour-row" key={k} data-pop>
            <svg className="tour-ico" viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#FFB347" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={r.d} /></svg>
            <div><small>Paso {k + 1}</small><strong>{r.t}</strong></div>
          </div>
        ))}
        {(pub?.giftDate || pub?.giftAmount) && <InfoCard />}
      </div>
    </Screen>
  );
}

/* ───────────────────────── 1) ¿Quién eres? ───────────────────────── */
export function Who() {
  const { pub, go, back } = useApp();
  const msg = useMemo(() => mk(pub?.drawn
    ? 'Ya se hizo el sorteo. Toca tu nombre para descubrir a tu amigo secreto.'
    : '¿Quién eres? Toca tu nombre y yo me encargo del resto.'), [pub?.drawn]);
  const log = pub?.log ?? [];
  return (
    <Screen step={1} total={TOTAL} label="Quién eres" msg={msg} base="point" onBack={back}
      footer={<Button variant="ghost" onClick={() => go({ n: 'welcome', i: 0 })}>Ver el recorrido otra vez</Button>}>
      <div className="who-grid">
        {(pub?.participants ?? []).map((p) => (
          <button key={p.id} className="who-card" data-pop onClick={() => go({ n: 'pin', pid: p.id })} aria-label={`${p.name}${p.claimed ? ', ya entró' : ''}`}>
            <Avatar p={p} size={52} flipId={`avatar-${p.id}`} />
            <span className="who-name">{p.name}</span>
            <span className="who-state">
              {p.claimed ? (
                <><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg> Ya entró</>
              ) : 'Libre'}
            </span>
          </button>
        ))}
      </div>
      {log.length > 0 && (
        <div className="card news" data-pop>
          <small>Novedades</small>
          {log.slice(0, 3).map((l, i) => <p key={i}>{l.text}</p>)}
        </div>
      )}
    </Screen>
  );
}

/* ───────────────────────── 2) Clave ───────────────────────── */
export function Pin({ pid }: { pid: number }) {
  const { pub, refresh, enter, back } = useApp();
  const p = pub?.participants.find((x) => x.id === pid);
  const claimed = !!p?.claimed;
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null); // fase de confirmación
  const [msg, setMsg] = useMsg(mk(p ? (claimed ? `Hola ${p.name}. Escribe tu clave de 4 números para entrar.` : `¿Tú eres ${p.name}? Crea una clave de 4 números que recuerdes fácil.`) : 'Un momentito…'));
  const [shake, setShake] = useState(0);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(0);
  const name = p?.name ?? '';

  useEffect(() => {
    if (!p) return;
    setMsg(claimed ? `Hola ${name}. Escribe tu clave de 4 números para entrar.` : `¿Tú eres ${name}? Crea una clave de 4 números que recuerdes fácil.`);
  }, [claimed, p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setLocked((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [locked]);

  if (!p) return null;
  const bad = (text: string) => { setMsg(text, 'error'); setShake((s) => s + 1); setPin(''); };

  const submit = async () => {
    if (pin.length !== 4 || busy) return;
    if (!claimed && first === null) {
      setFirst(pin); setPin(''); setMsg('Perfecto. Escríbela una vez más para confirmar.');
      return;
    }
    if (!claimed && first !== pin) {
      setFirst(null); bad('Mmm, no coinciden. Tranqui, empecemos de nuevo con tu clave.');
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ token: string; me: Person }>(claimed ? '/login' : '/claim', { body: { participantId: p.id, pin } });
      setOk(true);
      setMsg(`¡Listo, ${name}! Ya estás adentro.`, 'success');
      await new Promise((res) => setTimeout(res, prefersReduced() ? 300 : 1100));
      await enter(r.token, r.me);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'wrong_pin') bad(`Esa clave no coincide, pero no pasa nada. Prueba otra vez, te ${Number(err.data.left) === 1 ? 'queda 1 intento' : `quedan ${err.data.left} intentos`}.`);
      else if (err.code === 'locked') { setLocked(Number(err.data.wait) || 60); bad(`Demasiados intentos. Espera ${err.data.wait} segundos y vuelve a probar.`); }
      else if (err.code === 'already_claimed') { await refresh(); setFirst(null); bad('Ese nombre ya tiene clave. Si eres tú, escríbela y entras.'); }
      else if (err.code === 'network') bad('Se cortó la conexión. Revisa tu internet y toca el botón otra vez.');
      else bad('Algo falló de mi lado. Toca el botón otra vez, yo te espero.');
    } finally { setBusy(false); }
  };

  const label = claimed ? 'Entrar' : first === null ? 'Siguiente' : 'Crear mi clave';
  return (
    <Screen step={2} total={TOTAL} label="Tu clave" msg={msg} base={ok ? 'celebrate' : 'idle'}
      onBack={() => (first !== null ? (setFirst(null), setPin('')) : back())}
      footer={
        <Button pulse={pin.length === 4} disabled={pin.length !== 4 || locked > 0} busy={busy} onClick={submit}>
          {locked > 0 ? `Espera ${locked} s` : label}
        </Button>}>
      <div className="pin-head">
        <Avatar p={p} size={64} flipId={`avatar-${p.id}`} className="pin-avatar" />
        <div className="pin-who">
          <h2 className="pin-name">{name}</h2>
          <button className="link-btn" onClick={back}>¿No eres {name}? Cambiar</button>
        </div>
      </div>
      <Keypad value={pin} length={4} onChange={setPin} shake={shake} ok={ok} />
    </Screen>
  );
}

/* ───────────────────────── 3) Lista de deseos ───────────────────────── */
interface Prev { url: string; title: string; image: string; site: string }

export function WishScreen() {
  const { me, wishes, setWishes, pub, go, back } = useApp();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [prev, setPrev] = useState<Prev | null>(null);
  const [loading, setLoading] = useState(false);
  const [bad, setBad] = useState(false);
  const [adding, setAdding] = useState(false);
  const [how, setHow] = useState(false);
  const [del, setDel] = useState<Wish | null>(null);
  const [msg, setMsg] = useMsg(mk(wishes.length
    ? 'Tu amigo secreto verá esta lista. Agrega más ideas o toca «Listo» cuando termines.'
    : 'Pega aquí el link de algo que te gustaría recibir. Si no sabes cómo, toca «¿Cómo copio un link?».'));
  const flipRef = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const landed = useRef<number | null>(null);
  const [landedId, setLandedId] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const norm = normalizeUrl(url);

  // validar mientras escribe/pega (con pausa, para no regañar a cada letra)
  useEffect(() => {
    setPrev(null); setBad(false);
    if (!url.trim()) { setLoading(false); return; }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      if (!norm) {
        setBad(true);
        setMsg('Ese link no me cuadra. Cópialo entero desde la barra de la tienda y pégalo aquí, yo espero.', 'error');
        if (!prefersReduced()) gsap.fromTo('.field', { x: 0 }, { x: 14, duration: 0.7, ease: 'jmShake' });
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(`/api/preview?url=${encodeURIComponent(norm)}`, { signal: ac.signal, headers: { authorization: `Bearer ${tokens.get('p')}` } });
        const data = r.ok ? await r.json() : { url: norm, title: '', image: '', site: new URL(norm).hostname.replace(/^www\./, '') };
        setPrev(data);
        jm.flash('peek', 1500);
        setMsg('¡Buen link! Mira cómo se ve y toca «Agregar a mi lista».');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setPrev({ url: norm, title: '', image: '', site: new URL(norm).hostname.replace(/^www\./, '') });
          setMsg('Link anotado. No pude ver la foto, pero igual sirve: toca «Agregar a mi lista».');
        }
      } finally { setLoading(false); }
    }, 750);
    return () => { clearTimeout(t); ac.abort(); };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // aterrizaje del link nuevo (Flip: la vista previa se transforma en tarjeta de la lista)
  useLayoutEffect(() => {
    if (flipRef.current && !prefersReduced()) {
      const st = flipRef.current;
      flipRef.current = null;
      const id = landed.current;
      Flip.from(st, { duration: 0.95, ease: 'back.out(1.25)', scale: true, absolute: false, simple: false });
      if (id) {
        const el = document.querySelector(`[data-wish="${id}"]`);
        if (el) {
          gsap.fromTo(el, { scaleY: 0.9, scaleX: 1.04 }, { scaleY: 1, scaleX: 1, duration: 0.9, ease: 'elastic.out(1.2,.35)', delay: 0.7, transformOrigin: '50% 100%' });
          gsap.delayedCall(0.7, () => { const c = centerOf(el); fx.sparkle(c.x, c.y, 12, 90); });
        }
      }
    }
    flipRef.current = null;
  }, [wishes]);

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) { setMsg('Todavía no copiaste nada. Copia el link en la tienda y vuelve a tocar «Pegar».', 'error'); return; }
      setUrl(t.trim());
    } catch {
      input.current?.focus();
      setMsg('Tu celular no me deja pegar solo. Mantén el dedo en el cuadro y elige «Pegar».');
    }
  };

  const add = async () => {
    if (!norm || !prev) return;
    setAdding(true);
    try {
      const r = await api<{ wish: Wish }>('/wishes', { as: 'p', body: { url: norm, note } });
      flipRef.current = Flip.getState('.preview-card, .wish-card');
      landed.current = r.wish.id;
      setLandedId(r.wish.id);
      setTimeout(() => setLandedId(null), 1400);
      setWishes((w) => [r.wish, ...w]);
      setUrl(''); setNote(''); setPrev(null);
      setMsg('¡Aterrizó! Tu idea ya está en la lista. Agrega otra o toca «Listo».', 'success');
    } catch (e) {
      const c = (e as ApiError).code;
      setMsg(c === 'duplicate' ? 'Ese ya lo tienes en tu lista. Pega otro distinto si quieres.'
        : c === 'too_many' ? 'Ya tienes 15 ideas, ¡más que suficiente! Quita alguna para agregar otra.'
        : c === 'network' ? 'Se cortó la conexión. Revisa tu internet y toca «Agregar» otra vez.'
        : 'Ese link no me cuadra. Cópialo entero desde la barra de la tienda y pégalo aquí.', 'error');
    } finally { setAdding(false); }
  };

  const remove = async () => {
    if (!del) return;
    const w = del;
    setDel(null);
    try {
      await api(`/wishes/${w.id}`, { method: 'DELETE', as: 'p' });
      flipRef.current = Flip.getState('.wish-card');
      setWishes((a) => a.filter((x) => x.id !== w.id));
      setMsg('Listo, la quité de tu lista.');
    } catch { setMsg('No pude quitarla. Revisa tu internet y prueba otra vez.', 'error'); }
  };

  const toggleHow = () => {
    const v = !how; setHow(v);
    if (v) setMsg('Fácil: abre el producto en la tienda y toca Compartir, luego Copiar enlace. Después vuelve y toca «Pegar».');
  };

  const cont = () => go(pub?.drawn ? { n: 'reveal' } : { n: 'wait' });
  const ready = !!prev && !loading;

  return (
    <Screen step={3} total={TOTAL} label="Tus deseos" msg={msg} base={bad ? 'worried' : 'idle'} onBack={back}
      footer={del ? (
        <div className="row-btns">
          <Button variant="ghost" onClick={() => { setDel(null); setMsg('Tranqui, la dejé donde estaba.'); }}>No, dejarla</Button>
          <Button variant="danger" onClick={remove}>Sí, quitar</Button>
        </div>
      ) : ready ? (
        <Button pulse busy={adding} onClick={add}>Agregar a mi lista</Button>
      ) : (
        <Button pulse={!url} disabled={!!url.trim()} onClick={cont}>{wishes.length ? 'Listo, ya terminé' : 'Seguir sin ideas por ahora'}</Button>
      )}>
      <div className="card" data-pop>
        <label className="field-label" htmlFor="wish-url">Link de un regalo que te guste</label>
        <div className={`field ${bad ? 'field--bad' : ''}`}>
          <input
            id="wish-url" ref={input} value={url} onChange={(e) => setUrl(e.target.value)}
            inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Pega aquí el link"
            aria-invalid={bad}
          />
          {url && <button className="field-x" onClick={() => setUrl('')} aria-label="Borrar el link">×</button>}
        </div>
        <div className="row-btns" style={{ marginTop: 12 }}>
          <Button variant="ghost" onClick={paste}>Pegar</Button>
          <Button variant="ghost" onClick={toggleHow} aria-expanded={how}>¿Cómo copio?</Button>
        </div>
      </div>

      {how && (
        <div className="card howto" data-pop>
          <HowTo />
          <ol>
            <li>Abre el producto en la tienda.</li>
            <li>Toca <b>Compartir</b> y luego <b>Copiar enlace</b>.</li>
            <li>Vuelve aquí y toca <b>Pegar</b>.</li>
          </ol>
          <p className="example">Ejemplo: <code>https://www.falabella.com/…/producto</code></p>
        </div>
      )}

      {loading && <div className="card preview-card shimmer" aria-busy="true"><div className="sk sk-img" /><div className="sk-lines"><div className="sk" /><div className="sk" style={{ width: '60%' }} /></div></div>}
      {prev && !loading && (
        <div className="preview-wrap">
          <WishCard w={{ id: 0, url: prev.url, title: prev.title, image: prev.image, site: prev.site, note }} flipId="landing" className="preview-card" />
          <div className="field field--note">
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional): talla, color…" aria-label="Nota opcional para tu amigo secreto" />
          </div>
        </div>
      )}

      <div ref={listRef} className="wish-list">
        {wishes.length === 0 && !prev && !loading
          ? <EmptyBox title="Tu lista está vacía" hint="Cuando pegues un link, aterriza aquí." />
          : wishes.map((w) => <WishCard key={w.id} w={w} onRemove={() => { setDel(w); setMsg(`¿Quito «${w.title || w.site}» de tu lista? No se puede deshacer.`); }} flipId={landedId === w.id ? 'landing' : undefined} />)}
      </div>
    </Screen>
  );
}

/* ───────────────────────── 4) Esperar el sorteo ───────────────────────── */
export function Wait() {
  const { pub, refresh, go, back, me } = useApp();
  const drawn = !!pub?.drawn;
  const entered = pub?.participants.filter((p) => p.claimed).length ?? 0;
  const total = pub?.participants.length ?? 0;
  const first = useRef(true);
  const [msg, setMsg] = useMsg(mk(drawn
    ? '¡Ya se hizo el sorteo! Toca el botón para descubrir a tu amigo secreto.'
    : 'Todo listo de tu lado. El organizador hará el sorteo y aquí te aviso cuando salga.'));

  useEffect(() => {
    const t = setInterval(() => { refresh(); }, 6000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (drawn) setMsg('¡Salió el sorteo! Toca el botón para descubrir a tu amigo secreto.', 'success');
  }, [drawn]); // eslint-disable-line react-hooks/exhaustive-deps

  const balls = (pub?.participants ?? []).map((p) => ({ ...p, lit: p.claimed }));
  return (
    <Screen step={4} total={TOTAL} label="El sorteo" msg={msg} base={drawn ? 'point' : 'think'} bubbleOnly onBack={back}
      footer={drawn
        ? <Button pulse onClick={() => go({ n: 'reveal' })}>Descubrir a mi amigo secreto</Button>
        : <Button variant="ghost" onClick={() => go({ n: 'wish' })}>Agregar más ideas de regalo</Button>}>
      <div className="stage">
        <div className="stage-jm"><MascotSlot /></div>
        <div className="stage-main">{balls.length > 0 && <Tombola people={balls} />}</div>
      </div>
      <p className="stage-count" data-pop>
        {drawn ? 'El sorteo ya está hecho.' : `Ya entraron ${entered} de ${total}. Las bolitas encendidas son quienes ya están adentro.`}
      </p>
      <InfoCard />
    </Screen>
  );
}

/* ───────────────────────── 5) Revelación ───────────────────────── */
export function RevealScreen({ again }: { again?: boolean }) {
  const { me, reveal, setReveal, go, back, pub } = useApp();
  const gift = useRef<GiftHandle>(null);
  const [phase, setPhase] = useState<GiftPhase>('idle');
  const [fail, setFail] = useState(false);
  const short = !!flag.get('revealed_' + me?.id) || !!again;
  const reduced = prefersReduced();
  const [msg, setMsg] = useMsg(mk(reduced
    ? 'Tengo tu regalo. Toca «Abrir el regalo» para descubrir a tu amigo secreto.'
    : 'Tengo tu regalo. Mantén presionado el regalo (o el botón) hasta que se abra.'));

  useEffect(() => {
    let live = true;
    api<{ receiver: Person; wishes: Wish[] }>('/reveal', { as: 'p' })
      .then((r) => live && setReveal(r))
      .catch((e: ApiError) => {
        if (!live) return;
        if (e.code === 'not_drawn') go({ n: 'wait' }, { replace: true });
        else { setFail(true); setMsg('No pude traer tu regalo. Revisa tu internet y toca «Reintentar».', 'error'); }
      });
    return () => { live = false; };
  }, [fail === false]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPhase = (p: GiftPhase) => {
    setPhase(p);
    if (p === 'charging') setMsg('¡No miro, no miro! Sigue presionando…');
    if (p === 'opened' && reveal) {
      flag.set('revealed_' + me?.id);
      setMsg(`¡Es ${reveal.receiver.name}! Ahora mira qué ideas de regalo dejó.`, 'success');
    }
  };
  // si suelta antes de tiempo
  const lastPhase = useRef<GiftPhase>('idle');
  useEffect(() => {
    if (lastPhase.current === 'charging' && phase === 'idle') setMsg('Casi, casi… Mantén presionado un poquito más, sin soltar.');
    lastPhase.current = phase;
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const hold = {
    onPointerDown: (e: React.PointerEvent) => { if (phase === 'opening') { gift.current?.skip(); return; } (e.currentTarget as Element).setPointerCapture?.(e.pointerId); gift.current?.startHold(); },
    onPointerUp: () => gift.current?.release(),
    onPointerCancel: () => gift.current?.release(),
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  };
  const kbd = {
    onKeyDown: (e: React.KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); reduced ? gift.current?.openNow() : gift.current?.startHold(); } },
    onKeyUp: (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') gift.current?.release(); },
  };

  return (
    <Screen step={5} total={TOTAL} label="Tu amigo secreto" msg={msg} base="deliver" bubbleOnly onBack={back}
      footer={fail ? <Button onClick={() => setFail(false)}>Reintentar</Button>
        : phase === 'opened'
          ? <Button pulse onClick={() => go({ n: 'theirs' })}>Ver su lista de deseos</Button>
          : <span className="btn-wrap">
              <button
                className={`btn btn--primary hold-btn ${phase === 'charging' ? 'is-holding' : ''}`}
                disabled={!reveal || phase === 'opening'}
                {...(reduced ? { onClick: () => gift.current?.openNow() } : hold)} {...kbd}
                aria-label={reduced ? 'Abrir el regalo' : 'Mantén presionado para abrir el regalo'}
              >
                {reduced ? 'Abrir el regalo' : phase === 'opening' ? 'Toca para saltar' : 'Mantén presionado para abrir'}
              </button>
            </span>}>
      <div className="stage stage--gift">
        <div className="stage-jm"><MascotSlot /></div>
        <div className="stage-main" {...(reduced ? {} : hold)} style={{ touchAction: 'none' }}>
          {reveal && <GiftReveal ref={gift} person={reveal.receiver} short={short} onPhase={onPhase} />}
        </div>
      </div>
    </Screen>
  );
}

/* ───────────────────────── 5b) Su lista de deseos ───────────────────────── */
export function Theirs() {
  const { reveal, setReveal, go, back, pub } = useApp();
  const [msg, setMsg] = useMsg(mk(''));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reveal) {
      setMsg(reveal.wishes.length
        ? `Estas son las ideas de ${reveal.receiver.name}. Toca una para abrir el link.`
        : `${reveal.receiver.name} aún no deja ideas. Vuelve más tarde o pregúntale con disimulo.`);
      return;
    }
    api<{ receiver: Person; wishes: Wish[] }>('/reveal', { as: 'p' }).then(setReveal).catch(() => go({ n: 'wait' }, { replace: true }));
  }, [reveal?.receiver.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    setDone(true);
    const when = pub?.giftDate ? ` el ${fmtDate(pub.giftDate, false)}` : '';
    const upto = pub?.giftAmount ? ` y el regalo es de hasta ${fmtMoney(pub.giftAmount)}` : '';
    setMsg(`¡Perfecto! Nos vemos${when}${upto}. Shhh, es secreto.`, 'success');
    fx.rain(40);
  };
  if (!reveal) return null;
  return (
    <Screen step={5} total={TOTAL} label="Su lista" msg={msg} base="idle" onBack={back}
      footer={<>
        <Button pulse={!done} onClick={finish}>{done ? '¡Shhh! Guardado' : 'Entendido, ¡a guardar el secreto!'}</Button>
        <Button variant="ghost" onClick={() => go({ n: 'reveal', again: true })}>Ver la revelación otra vez</Button>
      </>}>
      <div className="card receiver" data-pop>
        <Avatar p={reveal.receiver} size={74} flipId="receiver" />
        <div><small>Tu amigo secreto</small><strong>{reveal.receiver.name}</strong></div>
      </div>
      <div className="wish-list">
        {reveal.wishes.length === 0
          ? <EmptyBox title={`${reveal.receiver.name} aún no tiene ideas`} hint="Cuando agregue links, aparecerán aquí." />
          : reveal.wishes.map((w) => <WishCard key={w.id} w={w} />)}
      </div>
    </Screen>
  );
}

export const Loading = () => (
  <Screen step={0} total={TOTAL} label="Cargando" msg={mk('Un momentito, estoy prendiendo las luces…')} base="think" />
);

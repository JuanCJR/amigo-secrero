import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useJose } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Chip, Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { Field } from '../components/Field';
import { Avatar } from '../components/Avatar';
import { WishCard } from '../components/WishCard';
import { CopyLinkTutorial, EmptyGift } from '../components/Illustrations';
import { api, clp, joseError, type WishItem } from '../lib/api';
import { isAuthError, useMatch, useMe } from '../lib/data';
import { seen, tokens } from '../lib/storage';
import { gsap, Flip, motion } from '../lib/gsap';
import { confetti } from '../components/confetti';

/** Saca el link de un texto pegado (las apps suelen compartir "Mira esto https://...") */
export function extractUrl(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(/https?:\/\/[^\s<>"']+/i);
  let candidate = m ? m[0] : t;
  if (!m && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(candidate)) candidate = 'https://' + candidate;
  try {
    const u = new URL(candidate);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

type Preview = { site: string; title?: string; image?: string };

export function MyList({ gid }: { gid: string }) {
  useScreenMeta({ back: `/g/${gid}/inicio`, step: 2, steps: 4 });
  const { navigate } = useRouter();
  const { say, react, setMood } = useJose();
  const { data, error, mutate } = useMe(gid);
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const landed = useRef<string | null>(null);
  const url = extractUrl(raw);
  const wishes = data?.wishlist ?? [];

  useEffect(() => {
    if (error && isAuthError(error)) navigate(`/g/${gid}`, { replace: true });
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data) return;
    say(
      wishes.length
        ? { text: 'Pega aquí otro link de algo que te tinque y toca Agregar. El que te sacó va a ver tu lista.', point: '#wish-url' }
        : { text: 'Copia el link de un regalo en la app de la tienda y pégalo aquí. Si no cachai cómo, toca "¿Cómo copio un link?".', point: '#wish-url' },
    );
  }, [!!data]); // eslint-disable-line react-hooks/exhaustive-deps

  // vista previa
  useEffect(() => {
    setPreview(null);
    if (!url) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      setLoadingPrev(true);
      setMood('thinking');
      try {
        const p = await api<Preview>('/preview', { body: { url } });
        if (alive) {
          setPreview(p);
          say({ text: '¡Lo pillé! Si querí, ponle una nota, y toca Agregar a mi lista.', point: '.screen-cta .btn' });
        }
      } catch {
        if (alive) setPreview({ site: new URL(url).hostname.replace(/^www\./, '') });
      } finally {
        if (alive) setLoadingPrev(false);
      }
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // el deseo nuevo "aterriza" desde la vista previa hasta la lista
  useLayoutEffect(() => {
    const id = landed.current;
    if (!id || !listRef.current) return;
    landed.current = null;
    const el = listRef.current.querySelector<HTMLElement>(`[data-flip-id="wish-${id}"]`);
    if (!el) return;
    const st = flipState.current;
    flipState.current = null;
    if (st && !motion.reduced) {
      Flip.from(st, {
        targets: el,
        duration: 0.7,
        ease: 'power3.inOut',
        absolute: true,
        zIndex: 20,
        onComplete: () => {
          gsap
            .timeline()
            .to(el, { scaleY: 0.8, scaleX: 1.08, duration: 0.09, ease: 'power2.in', transformOrigin: '50% 100%' })
            .to(el, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1.2,0.35)' });
          const r = el.getBoundingClientRect();
          confetti(r.left + r.width / 2, r.top + 10, { count: 26, power: 0.6 });
        },
      });
    }
    react('peek');
  }, [wishes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) throw new Error();
      setRaw(t);
      if (!extractUrl(t)) say({ text: '¿Qué weá copiaste? Eso no es un link. En la tienda toca Compartir y después Copiar link.', mood: 'worried' });
    } catch {
      say({ text: 'No pude leer lo que copiaste. Mantén apretao el cuadro de texto y elige Pegar.', mood: 'worried', point: '#wish-url' });
    }
  };

  const add = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const prevEl = document.querySelector<HTMLElement>('[data-flip-id="wish-new"]');
      const r = await api<{ item: WishItem; wishlist: WishItem[] }>('/me/wishlist', {
        body: { url, note, preview: preview ?? undefined },
        token: tokens.participant(gid),
      });
      if (prevEl) {
        prevEl.dataset.flipId = `wish-${r.item.id}`;
        flipState.current = Flip.getState(prevEl);
      }
      landed.current = r.item.id;
      setRaw('');
      setNote('');
      setPreview(null);
      mutate({ ...data!, wishlist: r.wishlist });
      const n = r.wishlist.length;
      say({
        text: n === 1 ? '¡Anotao tu primer deseo, conchetumare! Mete otra weá si querí; mientras más ideas, mejor.' : `¡Anotao! Ya teníai ${n} ideas. Mete otra o toca Volver cuando estí listo.`,
        mood: 'celebrating',
      });
    } catch (e) {
      say({ text: joseError(e), mood: 'worried', point: '#wish-url' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, el: HTMLElement) => {
    const anim = motion.reduced
      ? Promise.resolve()
      : new Promise<void>((res) => gsap.to(el, { rotation: 18, y: 60, scale: 0.4, opacity: 0, duration: 0.45, ease: 'back.in(1.8)', onComplete: res }));
    try {
      const [r] = await Promise.all([api<{ wishlist: WishItem[] }>(`/me/wishlist/${id}`, { method: 'DELETE', token: tokens.participant(gid) }), anim]);
      const st = listRef.current ? Flip.getState(listRef.current.querySelectorAll('.wish')) : null;
      mutate({ ...data!, wishlist: r.wishlist });
      requestAnimationFrame(() => st && Flip.from(st, { duration: 0.5, ease: 'back.out(1.6)' }));
      say({ text: 'Listo, lo saqué de tu lista. Pega otro link cuando querai.', point: '#wish-url' });
    } catch (e) {
      gsap.set(el, { clearProps: 'all' });
      say({ text: joseError(e), mood: 'worried' });
    }
  };

  return (
    <Screen
      cta={
        <Btn
          busy={busy}
          blocked={!url}
          onBlocked={() =>
            say({
              text: raw ? 'Esa weá no es un link. En la tienda toca Compartir, después Copiar link, y lo pegai en el cuadro.' : 'Primero pega un link en el cuadro de arriba po. Toca Pegar o mantén apretao el cuadro.',
              mood: 'worried',
              point: '#wish-url',
            })
          }
          onClick={add}
        >
          Agregar a mi lista
        </Btn>
      }
    >
      <div className="screen-head" data-flip-id="card-list">
        <span className="step-icon" aria-hidden="true">
          📝
        </span>
        <h1 className="title">Mi lista de deseos</h1>
      </div>

      <div className="add-row" data-anim="pop">
        <Field
          id="wish-url"
          label="Link del regalo"
          placeholder="Pega aquí el link"
          inputMode="url"
          autoComplete="off"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onPaste={() => react('flare')}
        />
        {typeof navigator !== 'undefined' && 'clipboard' in navigator && 'readText' in navigator.clipboard && (
          <Btn variant="soft" className="add-btn" anim={false} onClick={paste}>
            📋 Pegar
          </Btn>
        )}
      </div>

      {raw && !url && (
        <p className="inline-hint" data-anim="pop">
          Debe empezar con https:// (por ejemplo https://www.falabella.com/…)
        </p>
      )}

      {url && (
        <div className="preview-zone">
          {loadingPrev || !preview ? (
            <div className="wish wish-skeleton" aria-label="Buscando vista previa">
              <span className="wish-thumb shimmer" />
              <span className="wish-body">
                <span className="sk-line shimmer" />
                <span className="sk-line short shimmer" />
              </span>
            </div>
          ) : (
            <WishCard item={{ url, note, ...preview }} flipId="wish-new" />
          )}
          <Field label="Nota (opcional)" placeholder="Ej: talla M, color azul" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}

      <button className="link-btn" data-anim="pop" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
        {help ? 'Ocultar ayuda' : '¿Cómo copio un link?'}
      </button>
      {help && (
        <div className="help card">
          <CopyLinkTutorial />
          <ol className="help-steps">
            <li>Abre el producto en la app o página de la tienda.</li>
            <li>
              Toca <strong>Compartir</strong> (el ícono con flechita).
            </li>
            <li>
              Elige <strong>Copiar link</strong>.
            </li>
            <li>
              Vuelve aquí y toca <strong>Pegar</strong>.
            </li>
          </ol>
        </div>
      )}

      {data && wishes.length === 0 && !url && (
        <div className="empty" data-anim="pop">
          <EmptyGift label="Tu lista está vacía" />
          <p>Tu lista está vacía</p>
        </div>
      )}
      {wishes.length > 0 && (
        <>
          <div className="group-label">Tu lista · {wishes.length}</div>
          <ul className="wishes" ref={listRef}>
            {[...wishes].reverse().map((w) => (
              <li key={w.id}>
                <WishCard item={w} flipId={`wish-${w.id}`} onDelete={(el) => remove(w.id, el)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}

export function TheirList({ gid }: { gid: string }) {
  useScreenMeta({ back: `/g/${gid}/inicio`, step: 4, steps: 4 });
  const { navigate } = useRouter();
  const { say } = useJose();
  const { data: me } = useMe(gid);
  const { data, error } = useMatch(gid);
  const pid = me?.me.id;

  useEffect(() => {
    if (pid && !seen.has(`reveal:${gid}:${pid}`)) navigate(`/g/${gid}/descubrir`, { replace: true });
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (error) say({ text: joseError(error), mood: 'worried' });
  }, [error, say]);
  useEffect(() => {
    if (!data || !me) return;
    const n = data.wishlist.length;
    say(
      n
        ? { text: `Esto es lo que le tinca al ${data.receiver.name}. Toca una opción pa abrirla en la tienda.`, point: '.wishes' }
        : { text: `El flojo culiao del ${data.receiver.name} no ha puesto ni una weá todavía. Vuelve en unos días, o sorpréndelo con algo de hasta ${clp(me.group.budget)}.`, mood: 'thinking' },
    );
  }, [!!data, !!me]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen cta={<Btn variant="soft" onClick={() => navigate(`/g/${gid}/inicio`)}>Volver al inicio</Btn>}>
      <div className="screen-head receiver-head" data-flip-id="card-their">
        {data ? <Avatar seed={data.receiver.avatar} size={64} /> : <span className="step-icon">🎯</span>}
        <div>
          <small>Le regalas a</small>
          <h1 className="title">{data?.receiver.name ?? '…'}</h1>
        </div>
      </div>
      {me && (
        <div className="chips" data-anim="pop">
          <Chip tone="gold">💰 Hasta {clp(me.group.budget)}</Chip>
        </div>
      )}
      {data && data.wishlist.length === 0 && (
        <div className="empty" data-anim="pop">
          <EmptyGift label="Lista vacía" />
          <p>Aún no hay ideas</p>
        </div>
      )}
      {data && data.wishlist.length > 0 && (
        <ul className="wishes">
          {data.wishlist.map((w) => (
            <li key={w.id} data-anim="pop">
              <WishCard item={w} readOnly />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

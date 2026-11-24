import { useEffect, useRef, useState } from 'react';
import { useJose } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Chip, Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { Avatar } from '../components/Avatar';
import { PinInput, type PinHandle } from '../components/PinInput';
import { api, clp, daysUntil, joseError, prettyDate } from '../lib/api';
import { isAuthError, put, useGroup, useMe } from '../lib/data';
import { forgetGroup, rememberGroup, seen, tokens } from '../lib/storage';
import { confetti } from '../components/confetti';
import { Icon } from '../components/Icon';

export function Join({ gid }: { gid: string }) {
  useScreenMeta({ back: null, step: 1, steps: 4 });
  const { navigate } = useRouter();
  const { say } = useJose();
  const { data: g, error } = useGroup(gid);

  useEffect(() => {
    if (tokens.participant(gid)) navigate(`/g/${gid}/inicio`, { replace: true });
  }, [gid, navigate]);
  useEffect(() => {
    if (error) say({ text: joseError(error), mood: 'worried' });
  }, [error, say]);
  useEffect(() => {
    if (!g) return;
    const first = !seen.has(`join:${gid}`);
    seen.mark(`join:${gid}`);
    say({
      text: first
        ? `¡Wena, weón! Soy el José Miguel, el que manda en esta weá de amigo secreto. Busca tu nombre y tócalo pa entrar.`
        : 'Toca tu nombre pa entrar. Si ya teníai PIN, te lo voy a pedir po.',
      point: '.face-grid',
    });
  }, [!!g]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g) return <Screen><div className="loading" data-anim="pop">{error ? '' : 'Cargando…'}</div></Screen>;
  return (
    <Screen>
      <div className="group-head" data-anim="drop">
        <h1 className="title">{g.title}</h1>
        <div className="chips">
          <Chip><Icon name="calendar" size={16} /> {prettyDate(g.date)}</Chip>
          <Chip tone="gold"><Icon name="gift" size={16} /> Hasta {clp(g.budget)}</Chip>
        </div>
      </div>
      <div className="group-label" data-anim="pop">
        ¿Quién eres?
      </div>
      <ul className="face-grid">
        {g.participants.map((p) => (
          <li key={p.id} data-anim="pop">
            <button className="face" onClick={() => navigate(`/g/${gid}/pin/${p.id}`)}>
              <span className="face-av" data-flip-id={`av-${p.id}`}>
                <Avatar seed={p.avatar} size={72} />
              </span>
              <span className="face-name">{p.name}</span>
              {p.claimed && (
                <span className="face-lock">Ya entró</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

export function Pin({ gid, pid }: { gid: string; pid: string }) {
  useScreenMeta({ back: `/g/${gid}`, backLabel: 'No soy yo, volver', step: 1, steps: 4 });
  const { navigate } = useRouter();
  const { say } = useJose();
  const { data: g } = useGroup(gid);
  const p = g?.participants.find((x) => x.id === pid);
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<PinHandle>(null);
  const creating = p ? !p.claimed : false;

  useEffect(() => {
    if (!p) return;
    say(
      creating
        ? { text: `¡Wena, ${p.name} culiao! Inventa un PIN de 4 números que no se te olvide; con ese entrai desde otro celu.`, point: '.pin' }
        : { text: `¡Wena de nuevo, ${p.name}! Pon tu PIN de 4 números pa entrar.`, point: '.pin' },
    );
  }, [!!p]); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = async (v: string) => {
    if (creating && !first) {
      setFirst(v);
      setPin('');
      say({ text: 'Bien ahí. Escríbelo otra vez, pa estar seguros.', point: '.pin' });
      return;
    }
    if (creating && v !== first) {
      ref.current?.shake();
      setFirst(null);
      setPin('');
      say({ text: 'No calzan, weón, la cagaste. Pero no pasa na: inventa el PIN de nuevo desde cero.', mood: 'worried' });
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ token: string }>(`/groups/${gid}/enter`, { body: { pid, pin: v } });
      tokens.setParticipant(gid, r.token);
      rememberGroup({ gid, role: 'participant', title: g!.title, name: p!.name });
      put(`group:${gid}`, { ...g!, participants: g!.participants.map((x) => (x.id === pid ? { ...x, claimed: true } : x)) });
      say({ text: `¡Adentro, ${p!.name}, conchetumare!`, mood: 'celebrating' });
      await ref.current?.success();
      const rect = document.querySelector('.pin')?.getBoundingClientRect();
      if (rect) confetti(rect.left + rect.width / 2, rect.top, { count: 40 });
      navigate(`/g/${gid}/inicio`, { replace: true });
    } catch (e) {
      setBusy(false);
      setPin('');
      setFirst(null);
      ref.current?.shake();
      say({ text: joseError(e), mood: 'worried' });
    }
  };

  if (!p) return <Screen><div className="loading">Cargando…</div></Screen>;
  return (
    <Screen
      cta={
        <Btn busy={busy} blocked={pin.length < 4} onBlocked={() => say({ text: 'Ya po, escribe los 4 números en las casillas.', point: '.pin', mood: 'worried' })} onClick={() => enter(pin)}>
          {creating && !first ? 'Siguiente' : 'Entrar'}
        </Btn>
      }
    >
      <div className="who">
        <span className="who-av" data-flip-id={`av-${p.id}`}>
          <Avatar seed={p.avatar} size={120} />
        </span>
        <h1 className="title" data-anim="drop">
          {creating ? (first ? 'Repite tu PIN' : 'Crea tu PIN') : p.name}
        </h1>
      </div>
      <div data-anim="pop" data-delay="0.55">
        <PinInput ref={ref} value={pin} onChange={setPin} onDone={enter} label="PIN de 4 números" autoFocus />
      </div>
    </Screen>
  );
}

const TOUR = [
  { text: '', point: null },
  { text: 'Primero, arma tu lista de deseos con links de las weás que te tinquen. Toca Siguiente abajo.', point: '[data-flip-id="card-list"]' },
  { text: 'Cuando el organizador haga el sorteo, aquí cachai a quién le regalai. Dale a Siguiente.', point: '[data-flip-id="card-reveal"]' },
  { text: 'Y aquí ves lo que pidió, pa achuntarle con el regalo. Toca Armar mi lista y partimos.', point: '[data-flip-id="card-their"]' },
];

export function Home({ gid }: { gid: string }) {
  const { navigate } = useRouter();
  const { say } = useJose();
  const { data, error, reload } = useMe(gid);
  const pid = data?.me.id;
  const [tour, setTour] = useState<number | null>(null);
  const revealed = pid ? seen.has(`reveal:${gid}:${pid}`) : false;
  const drawn = !!data?.group.drawn;
  const wishes = data?.wishlist.length ?? 0;
  const step = !wishes ? 2 : drawn && !revealed ? 3 : revealed ? 4 : 2;
  // José guía el recorrido la primera vez; después el inicio queda limpio (mientras carga, también)
  useScreenMeta({ back: null, step, steps: 4, joseQuiet: pid ? seen.has(`tour:${gid}:${pid}`) && tour === null : true });
  const wasDrawn = useRef<boolean | null>(null);

  useEffect(() => {
    if (!tokens.participant(gid)) navigate(`/g/${gid}`, { replace: true });
  }, [gid, navigate]);
  useEffect(() => {
    if (!error) return;
    if (isAuthError(error)) {
      tokens.clearParticipant(gid);
      say({ text: joseError(error), mood: 'worried' });
      navigate(`/g/${gid}`, { replace: true });
    } else say({ text: joseError(error), mood: 'worried' });
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  // avisar cuando se haga el sorteo
  useEffect(() => {
    if (drawn) return;
    const iv = window.setInterval(reload, 15000);
    return () => window.clearInterval(iv);
  }, [drawn, reload]);

  const next = () => {
    if (!wishes) return { label: 'Armar mi lista', to: `/g/${gid}/mi-lista`, text: 'Ya po, ahora te toca armar tu lista de deseos. Toca el botón de abajo.' };
    if (drawn && !revealed)
      return { label: 'Descubrir a mi amigo secreto', to: `/g/${gid}/descubrir`, text: '¡Ya se hizo el sorteo, weón! Toca el botón pa cachar a quién chucha le regalai.' };
    if (revealed) return { label: 'Ver qué le gustaría', to: `/g/${gid}/su-lista`, text: 'Ya cachai a quién le regalai. Toca el botón pa ver su lista de deseos.' };
    return {
      label: 'Agregar más deseos',
      to: `/g/${gid}/mi-lista`,
      text: `Teníai ${wishes} ${wishes === 1 ? 'deseo' : 'deseos'} en la lista. El sorteo aún no se hace; te aviso aquí al tiro cuando pase.`,
    };
  };

  useEffect(() => {
    if (!data) return;
    const tourKey = `tour:${gid}:${data.me.id}`;
    if (wasDrawn.current === false && drawn) {
      say({ text: '¡Ya se hizo el sorteo, weón! Toca el botón pa cachar a quién chucha le regalai.', mood: 'celebrating' });
      wasDrawn.current = drawn;
      return;
    }
    wasDrawn.current = drawn;
    if (!seen.has(tourKey) && tour === null) {
      setTour(0);
      say({ text: `¡Wena, ${data.me.name}, weón! Te explico cómo es la weá en tres pasos, tranqui. Toca Siguiente pa empezar.`, mood: 'idle' });
      return;
    }
    if (tour === null) {
      const n = next();
      say({ text: n.text, point: '.screen-cta .btn' });
    }
  }, [data?.me.id, drawn, wishes]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceTour = () => {
    const t = (tour ?? 0) + 1;
    if (t >= TOUR.length) {
      seen.mark(`tour:${gid}:${data!.me.id}`);
      setTour(null);
      navigate(next().to);
      return;
    }
    setTour(t);
    say({ text: TOUR[t].text, point: TOUR[t].point });
  };

  if (!data) return <Screen><div className="loading" data-anim="pop">Cargando…</div></Screen>;
  const { me, group: g } = data;
  const n = next();
  const days = daysUntil(g.date);
  const cards = [
    { id: 'card-list', icon: 'list' as const, title: 'Mi lista de deseos', sub: wishes ? `${wishes} ${wishes === 1 ? 'idea' : 'ideas'} de regalo` : 'Todavía vacía', to: `/g/${gid}/mi-lista`, locked: false, done: wishes > 0 },
    { id: 'card-reveal', icon: 'gift' as const, title: 'Descubrir a mi amigo', sub: drawn ? (revealed ? 'Ya lo descubriste' : '¡Listo para abrir!') : 'Esperando el sorteo', to: `/g/${gid}/descubrir`, locked: !drawn, done: revealed },
    { id: 'card-their', icon: 'target' as const, title: 'Ver qué le gustaría', sub: revealed ? 'Su lista de deseos' : 'Después de descubrirlo', to: `/g/${gid}/su-lista`, locked: !revealed, done: false },
  ];

  return (
    <Screen
      cta={
        <>
          <Btn className={tour !== null ? 'is-nudge' : undefined} onClick={tour !== null ? advanceTour : () => navigate(n.to)}>{tour !== null ? (tour === TOUR.length - 1 ? 'Armar mi lista' : 'Siguiente') : n.label}</Btn>
          <button
            className="link-btn small"
            onClick={() => {
              tokens.clearParticipant(gid);
              forgetGroup(gid, 'participant');
              navigate(`/g/${gid}`);
            }}
          >
            No soy {me.name}, salir
          </button>
        </>
      }
    >
      <div className="hello" data-anim="drop">
        <span data-flip-id={`av-${me.id}`} className="hello-av">
          <Avatar seed={me.avatar} size={56} />
        </span>
        <div>
          <h1 className="title">Hola, {me.name}</h1>
          <div className="chips">
            <Chip><Icon name="calendar" size={16} /> {days > 0 ? `Faltan ${days} días` : days === 0 ? '¡Es hoy!' : 'Ya pasó'}</Chip>
            <Chip tone="gold"><Icon name="gift" size={16} /> Hasta {clp(g.budget)}</Chip>
          </div>
        </div>
      </div>
      <ol className="steps">
        {cards.map((c, i) => (
          <li key={c.id} data-anim="pop">
            <button
              className={`step-card ${c.locked ? 'is-locked' : ''} ${c.done ? 'is-done' : ''}`}
              data-flip-id={c.id}
              onClick={() => {
                if (tour !== null) return advanceTour();
                if (c.locked)
                  say({
                    text: c.id === 'card-reveal' ? 'Todavía no se hace el sorteo po. Mientras, arma tu lista; te aviso aquí al tiro cuando pase.' : 'Calma, weón: primero cacha a tu amigo secreto, y después ves su lista.',
                    mood: 'thinking',
                  });
                else navigate(c.to);
              }}
            >
              <span className="step-num">{c.done ? <Icon name="check" size={18} label="Listo" /> : String(i + 1).padStart(2, '0')}</span>
              <span className="step-icon" aria-hidden="true">
                <Icon name={c.locked ? 'lock' : c.icon} size={26} />
              </span>
              <span className="step-text">
                <strong>{c.title}</strong>
                <small>{c.sub}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="fine" data-anim="pop">
        Intercambio el {prettyDate(g.date)}.
      </p>
    </Screen>
  );
}

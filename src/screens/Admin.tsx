import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useJose } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Chip, Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { Avatar } from '../components/Avatar';
import { Dialog } from '../components/Dialog';
import { PinInput, type PinHandle } from '../components/PinInput';
import { NamesEditor, type NameEntry } from '../components/NamesEditor';
import { api, clp, daysUntil, joseError, prettyDate, type PublicGroup } from '../lib/api';
import { isAuthError, useAdmin, useGroup, put } from '../lib/data';
import { drawGuard, rememberGroup, tokens } from '../lib/storage';
import { gsap, motion } from '../lib/gsap';
import { Icon } from '../components/Icon';

export const groupLink = (gid: string) => `${window.location.origin}/g/${gid}`;

export function shareWhatsApp(g: PublicGroup) {
  const text = `🎁 ¡Amigo secreto "${g.title}"! Entra aquí, toca tu nombre y José Miguel te guía: ${groupLink(g.id)}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function AdminLogin({ gid, onDone }: { gid: string; onDone: () => void }) {
  useScreenMeta({ back: '/', backLabel: 'Volver al inicio' });
  const { say } = useJose();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<PinHandle>(null);
  const { data: group } = useGroup(gid);
  useEffect(() => {
    say({ text: 'Este panel es del organizador, weón, no cualquier sapo entra. Pon tu PIN de organizador.', point: '.pin' });
  }, [say]);
  const submit = async (v: string) => {
    setBusy(true);
    try {
      const r = await api<{ token: string }>(`/groups/${gid}/admin`, { body: { pin: v } });
      tokens.setAdmin(gid, r.token);
      await ref.current?.success();
      onDone();
    } catch (e) {
      ref.current?.shake();
      setPin('');
      say({ text: joseError(e), mood: 'worried' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen cta={<Btn busy={busy} blocked={pin.length < 4} onBlocked={() => say({ text: 'Ya po, weón, escribe los 4 números de tu PIN.', mood: 'worried', point: '.pin' })} onClick={() => submit(pin)}>Entrar</Btn>}>
      <h1 className="title" data-anim="drop">
        {group?.title || 'Panel del organizador'}
      </h1>
      <div data-anim="pop">
        <PinInput ref={ref} value={pin} onChange={setPin} onDone={submit} label="PIN de organizador" autoFocus />
      </div>
    </Screen>
  );
}

const LockCtx = createContext<() => void>(() => {});
/** Cierra el panel (borra la sesión de organizador y vuelve a pedir el PIN). */
export const useAdminLock = () => useContext(LockCtx);

/** Toda pantalla de administración pasa por aquí: sin sesión válida, se pide el PIN. */
export function AdminGate({ gid, children }: { gid: string; children: ReactNode }) {
  const [ok, setOk] = useState(() => !!tokens.admin(gid));
  const lock = useCallback(() => {
    tokens.clearAdmin(gid);
    setOk(false);
  }, [gid]);
  if (!ok) return <AdminLogin gid={gid} onDone={() => setOk(true)} />;
  return <LockCtx.Provider value={lock}>{children}</LockCtx.Provider>;
}

export function Admin({ gid }: { gid: string }) {
  return (
    <AdminGate gid={gid}>
      <AdminPanel gid={gid} />
    </AdminGate>
  );
}

function AdminPanel({ gid }: { gid: string }) {
  useScreenMeta({ back: '/', step: 4, steps: 4, backLabel: 'Volver al inicio' });
  const lock = useAdminLock();
  const { navigate } = useRouter();
  const { say } = useJose();
  const { data, error, reload, mutate } = useAdmin(gid);
  const [confirm, setConfirm] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const g = data?.group;

  useEffect(() => {
    if (error) {
      if (isAuthError(error)) lock();
      else say({ text: joseError(error), mood: 'worried' });
    }
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!g) return;
    rememberGroup({ gid, role: 'admin', title: g.title });
    put(`group:${gid}`, g);
    if (g.drawn) say({ text: 'El sorteo ya está hecho, weón. Manda el link al grupo pa que cada uno cache a quién le tocó.', point: '.screen-cta .btn' });
    else say({ text: 'Tírale este link al grupo pa que armen su lista. Cuando querai, toca Hacer el sorteo.', point: '#share-copy' });
  }, [g?.drawn, !!g]); // eslint-disable-line react-hooks/exhaustive-deps

  // refrescar estados cada tanto
  useEffect(() => {
    const iv = window.setInterval(reload, 20000);
    return () => window.clearInterval(iv);
  }, [reload]);

  const copy = async (e: React.MouseEvent) => {
    try {
      await navigator.clipboard.writeText(groupLink(gid));
      say({ text: '¡Listo el link, conchetumare! Pégalo en el grupo de WhatsApp de los weones.', mood: 'celebrating' });
      const t = e.currentTarget as HTMLElement;
      if (!motion.reduced) gsap.fromTo(t, { rotation: -6 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
    } catch {
      say({ text: 'Puta, no pude copiarlo solo. Mantén apretao el link de arriba y elige Copiar.', mood: 'worried', point: '.share-url' });
    }
  };

  const doReset = async (pid: string) => {
    try {
      const r = await api<{ group: PublicGroup }>(`/admin/reset/${pid}`, { method: 'POST', token: tokens.admin(gid) });
      mutate({ ...data!, group: r.group });
      const p = r.group.participants.find((x) => x.id === pid);
      say({ text: `Listo, le reinicié el PIN al weón del ${p?.name}. Dile que entre al link y se haga uno nuevo.`, mood: 'celebrating' });
    } catch (e) {
      say({ text: joseError(e), mood: 'worried' });
    }
    setResetting(null);
  };

  if (!g) return <Screen><div className="loading" data-anim="pop">Cargando…</div></Screen>;
  const days = daysUntil(g.date);
  const claimed = g.participants.filter((p) => p.claimed).length;

  return (
    <Screen
      cta={
        g.drawn ? (
          <Btn onClick={() => shareWhatsApp(g)}>Compartir por WhatsApp</Btn>
        ) : (
          <Btn
            onClick={() => {
              setConfirm(true);
              say({ text: 'Ojo al charqui, weón, que después de sortear no hay vuelta atrás. ¿Están toos los culiaos? Si es así, toca Sí, sortear.', mood: 'worried' });
            }}
          >
            Hacer el sorteo
          </Btn>
        )
      }
    >
      <div className="group-head" data-anim="drop">
        <h1 className="title">{g.title}</h1>
        <div className="chips">
          <Chip><Icon name="calendar" size={16} /> {prettyDate(g.date)}</Chip>
          <Chip tone="gold"><Icon name="gift" size={16} /> Hasta {clp(g.budget)}</Chip>
          {days >= 0 && <Chip tone="green">{days === 0 ? '¡Es hoy!' : `Faltan ${days} días`}</Chip>}
        </div>
      </div>

      <div className="card share-card" data-anim="pop">
        <div className="card-title">Link para el grupo</div>
        <div className="share-url" tabIndex={0}>
          {groupLink(gid)}
        </div>
        <div className="row">
          <Btn variant="soft" id="share-copy" anim={false} onClick={copy}>
            Copiar link
          </Btn>
          <Btn variant="soft" anim={false} onClick={() => shareWhatsApp(g)}>
            WhatsApp
          </Btn>
        </div>
      </div>

      <div className="group-label" data-anim="pop">
        Participantes · {claimed} de {g.participants.length} ya entraron
      </div>
      <ul className="people">
        {g.participants.map((p) => (
          <li key={p.id} className="person" data-anim="pop">
            <Avatar seed={p.avatar} size={44} />
            <span className="person-name">{p.name}</span>
            <span className={`badge ${p.claimed ? 'badge-ok' : ''}`}>{p.claimed ? 'Entró' : 'Aún no'}</span>
            <span className="badge" aria-label={`${data.wishCounts[p.id] || 0} deseos`}><Icon name="gift" size={14} /> {data.wishCounts[p.id] || 0}</span>
            {p.claimed && (
              <button
                className="link-btn"
                onClick={() => {
                  setResetting(p.id);
                  say({ text: `¿El weón del ${p.name} se olvidó el PIN? Si se lo reinicio, tiene que hacerse uno nuevo. Su sorteo no cambia, tranqui.`, mood: 'thinking' });
                }}
              >
                Reiniciar PIN
              </button>
            )}
          </li>
        ))}
      </ul>
      {!g.drawn && (
        <Btn variant="ghost" anim="pop" onClick={() => navigate(`/g/${gid}/admin/editar`)}>
          <Icon name="edit" /> Editar participantes
        </Btn>
      )}
      <button
        className="link-btn small lock-btn"
        data-anim="pop"
        onClick={() => {
          lock();
          navigate('/');
        }}
      >
        <Icon name="lock" size={16} /> Cerrar el panel
      </button>

      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <p className="dialog-text">¿Hacemos el sorteo con estas {g.participants.length} personas?</p>
        <div className="dialog-faces">
          {g.participants.slice(0, 12).map((p) => (
            <Avatar key={p.id} seed={p.avatar} size={34} alive={false} />
          ))}
        </div>
        <Btn
          anim={false}
          onClick={() => {
            drawGuard.arm(gid);
            navigate(`/g/${gid}/admin/sorteo`);
          }}
        >
          Sí, ¡sortear!
        </Btn>
        <Btn
          variant="ghost"
          anim={false}
          onClick={() => {
            setConfirm(false);
            say({ text: 'Dale, sin apuro, weón. Cuando estén toos, toca Hacer el sorteo.', point: '.screen-cta .btn' });
          }}
        >
          Todavía no
        </Btn>
      </Dialog>
      <Dialog open={!!resetting} onClose={() => setResetting(null)}>
        <p className="dialog-text">¿Reiniciar el PIN de {g.participants.find((p) => p.id === resetting)?.name}?</p>
        <Btn anim={false} onClick={() => doReset(resetting!)}>
          Sí, reiniciar
        </Btn>
        <Btn variant="ghost" anim={false} onClick={() => setResetting(null)}>
          No, dejarlo así
        </Btn>
      </Dialog>
    </Screen>
  );
}

export function AdminEdit({ gid }: { gid: string }) {
  return (
    <AdminGate gid={gid}>
      <AdminEditInner gid={gid} />
    </AdminGate>
  );
}

function AdminEditInner({ gid }: { gid: string }) {
  useScreenMeta({ back: `/g/${gid}/admin`, step: 4, steps: 4 });
  const lock = useAdminLock();
  const { navigate } = useRouter();
  const { say } = useJose();
  const { data, error } = useAdmin(gid);
  useEffect(() => {
    if (error && isAuthError(error)) lock();
  }, [error, lock]);
  const [list, setList] = useState<NameEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !list) setList(data.group.participants.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })));
  }, [data, list]);
  useEffect(() => {
    say({ text: 'Mete o saca gente, y toca Guardar cambios cuando estí listo.', point: '#add-name' });
  }, [say]);
  if (!list) return <Screen><div className="loading">Cargando…</div></Screen>;
  return (
    <Screen
      cta={
        <Btn
          busy={busy}
          blocked={list.length < 3}
          onBlocked={() => say({ text: 'Necesito mínimo 3 weones po. Mete a alguien más arriba.', mood: 'worried' })}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/admin/participants`, { method: 'PUT', token: tokens.admin(gid), body: { participants: list } });
              say({ text: '¡Guardao, la raja, weón!', mood: 'celebrating' });
              navigate(`/g/${gid}/admin`);
            } catch (e) {
              if (isAuthError(e)) lock();
              say({ text: joseError(e), mood: 'worried' });
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar cambios
        </Btn>
      }
    >
      <h1 className="title" data-anim="drop">
        Editar participantes
      </h1>
      <NamesEditor value={list} onChange={setList} onError={(text) => say({ text, mood: 'worried' })} />
    </Screen>
  );
}

import { useEffect, useRef, useState } from 'react';
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
import { rememberGroup, tokens } from '../lib/storage';
import { gsap, motion } from '../lib/gsap';

export const groupLink = (gid: string) => `${window.location.origin}/g/${gid}`;

export function shareWhatsApp(g: PublicGroup) {
  const text = `🎁 ¡Amigo secreto "${g.title}"! Entra aquí, toca tu nombre y José Miguel te guía: ${groupLink(g.id)}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function AdminLogin({ gid, onDone }: { gid: string; onDone: () => void }) {
  const { say } = useJose();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<PinHandle>(null);
  const { data: group } = useGroup(gid);
  useEffect(() => {
    say({ text: 'Pon tu PIN de organizador para entrar al panel.', point: '.pin' });
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
    <Screen cta={<Btn busy={busy} blocked={pin.length < 4} onBlocked={() => say({ text: 'Escribe los 4 números de tu PIN.', mood: 'worried', point: '.pin' })} onClick={() => submit(pin)}>Entrar</Btn>}>
      <h1 className="title" data-anim="drop">
        {group?.title || 'Panel del organizador'}
      </h1>
      <div data-anim="pop">
        <PinInput ref={ref} value={pin} onChange={setPin} onDone={submit} label="PIN de organizador" autoFocus />
      </div>
    </Screen>
  );
}

export function Admin({ gid }: { gid: string }) {
  const [hasToken, setHasToken] = useState(!!tokens.admin(gid));
  useScreenMeta({ back: '/', step: 4, steps: 4, backLabel: 'Volver al inicio' });
  if (!hasToken) return <AdminLogin gid={gid} onDone={() => setHasToken(true)} />;
  return <AdminPanel gid={gid} onLogout={() => setHasToken(false)} />;
}

function AdminPanel({ gid, onLogout }: { gid: string; onLogout: () => void }) {
  const { navigate } = useRouter();
  const { say } = useJose();
  const { data, error, reload, mutate } = useAdmin(gid);
  const [confirm, setConfirm] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const g = data?.group;

  useEffect(() => {
    if (error) {
      if (isAuthError(error)) {
        tokens.clearAdmin(gid);
        onLogout();
      } else say({ text: joseError(error), mood: 'worried' });
    }
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!g) return;
    rememberGroup({ gid, role: 'admin', title: g.title });
    put(`group:${gid}`, g);
    if (g.drawn) say({ text: 'El sorteo ya está hecho. Manda el link al grupo para que cada uno descubra a quién le tocó.', point: '.screen-cta .btn' });
    else say({ text: 'Manda este link al grupo para que armen su lista. Cuando quieras, toca Hacer el sorteo.', point: '#share-copy' });
  }, [g?.drawn, !!g]); // eslint-disable-line react-hooks/exhaustive-deps

  // refrescar estados cada tanto
  useEffect(() => {
    const iv = window.setInterval(reload, 20000);
    return () => window.clearInterval(iv);
  }, [reload]);

  const copy = async (e: React.MouseEvent) => {
    try {
      await navigator.clipboard.writeText(groupLink(gid));
      say({ text: '¡Link copiado! Pégalo en el grupo de WhatsApp de tus amigos.', mood: 'celebrating' });
      const t = e.currentTarget as HTMLElement;
      if (!motion.reduced) gsap.fromTo(t, { rotation: -6 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' });
    } catch {
      say({ text: 'No pude copiarlo solo. Mantén apretado el link de arriba y elige Copiar.', mood: 'worried', point: '.share-url' });
    }
  };

  const doReset = async (pid: string) => {
    try {
      const r = await api<{ group: PublicGroup }>(`/admin/reset/${pid}`, { method: 'POST', token: tokens.admin(gid) });
      mutate({ ...data!, group: r.group });
      const p = r.group.participants.find((x) => x.id === pid);
      say({ text: `Listo, reinicié el PIN de ${p?.name}. Dile que entre al link y cree uno nuevo.`, mood: 'celebrating' });
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
              say({ text: 'Ojo, que después de sortear no hay vuelta atrás. ¿Están todos? Si es así, toca Sí, sortear.', mood: 'worried' });
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
          <Chip>📅 {prettyDate(g.date)}</Chip>
          <Chip tone="gold">💰 {clp(g.budget)}</Chip>
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
            <span className="badge">🎁 {data.wishCounts[p.id] || 0}</span>
            {p.claimed && (
              <button
                className="link-btn"
                onClick={() => {
                  setResetting(p.id);
                  say({ text: `¿${p.name} olvidó su PIN? Si lo reinicio, tendrá que crear uno nuevo. Su sorteo no cambia.`, mood: 'thinking' });
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
          ✏️ Editar participantes
        </Btn>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <p className="dialog-text">¿Hacemos el sorteo con estas {g.participants.length} personas?</p>
        <div className="dialog-faces">
          {g.participants.slice(0, 12).map((p) => (
            <Avatar key={p.id} seed={p.avatar} size={34} alive={false} />
          ))}
        </div>
        <Btn anim={false} onClick={() => navigate(`/g/${gid}/admin/sorteo`)}>
          Sí, ¡sortear!
        </Btn>
        <Btn
          variant="ghost"
          anim={false}
          onClick={() => {
            setConfirm(false);
            say({ text: 'Dale, sin apuro. Cuando estén todos, toca Hacer el sorteo.', point: '.screen-cta .btn' });
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
  useScreenMeta({ back: `/g/${gid}/admin`, step: 4, steps: 4 });
  const { navigate } = useRouter();
  const { say } = useJose();
  const { data } = useAdmin(gid);
  const [list, setList] = useState<NameEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !list) setList(data.group.participants.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })));
  }, [data, list]);
  useEffect(() => {
    say({ text: 'Agrega o quita personas, y toca Guardar cambios cuando termines.', point: '#add-name' });
  }, [say]);
  if (!list) return <Screen><div className="loading">Cargando…</div></Screen>;
  return (
    <Screen
      cta={
        <Btn
          busy={busy}
          blocked={list.length < 3}
          onBlocked={() => say({ text: 'Necesito al menos 3 personas. Agrega a alguien más arriba.', mood: 'worried' })}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/admin/participants`, { method: 'PUT', token: tokens.admin(gid), body: { participants: list } });
              say({ text: '¡Cambios guardados!', mood: 'celebrating' });
              navigate(`/g/${gid}/admin`);
            } catch (e) {
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

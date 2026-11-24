import { useEffect, useRef, useState } from 'react';
import { useJose, useSay } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { Field } from '../components/Field';
import { NamesEditor } from '../components/NamesEditor';
import { clearDraft, getDraft, saveDraft, type Draft } from '../lib/draft';
import { api, clp, joseError, type PublicGroup } from '../lib/api';
import { account, rememberGroup, tokens } from '../lib/storage';
import { put } from '../lib/data';
import { confetti } from '../components/confetti';
import { adminPath } from '../lib/paths';
import { AccountForm } from '../components/AccountForm';

function useDraft(): [Draft, (d: Partial<Draft>) => void] {
  const [d, setD] = useState(getDraft);
  const update = (p: Partial<Draft>) =>
    setD((prev) => {
      const n = { ...prev, ...p };
      saveDraft(n);
      return n;
    });
  return [d, update];
}

export function CreateNames() {
  useScreenMeta({ back: '/', step: 1, steps: 4 });
  const { navigate } = useRouter();
  const { say } = useJose();
  const [d, update] = useDraft();
  const n = d.names.length;
  const band = n === 0 ? 0 : n < 3 ? 1 : 2;
  useEffect(() => {
    if (band === 0)
      say({ text: 'Escribe el nombre de cada uno que juega y toca Agregar. Si tú también le hací, métete.', point: '#add-name' });
    else if (band === 1) say({ text: `¡Vamos bien, weón! Necesito mínimo 3; mete ${3 - n === 1 ? 'uno más' : 'dos más'}.`, mood: 'idle' });
    else say({ text: 'Buena la lista, hermano. Toca un avatar si lo querí cambiar, o toca Siguiente.', point: '.screen-cta .btn' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band]);

  return (
    <Screen
      cta={
        <Btn
          blocked={n < 3}
          onBlocked={() => say({ text: `Me ${3 - n === 1 ? 'falta' : 'faltan'} ${3 - n} ${3 - n === 1 ? 'weón' : 'weones'} pa poder sortear, culiao. Escribe los nombres arriba y toca Agregar.`, mood: 'worried' })}
          onClick={() => navigate('/crear/2')}
        >
          Siguiente
        </Btn>
      }
    >
      <h1 className="title" data-anim="drop">
        ¿Quiénes juegan?
      </h1>
      <NamesEditor value={d.names} onChange={(names) => update({ names })} onError={(text) => say({ text, mood: 'worried' })} />
      {n > 0 && (
        <p className="count" data-anim="pop">
          {n} {n === 1 ? 'persona' : 'personas'}
        </p>
      )}
    </Screen>
  );
}

const QUICK = [10000, 15000, 20000, 30000];

export function CreateDetails() {
  useScreenMeta({ back: '/crear/1', step: 2, steps: 4 });
  const { navigate } = useRouter();
  const { say } = useJose();
  const [d, update] = useDraft();
  const [custom, setCustom] = useState(d.budget && !QUICK.includes(d.budget) ? String(d.budget) : '');
  useSay({ text: 'Elige el día del intercambio y cuántas lucas gastar más o menos. Después toca Siguiente.', point: '#date-field' });
  const today = new Date();
  const min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const ready = !!d.date && !!d.budget;

  return (
    <Screen
      cta={
        <Btn
          blocked={!ready}
          onBlocked={() =>
            say({
              text: !d.date ? 'Me falta la fecha po. Toca el cuadro de fecha y elige un día en el calendario.' : '¿Y las lucas, weón? Toca uno de los montos o escribe otro.',
              mood: 'worried',
              point: !d.date ? '#date-field' : '.budget-grid',
            })
          }
          onClick={() => navigate('/crear/3')}
        >
          Siguiente
        </Btn>
      }
    >
      <h1 className="title" data-anim="drop">
        Fecha y presupuesto
      </h1>
      <Field label="Nombre del grupo (opcional)" placeholder="Ej: Amigos del colegio" value={d.title} maxLength={40} onChange={(e) => update({ title: e.target.value })} />
      <Field
        id="date-field"
        label="¿Qué día es el intercambio?"
        type="date"
        min={min}
        value={d.date}
        onChange={(e) => {
          update({ date: e.target.value });
          if (e.target.value && !d.budget) say({ text: '¡Anotao! Ahora elige cuántas lucas gastar más o menos.', point: '.budget-grid' });
        }}
      />
      <div className="group-label" data-anim="pop">
        Presupuesto sugerido
      </div>
      <div className="budget-grid">
        {QUICK.map((b) => (
          <Btn
            key={b}
            variant="soft"
            className={d.budget === b && !custom ? 'is-selected' : undefined}
            aria-pressed={d.budget === b && !custom}
            anim="pop"
            onClick={() => {
              setCustom('');
              update({ budget: b });
              if (d.date) say({ text: `${clp(b)}, la raja, conchetumare. Toca Siguiente pa seguir.`, point: '.screen-cta .btn' });
            }}
          >
            {clp(b)}
          </Btn>
        ))}
      </div>
      <Field
        label="Otro monto"
        inputMode="numeric"
        placeholder="Ej: 25000"
        value={custom}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 8);
          setCustom(v);
          update({ budget: v ? Number(v) : null });
        }}
      />
    </Screen>
  );
}

export function CreateAccount() {
  useScreenMeta({ back: '/crear/2', step: 3, steps: 4 });
  const { navigate } = useRouter();
  const { say } = useJose();
  const [user, setUser] = useState(() => account.username());
  const [busy, setBusy] = useState(false);
  useSay(
    user
      ? { text: `Lo guardo en tu cuenta, ${user}. Toca el botón y armo el amigo secreto.`, point: '.screen-cta .btn' }
      : {
          text: 'Crea tu cuenta de organizador con un usuario y una contraseña. Así entrai a tu grupo desde cualquier celular, y ni así ves el sorteo.',
          point: '#acct-user',
        },
  );

  const create = async () => {
    const d = getDraft();
    setBusy(true);
    say({ text: 'Armando toa la weá… dame un segundo, no me apurí, culiao.', mood: 'thinking' });
    try {
      const res = await api<{ group: PublicGroup; token: string }>('/groups', {
        token: account.token(),
        body: {
          title: d.title,
          date: d.date,
          budget: d.budget,
          participants: d.names.map((x) => ({ name: x.name, avatar: x.avatar })),
        },
      });
      tokens.setAdmin(res.group.id, res.token);
      rememberGroup({ gid: res.group.id, role: 'admin', title: res.group.title });
      put(`group:${res.group.id}`, res.group);
      clearDraft();
      const r = document.querySelector('.title')?.getBoundingClientRect();
      if (r) confetti(r.left + r.width / 2, r.top, { count: 50 });
      navigate(adminPath(res.group.id), { replace: true });
    } catch (e) {
      setBusy(false);
      const code = (e as { code?: string }).code;
      if (code === 'need_account') {
        // la sesión venció: volver a pedir la cuenta
        account.clear();
        setUser(null);
      }
      say({ text: joseError(e), mood: 'worried' });
      if (code === 'bad_date' || code === 'bad_budget') navigate('/crear/2');
      if (code === 'too_few' || code === 'duplicate_name' || code === 'empty_name') navigate('/crear/1');
    }
  };

  if (!user)
    return (
      <Screen>
        <h1 className="title" data-anim="drop">
          Tu cuenta de organizador
        </h1>
        <AccountForm
          submitLabel={(m) => (m === 'register' ? 'Crear cuenta y grupo' : 'Entrar y crear grupo')}
          onDone={async (u) => {
            setUser(u);
            await create();
          }}
        />
      </Screen>
    );

  return (
    <Screen
      cta={
        <>
          <Btn busy={busy} onClick={create}>
            Crear amigo secreto
          </Btn>
          <button
            className="link-btn small"
            onClick={() => {
              account.clear();
              setUser(null);
            }}
          >
            No soy {user}, usar otra cuenta
          </button>
        </>
      }
    >
      <h1 className="title" data-anim="drop">
        Todo listo
      </h1>
      <p className="fine" data-anim="pop">
        El grupo queda guardado en tu cuenta <strong>{user}</strong>. Lo vas a encontrar en Mis grupos desde cualquier celular.
      </p>
    </Screen>
  );
}

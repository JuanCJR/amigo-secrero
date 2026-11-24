import { useEffect, useRef, useState } from 'react';
import { useJose, useSay } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { Field } from '../components/Field';
import { NamesEditor } from '../components/NamesEditor';
import { PinInput, type PinHandle } from '../components/PinInput';
import { clearDraft, getDraft, saveDraft, type Draft } from '../lib/draft';
import { api, clp, joseError, type PublicGroup } from '../lib/api';
import { rememberGroup, tokens } from '../lib/storage';
import { put } from '../lib/data';
import { confetti } from '../components/confetti';

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

export function CreatePin() {
  useScreenMeta({ back: '/crear/2', step: 3, steps: 4 });
  const { navigate } = useRouter();
  const { say } = useJose();
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<PinHandle>(null);
  useSay({ text: 'Inventa un PIN de 4 números pa volver a entrar como organizador. Ni con ese se ve el sorteo: nadie lo puede sapear.', mood: 'idle' });

  const submit = async (value: string) => {
    if (!first) {
      setFirst(value);
      setPin('');
      say({ text: 'Bien ahí. Ahora escríbelo otra vez, pa estar seguros.', point: '.pin' });
      return;
    }
    if (value !== first) {
      pinRef.current?.shake();
      setFirst(null);
      setPin('');
      say({ text: 'No calzan, weón, la cagaste. Escribe un PIN nuevo desde cero.', mood: 'worried' });
      return;
    }
    const d = getDraft();
    setBusy(true);
    say({ text: 'Armando toa la weá… dame un segundo, no me apurí, culiao.', mood: 'thinking' });
    try {
      const res = await api<{ group: PublicGroup; token: string }>('/groups', {
        body: {
          title: d.title,
          date: d.date,
          budget: d.budget,
          adminPin: value,
          participants: d.names.map((x) => ({ name: x.name, avatar: x.avatar })),
        },
      });
      await pinRef.current?.success();
      tokens.setAdmin(res.group.id, res.token);
      rememberGroup({ gid: res.group.id, role: 'admin', title: res.group.title });
      put(`group:${res.group.id}`, res.group);
      clearDraft();
      const r = document.querySelector('.pin')?.getBoundingClientRect();
      if (r) confetti(r.left + r.width / 2, r.top, { count: 50 });
      navigate(`/g/${res.group.id}/admin`, { replace: true });
    } catch (e) {
      setBusy(false);
      setFirst(null);
      setPin('');
      pinRef.current?.shake();
      say({ text: joseError(e), mood: 'worried' });
      const code = (e as { code?: string }).code;
      if (code === 'bad_date' || code === 'bad_budget') navigate('/crear/2');
      if (code === 'too_few' || code === 'duplicate_name' || code === 'empty_name') navigate('/crear/1');
    }
  };

  return (
    <Screen
      cta={
        <Btn
          busy={busy}
          blocked={pin.length < 4}
          onBlocked={() => say({ text: 'Ya po, escribe los 4 números del PIN en las casillas.', point: '.pin', mood: 'worried' })}
          onClick={() => submit(pin)}
        >
          {first ? 'Crear amigo secreto' : 'Siguiente'}
        </Btn>
      }
    >
      <h1 className="title" data-anim="drop">
        {first ? 'Repite tu PIN' : 'Tu PIN de organizador'}
      </h1>
      <div data-anim="pop">
        <PinInput ref={pinRef} value={pin} onChange={setPin} onDone={submit} label="PIN de organizador, 4 números" autoFocus />
      </div>
    </Screen>
  );
}

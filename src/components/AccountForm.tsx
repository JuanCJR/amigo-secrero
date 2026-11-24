import { useState, type FormEvent } from 'react';
import { useJose } from '../jose/JoseProvider';
import { api, joseError } from '../lib/api';
import { account } from '../lib/storage';
import { Field } from './Field';
import { Btn } from './Btn';

type Mode = 'register' | 'login';

/** Registro / ingreso del organizador con usuario y contraseña. La sesión queda en el dispositivo. */
export function AccountForm({
  initialMode = 'register',
  submitLabel,
  onDone,
}: {
  initialMode?: Mode;
  /** texto del botón (por defecto "Crear cuenta" / "Entrar") */
  submitLabel?: (mode: Mode) => string;
  onDone: (username: string) => void | Promise<void>;
}) {
  const { say } = useJose();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      say({ text: 'Ya po, weón, escribe tu usuario y tu contraseña.', mood: 'worried', point: username.trim() ? '#acct-pass' : '#acct-user' });
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ token: string; user: { username: string } }>(`/auth/${mode}`, {
        body: { username: username.trim(), password },
      });
      account.set(r.token, r.user.username);
      await onDone(r.user.username);
    } catch (err) {
      say({ text: joseError(err), mood: 'worried' });
      setBusy(false);
    }
  };

  const label = submitLabel ? submitLabel(mode) : mode === 'register' ? 'Crear cuenta' : 'Entrar';
  return (
    <form className="account-form" onSubmit={submit} noValidate>
      <Field
        id="acct-user"
        label="Usuario"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={24}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        hint={mode === 'register' ? 'De 3 a 24 letras o números, sin espacios.' : undefined}
      />
      <Field
        id="acct-pass"
        type={show ? 'text' : 'password'}
        label="Contraseña"
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        maxLength={100}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={mode === 'register' ? 'Mínimo 8 caracteres.' : undefined}
      />
      <label className="check">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Mostrar contraseña
      </label>
      <Btn type="submit" busy={busy} anim="pop">
        {label}
      </Btn>
      <button type="button" className="link-btn" onClick={() => setMode((m) => (m === 'register' ? 'login' : 'register'))}>
        {mode === 'register' ? 'Ya tengo cuenta, entrar' : 'No tengo cuenta, crear una'}
      </button>
    </form>
  );
}

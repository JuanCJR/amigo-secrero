import { useEffect, useState } from 'react';
import { useJose } from '../jose/JoseProvider';
import { useRouter } from '../lib/router';
import { useScreenMeta } from '../components/Shell';
import { Screen } from '../components/Screen';
import { Btn } from '../components/Btn';
import { AccountForm } from '../components/AccountForm';
import { api, joseError, prettyDate } from '../lib/api';
import { account } from '../lib/storage';
import { adminPath } from '../lib/paths';

interface AccountGroup {
  id: string;
  title: string;
  date: string;
  drawn: boolean;
  people: number;
}

/** Cierra la sesión de la cuenta en este dispositivo. */
export async function logout() {
  const token = account.token();
  account.clear();
  if (token) await api('/auth/logout', { method: 'POST', token }).catch(() => {});
}

/** "Mis grupos": la cuenta del organizador muestra sus grupos desde cualquier dispositivo. */
export function Organizer() {
  useScreenMeta({ back: '/' });
  const { navigate } = useRouter();
  const { say } = useJose();
  const [user, setUser] = useState(() => account.username());
  const [groups, setGroups] = useState<AccountGroup[] | null>(null);

  useEffect(() => {
    if (!user) {
      say({ text: 'Entra con tu usuario y contraseña de organizador, y te muestro tus grupos.', point: '#acct-user' });
      return;
    }
    let alive = true;
    api<{ user: { username: string }; groups: AccountGroup[] }>('/account', { token: account.token() })
      .then((r) => {
        if (!alive) return;
        setGroups(r.groups);
        say(
          r.groups.length
            ? { text: `¡Wena, ${r.user.username}! Toca un grupo pa abrir su panel, o arma uno nuevo.`, point: '.known-group' }
            : { text: `¡Wena, ${r.user.username}! Todavía no tenís grupos. Toca el botón pa armar uno.`, point: '.screen-cta .btn' },
        );
      })
      .catch((e) => {
        if (!alive) return;
        if ((e as { status?: number }).status === 401) {
          account.clear();
          setUser(null);
          return;
        }
        say({ text: joseError(e), mood: 'worried' });
      });
    return () => {
      alive = false;
    };
  }, [user, say]);

  if (!user)
    return (
      <Screen>
        <h1 className="title" data-anim="drop">
          Organizador
        </h1>
        <AccountForm initialMode="login" onDone={(u) => setUser(u)} />
      </Screen>
    );

  return (
    <Screen
      cta={
        <>
          <Btn onClick={() => navigate('/crear/1')}>Armar un amigo secreto</Btn>
          <button
            className="link-btn small"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Cerrar sesión ({user})
          </button>
        </>
      }
    >
      <h1 className="title" data-anim="drop">
        Mis grupos
      </h1>
      {groups === null && <div className="loading">Cargando…</div>}
      {groups?.length === 0 && <p className="fine">Aquí van a aparecer los grupos que armes con esta cuenta.</p>}
      {groups?.map((g) => (
        <button key={g.id} className="known-group" data-anim="pop" onClick={() => navigate(adminPath(g.id))}>
          <strong>{g.title}</strong>
          <small>
            {prettyDate(g.date)} · {g.people} personas · {g.drawn ? 'sorteo hecho' : 'falta sortear'}
          </small>
        </button>
      ))}
    </Screen>
  );
}

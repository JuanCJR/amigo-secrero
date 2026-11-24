import { useEffect } from 'react';
import { Router, match, useRouter } from './lib/router';
import { JoseProvider, useJose } from './jose/JoseProvider';
import { Shell, useScreenMeta } from './components/Shell';
import { Background } from './components/Background';
import { Screen } from './components/Screen';
import { Btn } from './components/Btn';
import { Welcome } from './screens/Welcome';
import { CreateDetails, CreateNames, CreatePin } from './screens/Create';
import { Admin, AdminEdit } from './screens/Admin';
import { DrawScene } from './screens/DrawScene';
import { Home, Join, Pin } from './screens/Participant';
import { MyList, TheirList } from './screens/Lists';
import { Reveal } from './screens/Reveal';

function NotFound() {
  useScreenMeta({ back: '/' });
  const { say } = useJose();
  const { navigate } = useRouter();
  useEffect(() => say({ text: 'Chuta, me perdí, hermanito: esta página no existe po. Toca el botón y te llevo al inicio al tiro.', mood: 'worried' }), [say]);
  return <Screen cta={<Btn onClick={() => navigate('/')}>Ir al inicio</Btn>}>{null}</Screen>;
}

function route(path: string) {
  let m: Record<string, string> | null;
  if (path === '/' || path === '') return <Welcome />;
  if (match('/crear/1', path)) return <CreateNames />;
  if (match('/crear/2', path)) return <CreateDetails />;
  if (match('/crear/3', path)) return <CreatePin />;
  if ((m = match('/g/:gid/admin', path))) return <Admin gid={m.gid} />;
  if ((m = match('/g/:gid/admin/editar', path))) return <AdminEdit gid={m.gid} />;
  if ((m = match('/g/:gid/admin/sorteo', path))) return <DrawScene gid={m.gid} />;
  if ((m = match('/g/:gid', path))) return <Join gid={m.gid} />;
  if ((m = match('/g/:gid/pin/:pid', path))) return <Pin gid={m.gid} pid={m.pid} />;
  if ((m = match('/g/:gid/inicio', path))) return <Home gid={m.gid} />;
  if ((m = match('/g/:gid/mi-lista', path))) return <MyList gid={m.gid} />;
  if ((m = match('/g/:gid/descubrir', path))) return <Reveal gid={m.gid} />;
  if ((m = match('/g/:gid/su-lista', path))) return <TheirList gid={m.gid} />;
  return <NotFound />;
}

export function App() {
  return (
    <JoseProvider>
      <Background />
      <Router>
        {(path) => (
          <Shell>
            <main className="screen" key={path}>
              {route(path)}
            </main>
          </Shell>
        )}
      </Router>
    </JoseProvider>
  );
}

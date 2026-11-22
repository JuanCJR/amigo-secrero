import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Ambient } from './components/Ambient';
import { MascotLayer } from './mascot/MascotLayer';
import { Avatar } from './components/Avatar';
import { RightCtx } from './components/Screen';
import { AppCtx, type Ctx, type Reveal, type Route } from './ctx';
import { api, flag, tokens, type Person, type PubState, type Wish } from './api';
import { Flip, prefersReduced } from './anim/gsap';
import { Loading, Pin, RevealScreen, Theirs, Wait, Welcome, Who, WishScreen } from './screens/Participant';
import { OrganizerApp } from './screens/Organizer';
import { DemoBar } from './demo/DemoBar';

function MeChip({ me, onClick }: { me: Person; onClick: () => void }) {
  return (
    <button className="me-chip" onClick={onClick} aria-label={`Soy ${me.name}. Toca para cambiar de persona`}>
      <Avatar p={me} size={44} />
    </button>
  );
}

function ParticipantApp() {
  const [pub, setPub] = useState<PubState | null>(null);
  const [me, setMe] = useState<Person | null>(null);
  const [wishes, setWishesState] = useState<Wish[]>([]);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const stack = useRef<Route[]>([]);
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);

  const refresh = useCallback(async () => {
    try { const s = await api<PubState>('/state'); setPub(s); return s; } catch { return null; }
  }, []);

  const showRoute = (r: Route, push: boolean, replace = false) => {
    flipState.current = Flip.getState('[data-flip-id]');
    if (replace) stack.current[stack.current.length - 1] = r;
    else if (push) stack.current.push(r);
    setRoute(r);
  };
  const go: Ctx['go'] = (r, o) => {
    if (!o?.replace) history.pushState({ i: stack.current.length }, '');
    showRoute(r, true, o?.replace);
  };
  const back = () => history.back();

  useEffect(() => {
    const pop = () => {
      if (stack.current.length > 1) { stack.current.pop(); showRoute(stack.current[stack.current.length - 1], false); }
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  // FLIP entre pantallas: los elementos compartidos se transforman en vez de desaparecer
  useLayoutEffect(() => {
    if (flipState.current && !prefersReduced()) {
      Flip.from(flipState.current, { duration: 0.8, ease: 'back.out(1.25)', scale: true, absolute: false, zIndex: 20 });
    }
    flipState.current = null;
  }, [route]);

  const afterLogin = (drawn: boolean, w: Wish[], meId: number): Route =>
    drawn ? (flag.get('revealed_' + meId) ? { n: 'theirs' } : { n: 'reveal' }) : w.length ? { n: 'wait' } : { n: 'wish' };

  // arranque
  useEffect(() => {
    (async () => {
      const s = await refresh();
      let first: Route = flag.get('tour') ? { n: 'who' } : { n: 'welcome', i: 0 };
      if (tokens.get('p') && s) {
        try {
          const r = await api<{ me: Person; wishes: Wish[]; state: PubState }>('/me', { as: 'p' });
          setMe(r.me); setWishesState(r.wishes); setPub(r.state);
          first = afterLogin(r.state.drawn, r.wishes, r.me.id);
        } catch { tokens.set('p', null); }
      }
      stack.current = [first];
      history.replaceState({ i: 0 }, '');
      setRoute(first);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enter: Ctx['enter'] = async (token, who) => {
    tokens.set('p', token);
    const r = await api<{ me: Person; wishes: Wish[]; state: PubState }>('/me', { as: 'p' });
    setMe(r.me); setWishesState(r.wishes); setPub(r.state); setReveal(null);
    stack.current = [];
    const next = afterLogin(r.state.drawn, r.wishes, who.id);
    stack.current = [next];
    history.pushState({ i: 0 }, '');
    showRoute(next, false);
  };
  const logout = () => { tokens.set('p', null); setMe(null); setWishesState([]); setReveal(null); go({ n: 'who' }); };

  const ctx: Ctx = {
    pub, refresh, me, wishes, setWishes: (f) => setWishesState(f), reveal, setReveal, go, back,
    canBack: stack.current.length > 1, enter, logout,
  };

  let screen = <Loading />;
  if (route) {
    switch (route.n) {
      case 'welcome': screen = <Welcome key={`w${route.i}`} i={route.i} />; break;
      case 'who': screen = <Who key="who" />; break;
      case 'pin': screen = <Pin key={`pin${route.pid}`} pid={route.pid} />; break;
      case 'wish': screen = <WishScreen key="wish" />; break;
      case 'wait': screen = <Wait key="wait" />; break;
      case 'reveal': screen = <RevealScreen key={`rv${route.again ? 'a' : ''}`} again={route.again} />; break;
      case 'theirs': screen = <Theirs key="theirs" />; break;
    }
  }
  return (
    <AppCtx.Provider value={ctx}>
      <RightCtx.Provider value={me && route && route.n !== 'who' && route.n !== 'welcome' ? <MeChip me={me} onClick={() => go({ n: 'who' })} /> : null}>
        {screen}
      </RightCtx.Provider>
    </AppCtx.Provider>
  );
}

const DEMO = !!import.meta.env.VITE_DEMO;
const isOrg = () => location.pathname.startsWith('/organizador') || location.hash === '#organizador';

export function App() {
  const [org, setOrg] = useState(isOrg());
  useEffect(() => {
    const h = () => setOrg(isOrg());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return (
    <>
      {DEMO && <DemoBar org={org} onSwitch={(o) => { location.hash = o ? 'organizador' : ''; setOrg(o); }} />}
      <div className="app">
        <Ambient />
        <MascotLayer />
        {org ? <OrganizerApp key="o" /> : <ParticipantApp key="p" />}
      </div>
    </>
  );
}

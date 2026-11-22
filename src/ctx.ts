import { createContext, useContext } from 'react';
import type { Person, PubState, Wish } from './api';

export type Route =
  | { n: 'welcome'; i: number }
  | { n: 'who' }
  | { n: 'pin'; pid: number }
  | { n: 'wish' }
  | { n: 'wait' }
  | { n: 'reveal'; again?: boolean }
  | { n: 'theirs' };

export interface Reveal { receiver: Person; wishes: Wish[] }

export interface Ctx {
  pub: PubState | null;
  refresh: () => Promise<PubState | null>;
  me: Person | null;
  wishes: Wish[];
  setWishes: (f: (w: Wish[]) => Wish[]) => void;
  reveal: Reveal | null;
  setReveal: (r: Reveal | null) => void;
  go: (r: Route, o?: { replace?: boolean }) => void;
  back: () => void;
  canBack: boolean;
  enter: (token: string, me: Person) => Promise<void>;
  logout: () => void;
}
export const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

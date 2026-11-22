import { ls } from './storage';

export interface Draft {
  names: { name: string; avatar: string }[];
  date: string;
  budget: number | null;
  title: string;
}
const empty = (): Draft => ({ names: [], date: '', budget: null, title: '' });

export function getDraft(): Draft {
  try {
    return { ...empty(), ...JSON.parse(ls.get('draft') || '{}') };
  } catch {
    return empty();
  }
}
export function saveDraft(d: Draft) {
  ls.set('draft', JSON.stringify(d));
}
export function clearDraft() {
  ls.del('draft');
}

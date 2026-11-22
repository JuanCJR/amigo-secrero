export interface PublicParticipant {
  id: string;
  name: string;
  avatar: string;
  claimed: boolean;
}
export interface PublicGroup {
  id: string;
  title: string;
  date: string;
  budget: number;
  drawn: boolean;
  participants: PublicParticipant[];
}
export interface WishItem {
  id: string;
  url: string;
  note: string;
  title?: string;
  image?: string;
  site: string;
  addedAt: number;
}
export interface Person {
  id: string;
  name: string;
  avatar: string;
}

export class ApiError extends Error {
  constructor(public code: string, public status: number, public data: any = {}) {
    super(code);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body ? { 'content-type': 'application/json' } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'server', res.status, data);
  return data as T;
}

export const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');

export function daysUntil(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

export function prettyDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Mensajes de error dichos por José Miguel: sin culpar y con la solución. */
export function joseError(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'server';
  const left = e instanceof ApiError ? e.data?.left : undefined;
  switch (code) {
    case 'network':
      return 'Uy, se cortó la conexión. Revisa tu internet y toca el botón de nuevo.';
    case 'group_not_found':
      return 'No encuentro este grupo, compa. Pídele al organizador que te mande el link de nuevo.';
    case 'wrong_pin':
      return left > 0
        ? `Ese PIN no es, pero tranqui. Te quedan ${left} intentos; si no te acuerdas, pídele al organizador que lo reinicie.`
        : 'Ese PIN tampoco era. Tomemos un respiro: prueba en 10 minutos o pídele al organizador que lo reinicie.';
    case 'locked':
      return 'Muchos intentos seguidos, tomemos un respiro. Prueba en 10 minutos o pídele al organizador que reinicie tu PIN.';
    case 'bad_url':
      return 'Mmm, eso no parece un link, pero no pasa nada. En la tienda toca Compartir, luego Copiar link, y pégalo aquí.';
    case 'duplicate_wish':
      return 'Ese link ya está en tu lista. Prueba con otra opción de regalo.';
    case 'too_many_wishes':
      return 'Ya tienes 15 ideas, ¡con eso sobra! Borra una si quieres agregar otra.';
    case 'duplicate_name':
      return 'Hay dos personas con el mismo nombre. Agrégale una inicial a una, como "Pedro G."';
    case 'empty_name':
      return 'Hay un nombre vacío en la lista. Escríbelo o quítalo con la X.';
    case 'too_few':
      return 'Necesito al menos 3 personas para sortear. Agrega a alguien más.';
    case 'too_many':
      return 'Uf, son más de 40 personas. Quita algunas para que pueda sortear.';
    case 'bad_date':
      return 'Me falta la fecha del intercambio. Tócala y elige un día en el calendario.';
    case 'bad_budget':
      return 'El monto no me cuadra. Escribe solo números, por ejemplo 15000.';
    case 'bad_pin':
      return 'El PIN tiene que ser de 4 números. Escríbelo de nuevo, sin letras.';
    case 'already_drawn':
      return 'El sorteo ya está hecho y no se puede cambiar. Comparte el link para que cada uno vea el suyo.';
    case 'no_session':
      return 'Se me olvidó quién eras, perdón. Entra de nuevo con tu nombre y tu PIN.';
    case 'not_drawn':
      return 'Todavía no se hace el sorteo. Vuelve cuando el organizador avise, mientras arma tu lista.';
    default:
      return 'Algo se me enredó por dentro. Espera un ratito y toca el botón de nuevo.';
  }
}

import { initials, type Person } from '../api';

export const PALETTE = ['#FF6B2C', '#D62839', '#F6C453', '#7CC6A4', '#6FA8DC', '#B58BE0', '#FF8FB1', '#9BD16B'];

export function Avatar({ p, size = 56, flipId, className = '', lit = true }: {
  p: Pick<Person, 'id' | 'name' | 'color'>; size?: number; flipId?: string; className?: string; lit?: boolean;
}) {
  return (
    <span
      className={`avatar ${lit ? '' : 'avatar--dim'} ${className}`}
      data-flip-id={flipId}
      style={{ width: size, height: size, background: PALETTE[p.color % PALETTE.length], fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      <span className="avatar-shine" />
      {initials(p.name)}
    </span>
  );
}

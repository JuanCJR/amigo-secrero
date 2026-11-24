// Iconos de línea (reemplazan a los emoji). Heredan el color del texto.
const PATHS = {
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  gift: 'M3 8h18v4H3zM5 12h14v9H5zM12 8v13M12 8c-2-4-7-4-6 0M12 8c2-4 7-4 6 0',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  target: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 12h.01',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
  paste: 'M9 4h6v3H9zM7 5H5v16h14V5h-2',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  check: 'M5 12l5 5L20 7',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  whatsapp: 'M4 20l1.5-4.5A8 8 0 1 1 8.5 18.5z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

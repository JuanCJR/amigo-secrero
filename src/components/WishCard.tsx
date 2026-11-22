import { useState } from 'react';
import type { WishItem } from '../lib/api';

const hue = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export function WishCard({ item, onDelete, flipId, readOnly }: { item: Pick<WishItem, 'url' | 'note' | 'title' | 'image' | 'site'> & { id?: string }; onDelete?: (el: HTMLElement) => void; flipId?: string; readOnly?: boolean }) {
  const [imgOk, setImgOk] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const Tag = readOnly ? 'a' : 'div';
  return (
    <Tag
      className="wish"
      data-flip-id={flipId}
      {...(readOnly ? { href: item.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <span className="wish-thumb" style={{ background: `hsl(${hue(item.site)} 60% 82%)` }}>
        {item.image && imgOk ? (
          <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        ) : (
          <span className="wish-mono">{item.site.slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      <span className="wish-body">
        <strong className="wish-title">{item.title || 'Opción de regalo'}</strong>
        <small className="wish-site">{item.site}</small>
        {item.note && <span className="wish-note">“{item.note}”</span>}
      </span>
      {readOnly ? (
        <span className="wish-open" aria-hidden="true">
          Ver ↗
        </span>
      ) : (
        onDelete && (
          <button
            className={`wish-del ${confirm ? 'is-confirm' : ''}`}
            aria-label={confirm ? 'Toca de nuevo para borrar' : `Borrar ${item.title || 'este deseo'}`}
            onClick={(e) => {
              e.preventDefault();
              if (!confirm) {
                setConfirm(true);
                window.setTimeout(() => setConfirm(false), 2500);
                return;
              }
              onDelete(e.currentTarget.closest('.wish') as HTMLElement);
            }}
          >
            {confirm ? '¿Borrar?' : '🗑'}
          </button>
        )
      )}
    </Tag>
  );
}

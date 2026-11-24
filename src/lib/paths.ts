// Rutas de la app en un solo lugar.
// El panel del organizador vive bajo un prefijo reservado (/admin), separado del link
// que se comparte con el grupo (/g/<grupo>), así no se deduce agregando algo al link.
export const adminPath = (gid: string, sub?: 'editar' | 'sorteo') => `/admin/${encodeURIComponent(gid)}${sub ? `/${sub}` : ''}`;

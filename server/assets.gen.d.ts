// Tipos del módulo que genera scripts/embed-assets.mjs al publicar (server/assets.gen.ts, ignorado en git).
// Permite que `tsc` revise el Worker aunque todavía no se haya generado.
export declare const ASSETS: Record<string, { type: string; b64: string }>;

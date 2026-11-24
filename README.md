# Amigo Secreto con José Miguel

App web de amigo secreto pensada para usarse desde el celular. Tiene sorteo, revelación y lista de deseos, y José Miguel guía a cada persona en todo el recorrido.

## Cómo funciona

- **Organizador** (usuario aparte): arma el grupo con los nombres (cada uno recibe un avatar aleatorio), la fecha, el presupuesto y un PIN de organizador. Después comparte **un solo link** con el grupo y hace el sorteo.
- **Participante**: abre el link, toca su cara, crea un PIN de 4 números y el celular lo recuerda. Desde ahí arma su lista de deseos, descubre a su amigo secreto y ve lo que pidió.
- **Privacidad**: el sorteo se hace en el servidor y se guarda cifrado (AES-GCM). La API le entrega a cada persona solo su propio resultado. Ninguna pantalla, ni siquiera la del organizador, muestra quién le tocó a quién.

## Desarrollo

```bash
npm install
npm run dev      # API en :8787 + Vite en :5173
```

## Producción

- **Servidor propio**: `npm run build && APP_SECRET=algo-largo npm start` (guarda los datos en `data.json`).
- **Cloudflare Workers + KV**: crea un namespace KV, pon su id en `wrangler.toml`, ejecuta `npx wrangler secret put APP_SECRET` y luego `npm run deploy`.

## Voz de José Miguel

José Miguel lee en voz alta lo que dice el globo. El botón del parlante (arriba a la derecha) lo silencia.

- **Con IA (ElevenLabs)**: el servidor genera cada frase una sola vez y la guarda en KV; las siguientes veces sale de la caché sin gastar cuota.
  - En Cloudflare: `npx wrangler secret put ELEVENLABS_API_KEY`.
  - En servidor propio o en desarrollo: variable de entorno `ELEVENLABS_API_KEY`.
  - Opcionales: `ELEVENLABS_VOICE_ID` (voz a usar; por defecto "Charlie", que sirve en el plan gratis), `ELEVENLABS_MODEL` (por defecto `eleven_multilingual_v2`) y `TTS_MONTHLY_CHARS` (tope de caracteres nuevos al mes; por defecto 9000, bajo el límite gratis de 10.000).
- **Sin clave o sin cuota**: usa la voz que trae el celular o el navegador.

## Stack

Vite + React + TypeScript, GSAP 3.13 (Flip, MorphSVG, DrawSVG, MotionPath, Physics2D, SplitText, ScrambleText, CustomEase/Wiggle/Bounce) y una API pequeña con Hono.

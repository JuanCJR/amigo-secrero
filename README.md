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

## Stack

Vite + React + TypeScript, GSAP 3.13 (Flip, MorphSVG, DrawSVG, MotionPath, Physics2D, SplitText, ScrambleText, CustomEase/Wiggle/Bounce) y una API pequeña con Hono.

## José Miguel 3D (en desarrollo)

Modelo procedural en three.js, en `src/jose3d/` (`model.ts` arma las piezas y `stage.ts` maneja el render y los ánimos). Para verlo con `npm run dev`, abre `http://localhost:5173/jose3d.html`. Acepta estos parámetros:

- `?mood=wave|celebrate|worried|thinking|sleep|idle`
- `&yaw=0.7` para girarlo
- `&t=0.5&clear=1` para un cuadro fijo con fondo transparente

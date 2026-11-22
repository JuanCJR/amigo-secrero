# Amigo Secreto con José Miguel 🎄

App web (mobile first) para un amigo secreto entre amigos, guiada de principio a fin por **José Miguel**,
un porro navideño animado que explica cada paso.

## Cómo funciona

- **Participantes** (`/`): entran con un único link. Eligen su nombre, crean una clave de 4 números,
  anotan links de regalos que les gustaría recibir y, tras el sorteo, descubren a su amigo secreto
  (mantienen presionado un regalo) y ven su lista de deseos.
- **Organizador** (`/organizador`): es un usuario aparte (clave de 6 números). No participa en el sorteo.
  Define **fecha y monto**, administra la lista de personas, comparte el link por WhatsApp, ve quién ya entró
  y hace el sorteo (con confirmación; no se puede deshacer).
- **Privacidad**: el sorteo se hace en el servidor (algoritmo de Sattolo: nadie se saca a sí mismo).
  Ninguna ruta ni pantalla devuelve el resultado de otra persona, tampoco al organizador.
  Si alguien reinicia su clave, queda anotado a la vista de todos.

Participantes iniciales: Javi M, Branko, David, Damian, Daniela, Nati, Osvaldo, Tía Marisel, Jorge, Ignacio, Marcela
(el organizador puede cambiarlos desde la app antes del sorteo).

## Correr en local

```bash
npm install
npm run dev:server   # API en :8787
npm run dev:client   # app en :5173 (proxy a la API)
```

Producción (un solo proceso que sirve app + API):

```bash
npm run build
PORT=8787 npm start
```

Variables opcionales: `PORT`, `DB_FILE` (por defecto `./data/amigo.db`), `ORGANIZER_PIN` (6 dígitos; si no se define,
la primera persona que abra `/organizador` crea la clave).
La base es un archivo SQLite: en un hosting con disco efímero, monta un volumen en `data/`.

```bash
docker build -t amigo-secreto . && docker run -p 8787:8787 -v amigo-data:/app/data amigo-secreto
```

## Tests

```bash
npm test          # sorteo (sin autosorteo, un solo ciclo) y privacidad de la API
npm run typecheck
```

## Animación

GSAP (core, timelines, Flip, SplitText, ScrambleText, DrawSVG, MorphSVG, Physics2D, CustomEase/Bounce/Wiggle)
+ Matter.js para la tómbola. Todo lo que se mueve en pantalla usa `transform` y `opacity`
(salvo el dibujo de trazos en SVG pequeños).
Respeta `prefers-reduced-motion`; las secuencias largas se saltan tocando y se acortan al repetirse.

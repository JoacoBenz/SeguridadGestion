# Video demo de producto

Demos del camino feliz de un paquete, hechos con
[Remotion](https://remotion.dev). Proyecto independiente de la app
(su propio `package.json`) para no sumar dependencias al SaaS.

Composiciones:

- `PackItODemo` / `PackItODemoVertical` — demo completo de 60s (7 escenas).
- `PackItOQuick` / `PackItOQuickVertical` — versión rápida de 14.5s: gancho →
  los 3 pasos con indicador de progreso (registro, WhatsApp, retiro) → CTA.
  El mensaje de WhatsApp refleja la plantilla real `paquete_recibido_v3`
  (QR + nombre/edificio/unidad, sin código). Render:
  `npx remotion render src/index.ts PackItOQuick out/packito-quick-15s.mp4`.

```bash
cd video
pnpm install
pnpm studio    # editar con preview en vivo
pnpm render    # genera out/packito-demo.mp4
```

## Estructura

- `src/theme.ts` — paleta ink/accent (espejo de `tailwind.config.ts` de la app) + fuentes Geist.
- `src/ui.tsx` — primitivas: logo, cards, tags, typewriter, countUp, click pulse, QR falso, confetti.
- `src/scenes-1.tsx` — Intro, Problema, Registro (conserjería).
- `src/scenes-2.tsx` — WhatsApp al residente, Retiro con QR, Dashboard, Cierre.
- `src/Demo.tsx` — composición: 7 escenas unidas con `TransitionSeries` + `springTiming`.

## Notas

- Si el entorno no puede bajar Chrome Headless Shell (red restringida), apuntá a
  un Chromium local: `--browser-executable=/ruta/a/chrome`. Detrás de un proxy
  TLS agregá `--ignore-certificate-errors` para que carguen las Google Fonts.
- Música: hay un placeholder de `<Audio>` comentado en `src/Demo.tsx` —
  poné el archivo en `video/public/music.mp3` y descomentá.

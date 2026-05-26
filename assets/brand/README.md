# Bexovar — 5A logo exports

The Bexovar primary mark, in every shape you're likely to need.

## Files

| File | Use it for |
| --- | --- |
| `bexovar-5a-light.svg` | Light backgrounds — default brand mark |
| `bexovar-5a-dark.svg` | Dark backgrounds — white stem + sky bowls |
| `bexovar-5a-animated.svg` | Web hero, loaders — node travels the B strokes in a 4.5s loop |
| `bexovar-5a-mono.svg` | Single-color contexts — uses `currentColor`, drops into any palette |
| `bexovar-5a-icon-light.svg` | App icon / avatar / favicon — padded, rounded-square light tile |
| `bexovar-5a-icon-dark.svg` | App icon — dark tile, sky-400 strokes |
| `bexovar-5a-lockup.svg` | Mark + BEXOVAR wordmark — for headers, business cards, signatures |
| `bexovar-5a-256.png` | Raster — 256×256 (email signatures, slack icons) |
| `bexovar-5a-512.png` | Raster — 512×512 (social profile pictures, large headers) |
| `bexovar-5a-1024.png` | Raster — 1024×1024 (print, App Store, large hero) |
| `bexovar-5a-icon-1024.png` | Raster app icon — 1024×1024 dark tile |

## Where to find them

All in `exports/` at the project root. You can:

- **Download a single file** — right-click → save in the file tree
- **Download all as a zip** — ask me to package the `exports/` folder and I'll send a download card

## Spec

- Palette: sky-600 `#0284C7` (strokes), ink `#0F172A` (stem + node)
- Clear-space: keep at least 1× the cap-height around the lockup
- Minimum sizes: 16px favicon, 64px wordmark lockup
- Animation: 4.5s loop. Pause under `prefers-reduced-motion` — the animated SVG already respects this in modern browsers via the embedded `animateMotion` (which honors the user preference at the system level)

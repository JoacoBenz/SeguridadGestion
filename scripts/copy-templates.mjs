#!/usr/bin/env node
// Copia plantillas de WhatsApp de una WABA a otra.
//
// Las plantillas pertenecen a una WABA, no a la cuenta: si el número de envío
// vive en otra WABA, hay que recrearlas ahí. La UI de WhatsApp Manager no tiene
// "copiar a otra cuenta", pero la Graph API permite leer la definición completa
// y volver a postearla.
//
//   WHATSAPP_ACCESS_TOKEN=... node scripts/copy-templates.mjs \
//     --from 1065165336349652 --to <WABA_DESTINO> [--dry-run]
//
// Opciones:
//   --only a,b          sólo estas plantillas (default: las 5 de PackItO)
//   --force-language X  crea todo con este idioma, ignorando el original
//                       (sirve para arreglar una plantilla mal etiquetada)
//   --dry-run           muestra qué se crearía, sin escribir nada
//
// Limitación conocida: las plantillas con header de imagen llevan un
// `header_handle` que se obtiene subiendo un archivo a la app y NO es
// transferible entre WABAs. Esas fallan al copiarse y hay que crearlas a mano
// desde WhatsApp Manager. El script lo dice explícitamente en vez de fallar
// en silencio.

const API = "https://graph.facebook.com/v21.0";

const DEFAULT_TEMPLATES = [
  "paquete_recibido_v3",
  "paquete_foto_v1",
  "paquete_pendiente_v1",
  "paquete_escalado_v1",
  "paquete_retirado_v1",
];

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--from") args.from = argv[++i];
    else if (a === "--to") args.to = argv[++i];
    else if (a === "--only") args.only = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--force-language") args.forceLanguage = argv[++i];
    else {
      console.error(`Opción desconocida: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

async function graph(path, token, init) {
  const url = `${API}/${path}${path.includes("?") ? "&" : "?"}access_token=${token}`;
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error;
    throw new Error(
      err ? `${err.code ?? res.status}: ${err.message ?? "(sin mensaje)"}` : `HTTP ${res.status}`,
    );
  }
  return json;
}

// La API pagina; sin esto se pierden plantillas si hay muchas.
async function fetchAllTemplates(waba, token) {
  const out = [];
  let path = `${waba}/message_templates?fields=name,language,status,category,components&limit=100`;
  while (path) {
    const page = await graph(path, token);
    out.push(...(page.data ?? []));
    const next = page.paging?.next;
    // Reusamos el cursor, no la URL completa (que ya trae el token embebido).
    const after = page.paging?.cursors?.after;
    path =
      next && after
        ? `${waba}/message_templates?fields=name,language,status,category,components&limit=100&after=${after}`
        : null;
  }
  return out;
}

function hasImageHeader(tpl) {
  return (tpl.components ?? []).some(
    (c) => c.type === "HEADER" && c.format === "IMAGE",
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!token) die("Falta WHATSAPP_ACCESS_TOKEN en el entorno.");
  if (!args.from || !args.to) die("Faltan --from y/o --to (IDs de WABA).");
  if (args.from === args.to) die("--from y --to son la misma WABA.");

  const wanted = new Set(args.only ?? DEFAULT_TEMPLATES);

  console.log(`Leyendo plantillas de ${args.from}…`);
  const source = await fetchAllTemplates(args.from, token);

  const existing = new Set(
    (await fetchAllTemplates(args.to, token)).map((t) => `${t.name}:${t.language}`),
  );

  const toCopy = source.filter((t) => wanted.has(t.name) && t.status === "APPROVED");
  const missing = [...wanted].filter((n) => !toCopy.some((t) => t.name === n));
  if (missing.length) {
    console.log(`\n⚠  No encontradas o no aprobadas en el origen: ${missing.join(", ")}`);
  }

  console.log(`\n${toCopy.length} plantilla(s) a copiar hacia ${args.to}:\n`);

  let ok = 0;
  const manual = [];

  for (const tpl of toCopy) {
    const language = args.forceLanguage ?? tpl.language;
    const label = `${tpl.name} (${language})`;

    if (existing.has(`${tpl.name}:${language}`)) {
      console.log(`  ↷ ${label} — ya existe en el destino, se omite`);
      continue;
    }

    const payload = {
      name: tpl.name,
      language,
      category: tpl.category,
      components: tpl.components,
    };

    if (args.dryRun) {
      console.log(`  · ${label} — se crearía${hasImageHeader(tpl) ? " (header de imagen)" : ""}`);
      continue;
    }

    try {
      await graph(`${args.to}/message_templates`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log(`  ✔ ${label} — creada, queda en revisión`);
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✖ ${label} — ${msg}`);
      if (hasImageHeader(tpl)) manual.push(tpl.name);
    }
  }

  if (manual.length) {
    console.log(
      `\n⚠  Estas llevan header de imagen y su media handle no es transferible entre WABAs:\n` +
        `   ${manual.join(", ")}\n` +
        `   Crealas a mano en WhatsApp Manager, subiendo de nuevo la imagen de ejemplo.`,
    );
  }

  if (!args.dryRun) {
    console.log(`\n${ok} creada(s). Revisá el estado en WhatsApp Manager → Message templates.`);
  }
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));

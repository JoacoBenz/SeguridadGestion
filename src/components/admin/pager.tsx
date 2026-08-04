import Link from "next/link";

// Paginación compartida de los listados del panel. Los listados que sólo
// cortaban con `take` mentían por omisión: mostraban las primeras N filas sin
// ninguna señal de que había más atrás.

export const PAGE_SIZE = 50;

/** Normaliza el `?page=` de la URL. Cualquier basura cae en la página 1. */
export function pageFromParam(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function skipFor(page: number, pageSize = PAGE_SIZE): number {
  return (page - 1) * pageSize;
}

export function Pager({
  page,
  total,
  basePath,
  params = {},
  pageSize = PAGE_SIZE,
}: {
  page: number;
  total: number;
  basePath: string;
  /** Filtros a preservar al cambiar de página (búsqueda, estado, etc.). */
  params?: Record<string, string | undefined>;
  pageSize?: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : skipFor(page, pageSize) + 1;
  const to = Math.min(skipFor(page, pageSize) + pageSize, total);

  const href = (target: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (target > 1) qs.set("page", String(target));
    const q = qs.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  // Con una sola página no hay nada que navegar, pero el conteo igual sirve.
  if (lastPage === 1) {
    return (
      <p className="text-xs text-ink-500">
        {total === 0 ? "Sin resultados" : `${total} en total`}
      </p>
    );
  }

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-xs text-ink-500">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        <PagerLink href={href(page - 1)} disabled={page <= 1}>
          ← Anterior
        </PagerLink>
        <span className="text-xs text-ink-500">
          {page} / {lastPage}
        </span>
        <PagerLink href={href(page + 1)} disabled={page >= lastPage}>
          Siguiente →
        </PagerLink>
      </div>
    </nav>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base = "rounded-lg border px-3 py-2 text-xs transition-colors";
  if (disabled) {
    return (
      <span aria-disabled className={`${base} border-ink-800 text-ink-600`}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} border-ink-700 text-ink-200 hover:border-accent/60 hover:text-accent`}
    >
      {children}
    </Link>
  );
}

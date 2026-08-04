import Link from "next/link";

// Buscador de los listados del panel. Es un form GET a la misma ruta: la
// búsqueda queda en la URL, así se puede compartir, volver atrás y recargar sin
// perderla. Sin JS de por medio.
export function SearchBox({
  basePath,
  defaultValue,
  placeholder,
}: {
  basePath: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <form action={basePath} method="get" className="flex flex-wrap gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-accent/60 hover:text-accent"
      >
        Buscar
      </button>
      {defaultValue && (
        <Link
          href={basePath}
          className="rounded-xl border border-ink-700 px-4 py-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
        >
          Limpiar
        </Link>
      )}
    </form>
  );
}

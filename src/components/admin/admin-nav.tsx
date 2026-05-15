"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  slug: string;
  tenantName: string;
}

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export function AdminNav({ slug, tenantName }: Props) {
  const pathname = usePathname();
  const base = `/${slug}/admin`;

  const items: NavItem[] = [
    { href: base, label: "Inicio", exact: true },
    { href: `${base}/unidades`, label: "Unidades" },
    { href: `${base}/residentes`, label: "Residentes" },
    { href: `${base}/autorizaciones`, label: "Autorizaciones" },
    { href: `${base}/paquetes`, label: "Paquetes" },
    { href: `${base}/reportes`, label: "Reportes" },
  ];

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-xs text-ink-400">{tenantName}</p>
          <h1 className="text-lg font-bold tracking-tight">Administración</h1>
        </div>
        <Link
          href={`/${slug}/conserjeria`}
          className="rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-xs text-ink-300 transition-colors hover:text-ink-100"
        >
          Ir a conserjería →
        </Link>
      </div>
      <nav className="mx-auto max-w-6xl overflow-x-auto">
        <ul className="flex min-w-max gap-1 px-4 pb-1">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    active
                      ? "inline-block rounded-t-lg border-b-2 border-accent px-4 py-2 text-sm font-semibold text-accent"
                      : "inline-block rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm text-ink-300 transition-colors hover:text-ink-100"
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

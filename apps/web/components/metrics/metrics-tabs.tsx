import Link from "next/link";

/** Métricas has two views: the numbers, and the leads the operator types. */
export function MetricsTabs({ current }: { current: "summary" | "leads" }) {
  return (
    <nav aria-label="Métricas" className="-mb-6 border-b border-bezel">
      <ul className="flex gap-1">
        <li>
          <Link
            href="/metrics"
            className="nav-key"
            aria-current={current === "summary" ? "page" : undefined}
          >
            Resumen
          </Link>
        </li>
        <li>
          <Link
            href="/metrics/leads"
            className="nav-key"
            aria-current={current === "leads" ? "page" : undefined}
          >
            Leads
          </Link>
        </li>
      </ul>
    </nav>
  );
}

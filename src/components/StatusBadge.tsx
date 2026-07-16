/**
 * FASE C — Badge de estado del comprobante
 * Guía: docs/GUIA-FASE-C-FRONTEND.md (§2)
 */
const STYLES: Record<string, [string, string]> = {
  pending:       ["Pendiente",      "bg-gray-100 text-gray-600"],
  processing:    ["Procesando…",    "bg-blue-100 text-blue-700 animate-pulse"],
  done:          ["Listo ✓",        "bg-green-100 text-green-700"],
  error:         ["Error ✗",        "bg-red-100 text-red-700"],
  not_a_receipt: ["No es comprobante", "bg-amber-100 text-amber-700"],
};

export default function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STYLES[status] ?? [status, "bg-gray-100 text-gray-600"];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

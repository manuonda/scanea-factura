/**
 * FASE C — Badge de estado del comprobante
 * Guía: docs/GUIA-FASE-C-FRONTEND.md (§2)
 */

// TODO: mapa status → [etiqueta, clases tailwind]:
//   pending "Pendiente" gris · processing "Procesando…" azul (animate-pulse) ·
//   done "Listo ✓" verde · error "Error ✗" rojo · not_a_receipt "No es comprobante" ámbar

export default function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{status}</span>;
}

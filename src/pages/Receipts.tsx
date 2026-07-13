/**
 * FASE C LOCAL — Listado de comprobantes EN VIVO (leyendo del store en memoria)
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 *
 * Como el store es un Context con useState, cualquier updateReceipt() de Capture.tsx
 * re-renderiza esta lista sola — mismo efecto visual que la reactividad de Convex,
 * pero sin servidor.
 */
// import { useReceiptsStore } from "../store/receiptsStore";
// import StatusBadge from "../components/StatusBadge";

// Formateador de moneda argentina — lo reusa ReceiptDetail
export const formatARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

// TODO 1: const { receipts } = useReceiptsStore();
// TODO 2: estado vacío si receipts.length === 0 ("Todavía no escaneaste ningún comprobante")
// TODO 3: cada fila: thumbnail (URL.createObjectURL(r.file) si es imagen, 📄 si es PDF),
//         proveedor ?? fileName, fecha ?? createdAt formateado, total con formatARS,
//         <StatusBadge status={r.status} />, onClick → onSelect(r.id)

export default function Receipts({ onSelect: _onSelect }: { onSelect: (id: string) => void }) {
  return <p className="p-8 text-center">Receipts sin implementar (Fase C LOCAL)</p>;
}

/**
 * FASE C LOCAL — Detalle de un comprobante: preview, campos extraídos, descarga, borrar
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 */
// import { useReceiptsStore } from "../store/receiptsStore";
// import StatusBadge from "../components/StatusBadge";
// import { formatARS } from "./Receipts";

// TODO 1: const { getReceipt, removeReceipt } = useReceiptsStore();
//         const receipt = getReceipt(id); → si no existe, "No encontrado."
// TODO 2: url = URL.createObjectURL(receipt.file)
//         preview: <img src={url}> si es imagen; link "Ver PDF" si es PDF
// TODO 3: tabla <dl> con los campos extraídos (mostrar solo los que existen)
//         + errorMessage en un recuadro ámbar si está
// TODO 4: "Descargar original": <a href={url} download={receipt.fileName}>
// TODO 5: borrar con confirm() → removeReceipt(id) del store → onBack()

export default function ReceiptDetail({ id: _id, onBack: _onBack }: { id: string; onBack: () => void }) {
  return <p className="p-8 text-center">ReceiptDetail sin implementar (Fase C LOCAL)</p>;
}

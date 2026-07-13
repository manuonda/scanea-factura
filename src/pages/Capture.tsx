/**
 * FASE C LOCAL — Captura y cola de subida (la pantalla central del producto)
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 *
 * Flujo por archivo (SECUENCIAL, uno detrás del otro):
 *   validar → comprimir (si es imagen) → addReceipt (status "pending") →
 *   extractReceipt (Gemini) → updateReceipt con el resultado
 */
// import { useRef, useState } from "react";
// import { useReceiptsStore } from "../store/receiptsStore";
// import { validateFile } from "../lib/validateFile";
// import { compressImage } from "../lib/compressImage";
// import { extractReceipt } from "../lib/geminiClient";

// TODO 1: dos <input type="file"> ocultos + refs:
//         - cámara:  accept="image/*" capture="environment"  (abre cámara trasera en mobile)
//         - galería: accept="image/jpeg,image/png,image/webp,application/pdf" multiple
//         + zona drag&drop (onDragOver preventDefault, onDrop → handleFiles)

// TODO 2: estado de la cola: { id, name, state: validando|comprimiendo|analizando|listo|rechazado, reason? }[]
//         (es solo para la UI de progreso — el resultado final vive en el store, no acá)

// TODO 3: handleFiles(files) con for...of (secuencial):
//         - validateFile → si !ok, marcar rechazado con el reason y continue
//         - si imagen → compressImage
//         - receiptId = addReceipt(file) del store (status inicial "pending")
//         - updateReceipt(receiptId, { status: "processing" })
//         - try { const result = await extractReceipt(file); ... } catch → status "error"
//         - si result.isInvoice → updateReceipt con status "done" + los campos extraídos
//           si no → updateReceipt con status "not_a_receipt" + errorMessage = result.reason
//         - todo en try/catch por ítem (un archivo malo no frena la cola)

// TODO 4: UI de la cola con el estado de cada ítem + link "Ver mis comprobantes →" (prop onDone)

export default function Capture({ onDone: _onDone }: { onDone: () => void }) {
  return <p className="p-8 text-center">Capture sin implementar (Fase C LOCAL)</p>;
}

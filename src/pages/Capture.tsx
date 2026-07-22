/**
 * FASE C LOCAL — Captura y cola de subida (la pantalla central del producto)
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 *
 * Flujo por archivo (SECUENCIAL, uno detrás del otro):
 *   validar → comprimir (si es imagen) → addReceipt (status "pending") →
 *   extractReceipt (Gemini) → updateReceipt con el resultado
 */
import { useRef, useState } from "react";
import { useReceiptsStore } from "../store/receiptsStore";
import { validateFile } from "../lib/validateFile";
import { compressImage } from "../lib/compressImage";
import { extractReceipt } from "../lib/geminiClient";

type ItemState = "validando" | "comprimiendo" | "analizando" | "listo" | "rechazado";
interface QueueItem { id: string; name: string; state: ItemState; reason?: string }

export default function Capture({ onDone }: { onDone: () => void }) {
  const { addReceipt, updateReceipt } = useReceiptsStore();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const updateQueue = (id: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  // Cola SECUENCIAL: un archivo detrás del otro (mismo patrón que Fase C original)
  async function handleFiles(files: FileList | File[]) {
    console.log("handleFiles", files);
    console.log("Array.from(files)", Array.from(files));
    setBusy(true);
    for (const file of Array.from(files)) {
      const qid = crypto.randomUUID();
      setQueue((q) => [...q, { id: qid, name: file.name, state: "validando" }]);

      try {
        const validation = await validateFile(file);
        console.log("validation", validation);
        if (!validation.ok) {
          updateQueue(qid, { state: "rechazado", reason: validation.reason });
          continue;
        }

        console.log("validation.kind", validation.kind);
        let toProcess = file;
        if (validation.kind === "image") {
          updateQueue(qid, { state: "comprimiendo" });
          toProcess = await compressImage(file);
        }

        console.log("toProcess", toProcess);
        const receiptId = addReceipt(toProcess);
        console.log("receiptId", receiptId);
        updateReceipt(receiptId, { status: "processing" });
        updateQueue(qid, { state: "analizando" });

        try {
          const result = await extractReceipt(toProcess);
          console.log("result.isInvoice", result.isInvoice);
          console.log("result.documentType", result.documentType);
          console.log("result.data.proveedor", result.data?.proveedor);
          console.log("result.data.cuit", result.data?.cuit);
          console.log("result.data.fecha", result.data?.fecha);
          console.log("result.data.numeroFactura", result.data?.numeroFactura);
          console.log("result.data.total", result.data?.total);
          console.log("result.data.iva", result.data?.iva);
          if (result.isInvoice && result.data) {
            console.log("result.data", result.data);
            updateReceipt(receiptId, {
              status: "done",
              documentType: result.documentType,
              proveedor: result.data.proveedor,
              cuit: result.data.cuit,
              fecha: result.data.fecha,
              numeroFactura: result.data.numeroFactura,
              total: result.data.total,
              iva: result.data.iva,
            });
          } else {
            updateReceipt(receiptId, { status: "not_a_receipt", errorMessage: result.reason });
          }
        } catch (err) {
          updateReceipt(receiptId, {
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Error llamando a Gemini",
          });
        }

        updateQueue(qid, { state: "listo" });
      } catch (err) {
        updateQueue(qid, { state: "rechazado", reason: err instanceof Error ? err.message : "Error" });
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* cámara trasera directa (mobile) */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      {/* galería / archivos, múltiple */}
      <input ref={galleryRef} type="file" multiple hidden
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => e.target.files && handleFiles(e.target.files)} />

      <button onClick={() => cameraRef.current?.click()}
        className="rounded-xl bg-slate-900 py-5 text-lg font-semibold text-white shadow">
        📷 Tomar foto
      </button>
      <button onClick={() => galleryRef.current?.click()}
        className="rounded-xl border-2 border-slate-900 py-4 font-medium">
        🖼️ Elegir de galería / archivos
      </button>

      {/* drag & drop (desktop) */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-400"
      >
        …o arrastrá los archivos acá
      </div>

      {queue.length > 0 && (
        <ul className="flex flex-col gap-2">
          {queue.map((it) => (
            <li key={it.id} className="flex items-center justify-between rounded-lg bg-white p-3 text-sm shadow-sm">
              <span className="truncate">{it.name}</span>
              <span className={it.state === "rechazado" ? "text-red-600" : "text-gray-500"}>
                {it.state === "rechazado" ? `✗ ${it.reason}` : it.state === "listo" ? "✓ analizado" : `${it.state}…`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!busy && queue.some((it) => it.state === "listo") && (
        <button onClick={onDone} className="text-sm font-medium text-blue-600">
          Ver mis comprobantes →
        </button>
      )}
    </div>
  );
}

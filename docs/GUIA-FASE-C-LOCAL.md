# Guía Fase C (LOCAL) — Prototipo sin Convex para validar el diseño

**Por qué existe esta fase:** antes de meterte con Convex Auth + DB + cola (Fase B), querés
*ver y tocar* el flujo real: sacar una foto o subir un PDF, que Gemini lo lea, y verlo aparecer
en una lista — todo con el mismo diseño que va a tener el producto final. Esta versión guarda
todo en memoria (un `useState` en un Context), sin login y sin backend. Se pierde al refrescar
la página — es intencional, es solo para validar UI/UX y el prompt de extracción esta semana.

**Cuando estés conforme con el diseño**, migrás estos mismos componentes a la Fase B/C originales
(`docs/GUIA-FASE-B-CONVEX.md` y `docs/GUIA-FASE-C-FRONTEND.md`): el store en memoria se reemplaza
por `useQuery`/`useMutation` de Convex, y `geminiClient.ts` (que corre en el navegador) se reemplaza
por `convex/gemini.ts` (que corre en el servidor). El resto — `Capture`, `Receipts`, `ReceiptDetail`,
`StatusBadge`, `validateFile`, `compressImage` — casi no cambia de forma.

⚠️ **Importante — seguridad**: en este prototipo, Gemini se llama DIRECTO desde el navegador con
`VITE_GEMINI_API_KEY`, lo que deja la key visible en el código del cliente (cualquiera que abra
las devtools la puede ver). Es aceptable **solo en `localhost`, esta semana, para validar**. Nunca
deployes esta versión a una URL pública. La Fase B mueve la llamada a Gemini al servidor y ahí la
key deja de viajar al cliente.

**Archivos a programar** (esqueletos con TODOs ya creados):

| Archivo | Qué hace |
|---|---|
| `src/lib/geminiClient.ts` | llama a Gemini desde el navegador (reusa el prompt probado en Fase A) |
| `src/store/receiptsStore.tsx` | Context + Provider: la "base de datos" en memoria |
| `src/main.tsx` | envuelve `<App>` con `<ReceiptsProvider>` |
| `src/App.tsx` | shell con tabs Escanear / Comprobantes (sin login) |
| `src/pages/Capture.tsx` | sube archivo → valida → comprime → Gemini → guarda en el store |
| `src/pages/Receipts.tsx` | lista en vivo leyendo del store (re-renderiza sola al cambiar) |
| `src/pages/ReceiptDetail.tsx` | detalle + descarga + borrar |

`validateFile.ts`, `compressImage.ts` y `StatusBadge.tsx` **no cambian** — ya son independientes
de Convex, se usan tal cual están.

**Orden recomendado:** `geminiClient` → `receiptsStore` → `main` → `App` (ya navegás entre tabs) →
`validateFile` + `compressImage` (si no los hiciste en la Fase A) → `Capture` (ya subís y extraés
de verdad) → `Receipts` (ya ves la lista) → `ReceiptDetail`.

---

## 1. Conceptos clave

- **Un solo lugar de verdad**: `receiptsStore.tsx` guarda el array de comprobantes en un
  `useState` dentro de un `Context`. Cualquier componente que llame a `useReceiptsStore()` lee
  el mismo array y se re-renderiza cuando cambia — es tu reemplazo casero de la reactividad de
  Convex, pero sin persistencia (vive y muere con la pestaña del navegador).
- **El archivo (`File`) vive en memoria**: en vez de subirlo a un storage, lo guardás tal cual en
  el objeto del comprobante. Para mostrarlo (`<img>`, descarga) usás
  `URL.createObjectURL(file)`. Es una URL temporal válida solo en esta pestaña.
- **La cola sigue siendo secuencial**: igual que en la Fase C original, procesás los archivos
  uno detrás del otro con un `for...of`, para no disparar N requests a Gemini en paralelo.
- **`import.meta.env.VITE_GEMINI_API_KEY`**: Vite solo expone al navegador las variables de
  `.env`/`.env.local` que empiezan con `VITE_`. Por eso hay una entrada separada de
  `GEMINI_API_KEY` (la de Fase A, que corre en Node) — ver el comentario en `.env`.

## 2. Solución completa por archivo (consultar si te trabás)

### `src/lib/geminiClient.ts`

<details><summary>Ver código</summary>

```typescript
/**
 * Llamada a Gemini directo desde el navegador — mismo prompt y contrato de
 * datos que experiments/gemini-test.ts (Fase A), adaptado a File del browser.
 */
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash-lite";

export interface ExtractionResult {
  isInvoice: boolean;
  documentType: "factura" | "recibo" | "ticket" | "comprobante_pago" | "otro";
  reason: string;
  data?: {
    proveedor: string;
    cuit: string;
    fecha: string; // DD/MM/YYYY
    numeroFactura: string;
    total: number;
    iva: number | null;
  };
}

const PROMPT = `
Analiza el documento adjunto actuando como un experto en gestión administrativa y fiscal de Argentina.

PASO 1: CLASIFICACIÓN
Determina si la imagen es un documento de transacción válido, como:
- Facturas (Letras A, B, C, M) y Notas de Crédito.
- Tickets de compra o tickets fiscales.
- Comprobantes de transferencia (Mercado Pago, bancos).
- Comprobantes de pago de servicios (PagoMisCuentas, Red Link, comprobantes de entes públicos).
- Recibos de pago.

PASO 2: EXTRACCIÓN
Si es válido, extrae los datos. Si hay varios montos, usa el "Total" o "Monto Pagado".
Si es un comprobante de servicio, el "proveedor" es la empresa prestadora.

Responde EXCLUSIVAMENTE con este JSON:
{
  "isInvoice": boolean,
  "documentType": "factura" | "recibo" | "ticket" | "comprobante_pago" | "otro",
  "reason": "breve explicación de por qué es o no es válido",
  "data": {
    "proveedor": "Nombre de la empresa, comercio o receptor del pago",
    "cuit": "CUIT del emisor/proveedor (XX-XXXXXXXX-X)",
    "fecha": "DD/MM/YYYY",
    "numeroFactura": "Número de comprobante, operación o control",
    "total": number (usar punto decimal, sin símbolos de moneda),
    "iva": number | null (monto del IVA si está discriminado)
  }
}
`;

function detectMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

// btoa no acepta un Uint8Array gigante de una — se arma en chunks
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function extractReceipt(file: File): Promise<ExtractionResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error("Falta VITE_GEMINI_API_KEY en .env (ver docs/GUIA-FASE-C-LOCAL.md)");

  const client = new GoogleGenAI({ apiKey });
  const mimeType = detectMimeType(file);
  const data = await fileToBase64(file);

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: PROMPT }, { inlineData: { mimeType, data } }] }],
    config: { responseMimeType: "application/json", temperature: 0.1 },
  });

  const text = response.text;
  if (!text) throw new Error("Respuesta vacía de Gemini");
  const result = JSON.parse(text) as ExtractionResult;

  // mismo override de clasificación que en Fase A
  const tiposValidos = ["factura", "recibo", "ticket", "comprobante_pago"];
  result.isInvoice = tiposValidos.includes(result.documentType) || result.isInvoice;
  return result;
}
```

</details>

### `src/store/receiptsStore.tsx`

<details><summary>Ver código</summary>

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";

export type ReceiptStatus = "pending" | "processing" | "done" | "error" | "not_a_receipt";

export interface LocalReceipt {
  id: string;
  file: File;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: ReceiptStatus;
  createdAt: number;
  documentType?: string;
  proveedor?: string;
  cuit?: string;
  fecha?: string;
  numeroFactura?: string;
  total?: number;
  iva?: number | null;
  errorMessage?: string;
}

interface ReceiptsStore {
  receipts: LocalReceipt[];
  addReceipt: (file: File) => string;
  updateReceipt: (id: string, patch: Partial<LocalReceipt>) => void;
  removeReceipt: (id: string) => void;
  getReceipt: (id: string) => LocalReceipt | undefined;
}

const ReceiptsContext = createContext<ReceiptsStore | null>(null);

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);

  const addReceipt = (file: File) => {
    const id = crypto.randomUUID();
    setReceipts((prev) => [
      {
        id,
        file,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        status: "pending",
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    return id;
  };

  const updateReceipt = (id: string, patch: Partial<LocalReceipt>) =>
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeReceipt = (id: string) => setReceipts((prev) => prev.filter((r) => r.id !== id));

  const getReceipt = (id: string) => receipts.find((r) => r.id === id);

  return (
    <ReceiptsContext.Provider value={{ receipts, addReceipt, updateReceipt, removeReceipt, getReceipt }}>
      {children}
    </ReceiptsContext.Provider>
  );
}

export function useReceiptsStore() {
  const ctx = useContext(ReceiptsContext);
  if (!ctx) throw new Error("useReceiptsStore debe usarse dentro de <ReceiptsProvider>");
  return ctx;
}
```

</details>

### `src/main.tsx`

<details><summary>Ver código</summary>

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ReceiptsProvider } from "./store/receiptsStore";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReceiptsProvider>
      <App />
    </ReceiptsProvider>
  </StrictMode>
);
```

</details>

### `src/App.tsx`

<details><summary>Ver código</summary>

```tsx
import { useState } from "react";
import Capture from "./pages/Capture";
import Receipts from "./pages/Receipts";
import ReceiptDetail from "./pages/ReceiptDetail";

type Tab = "capture" | "receipts";

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">Scanea Comprobante</h1>
        <span className="text-xs text-slate-400">prototipo local</span>
      </header>

      <main className="flex-1 overflow-y-auto">
        {selectedId ? (
          <ReceiptDetail id={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            {tab === "capture" && <Capture onDone={() => setTab("receipts")} />}
            {tab === "receipts" && <Receipts onSelect={setSelectedId} />}
          </>
        )}
      </main>

      <nav className="grid grid-cols-2 border-t bg-white">
        {(
          [
            ["capture", "📷 Escanear"],
            ["receipts", "🧾 Comprobantes"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => { setSelectedId(null); setTab(t); }}
            className={`py-3 text-sm ${tab === t ? "font-bold text-slate-900" : "text-gray-500"}`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

</details>

### `src/pages/Capture.tsx`

<details><summary>Ver código</summary>

```tsx
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
    setBusy(true);
    for (const file of Array.from(files)) {
      const qid = crypto.randomUUID();
      setQueue((q) => [...q, { id: qid, name: file.name, state: "validando" }]);

      try {
        const validation = await validateFile(file);
        if (!validation.ok) {
          updateQueue(qid, { state: "rechazado", reason: validation.reason });
          continue;
        }

        let toProcess = file;
        if (validation.kind === "image") {
          updateQueue(qid, { state: "comprimiendo" });
          toProcess = await compressImage(file);
        }

        const receiptId = addReceipt(toProcess);
        updateReceipt(receiptId, { status: "processing" });
        updateQueue(qid, { state: "analizando" });

        try {
          const result = await extractReceipt(toProcess);
          if (result.isInvoice && result.data) {
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
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)} />
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
```

</details>

### `src/pages/Receipts.tsx`

<details><summary>Ver código</summary>

```tsx
import { useReceiptsStore } from "../store/receiptsStore";
import StatusBadge from "../components/StatusBadge";

export const formatARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default function Receipts({ onSelect }: { onSelect: (id: string) => void }) {
  const { receipts } = useReceiptsStore();

  if (receipts.length === 0) {
    return <p className="p-8 text-center text-gray-400">Todavía no escaneaste ningún comprobante.</p>;
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {receipts.map((r) => (
        <button key={r.id} onClick={() => onSelect(r.id)}
          className="flex items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm">
          {r.mimeType.startsWith("image/") ? (
            <img src={URL.createObjectURL(r.file)} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">📄</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.proveedor ?? r.fileName}</p>
            <p className="text-xs text-gray-500">{r.fecha ?? new Date(r.createdAt).toLocaleDateString("es-AR")}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {r.total !== undefined && <span className="font-semibold">{formatARS.format(r.total)}</span>}
            <StatusBadge status={r.status} />
          </div>
        </button>
      ))}
    </div>
  );
}
```

> Nota: `URL.createObjectURL` en cada render crea una URL nueva sin liberar la anterior (memory
> leak menor). Para el prototipo de esta semana no importa (pocos archivos, sesión corta). Si te
> molesta, memoizala con `useMemo(() => URL.createObjectURL(r.file), [r.file])` por fila.

</details>

### `src/pages/ReceiptDetail.tsx`

<details><summary>Ver código</summary>

```tsx
import { useReceiptsStore } from "../store/receiptsStore";
import StatusBadge from "../components/StatusBadge";
import { formatARS } from "./Receipts";

export default function ReceiptDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { getReceipt, removeReceipt } = useReceiptsStore();
  const receipt = getReceipt(id);

  if (!receipt) return <p className="p-8 text-center text-gray-400">No encontrado.</p>;

  const url = URL.createObjectURL(receipt.file);
  const rows: [string, string | undefined][] = [
    ["Tipo", receipt.documentType],
    ["Proveedor", receipt.proveedor],
    ["CUIT", receipt.cuit],
    ["Fecha", receipt.fecha],
    ["Nro. comprobante", receipt.numeroFactura],
    ["Total", receipt.total !== undefined ? formatARS.format(receipt.total) : undefined],
    ["IVA", receipt.iva != null ? formatARS.format(receipt.iva) : undefined],
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <button onClick={onBack} className="self-start text-sm text-blue-600">← Volver</button>

      {receipt.mimeType.startsWith("image/") ? (
        <img src={url} alt={receipt.fileName} className="max-h-80 rounded-xl object-contain shadow" />
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="rounded-xl bg-white p-4 text-center shadow-sm">
          📄 Ver PDF
        </a>
      )}

      <div className="flex items-center justify-between">
        <StatusBadge status={receipt.status} />
        <span className="text-xs text-gray-400">
          escaneado el {new Date(receipt.createdAt).toLocaleString("es-AR")}
        </span>
      </div>

      {receipt.errorMessage && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{receipt.errorMessage}</p>
      )}

      <dl className="divide-y rounded-xl bg-white shadow-sm">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} className="flex justify-between p-3 text-sm">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ) : null
        )}
      </dl>

      <div className="flex gap-3">
        <a href={url} download={receipt.fileName}
          className="flex-1 rounded-xl bg-slate-900 py-3 text-center font-medium text-white">
          ⬇️ Descargar original
        </a>
        <button
          onClick={() => { if (confirm("¿Eliminar este comprobante?")) { removeReceipt(id); onBack(); } }}
          className="rounded-xl border border-red-300 px-4 text-red-600">
          🗑️
        </button>
      </div>
    </div>
  );
}
```

</details>

## 3. Checklist de verificación de esta fase

- [ ] `npm run dev` levanta y `http://localhost:5173` muestra el tab "Escanear".
- [ ] "Tomar foto" abre la cámara en el teléfono (probar con `npm run dev -- --host` en la
      misma red); en desktop, "Elegir de galería / archivos" funciona.
- [ ] Subir un PDF de 2+ páginas se rechaza con mensaje claro (probar con algo de
      `docs/afip/` armando un PDF de 2 páginas, o forzarlo).
- [ ] Subir una imagen o PDF válido pasa por `comprimiendo → analizando → listo` y aparece en
      "Comprobantes" con los datos extraídos (proveedor, total, fecha).
- [ ] Un archivo que NO es un comprobante (una foto random) queda en estado "No es comprobante"
      con el `reason` de Gemini visible en el detalle.
- [ ] El detalle muestra preview, descarga el original y lo borra de la lista.
- [ ] Los comprobantes de prueba en `docs/billeteras/` y `docs/afip/` se leen igual de bien que
      en la Fase A (mismo prompt, mismo modelo).

🎯 Con esto validás el diseño y el flujo completo de punta a punta. Cuando estés conforme,
seguimos con `docs/GUIA-FASE-B-CONVEX.md` para persistencia real, multi-usuario y mover la key
de Gemini al servidor.

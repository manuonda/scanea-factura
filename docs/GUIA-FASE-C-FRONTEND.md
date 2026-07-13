# Guía Fase C — Frontend PWA (captura, listado en vivo, export Excel)

**Objetivo:** la app que usa el backend de la Fase B: login, captura con cámara / galería / drag&drop con validación en el cliente, cola de subida, listado en tiempo real con estados, detalle con descarga, export a `.xlsx`, e instalable como PWA en el teléfono.

**Archivos a programar** (esqueletos con TODOs ya creados):

| Archivo | Qué hace |
|---|---|
| `src/main.tsx` | conecta React con Convex + Auth |
| `src/App.tsx` | gate de auth + navegación por tabs |
| `src/pages/SignIn.tsx` | login Google + registro email |
| `src/lib/validateFile.ts` | tipo, tamaño, PDF de 1 página |
| `src/lib/compressImage.ts` | compresión antes de subir |
| `src/pages/Capture.tsx` | cámara/galería/drop + cola secuencial |
| `src/components/StatusBadge.tsx` | badge de estado |
| `src/pages/Receipts.tsx` | listado paginado en vivo |
| `src/pages/ReceiptDetail.tsx` | detalle + descarga + borrar |
| `src/lib/exportXlsx.ts` + `src/pages/Export.tsx` | export a Excel |

**Orden recomendado:** main → App → SignIn (ya podés loguearte) → validateFile + compressImage → Capture (ya podés subir) → Receipts (ya ves el pipeline vivo) → Detail → Export → PWA.

---

## 1. Conceptos clave

- **Reactividad**: `useQuery`/`usePaginatedQuery` de Convex son suscripciones — cuando la action cambia el `status` en el servidor, el componente se re-renderiza SOLO. No hay polling, no hay refetch.
- **Subida a storage**: `generateUploadUrl()` te da una URL efímera; hacés `fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file })` y la respuesta trae `{ storageId }`.
- **Cámara en mobile**: `<input type="file" accept="image/*" capture="environment">` abre la cámara trasera directo. Sin `capture` abre la galería. Es HTML puro — no hace falta getUserMedia para el MVP.
- **Worker de pdfjs en Vite** (el gotcha #1): hay que importar el worker con `?url` y asignarlo a `GlobalWorkerOptions.workerSrc`. Si no, el conteo de páginas falla silenciosamente.

## 2. Solución completa por archivo

### `src/main.tsx`

<details><summary>Ver código</summary>

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import "./index.css";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>
);
```

</details>

### `src/App.tsx`

<details><summary>Ver código</summary>

```tsx
import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import type { Id } from "../convex/_generated/dataModel";
import SignIn from "./pages/SignIn";
import Capture from "./pages/Capture";
import Receipts from "./pages/Receipts";
import ReceiptDetail from "./pages/ReceiptDetail";
import Export from "./pages/Export";

type Tab = "capture" | "receipts" | "export";

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");
  const [selectedId, setSelectedId] = useState<Id<"receipts"> | null>(null);
  const { signOut } = useAuthActions();

  return (
    <>
      <AuthLoading>
        <div className="flex h-dvh items-center justify-center">Cargando…</div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <div className="flex h-dvh flex-col bg-gray-50">
          <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <h1 className="text-lg font-semibold">Scanea Comprobante</h1>
            <button onClick={() => void signOut()} className="text-sm text-slate-300">
              Salir
            </button>
          </header>

          <main className="flex-1 overflow-y-auto">
            {selectedId ? (
              <ReceiptDetail id={selectedId} onBack={() => setSelectedId(null)} />
            ) : (
              <>
                {tab === "capture" && <Capture onDone={() => setTab("receipts")} />}
                {tab === "receipts" && <Receipts onSelect={setSelectedId} />}
                {tab === "export" && <Export />}
              </>
            )}
          </main>

          <nav className="grid grid-cols-3 border-t bg-white">
            {(
              [
                ["capture", "📷 Escanear"],
                ["receipts", "🧾 Comprobantes"],
                ["export", "📊 Exportar"],
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
      </Authenticated>
    </>
  );
}
```

</details>

### `src/pages/SignIn.tsx`

<details><summary>Ver código</summary>

```tsx
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-gray-50 px-6">
      <h1 className="text-2xl font-bold">Scanea Comprobante</h1>

      <button
        onClick={() => void signIn("google")}
        className="w-full max-w-sm rounded-lg border bg-white py-3 font-medium shadow-sm"
      >
        Continuar con Google
      </button>

      <div className="text-sm text-gray-400">— o con tu email —</div>

      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const formData = new FormData(e.currentTarget);
          formData.set("flow", flow);
          void signIn("password", formData).catch(() =>
            setError(flow === "signIn" ? "Email o contraseña incorrectos" : "No se pudo crear la cuenta")
          );
        }}
      >
        {flow === "signUp" && (
          <div className="flex gap-2">
            <input name="nombre" placeholder="Nombre" required className="w-1/2 rounded-lg border p-3" />
            <input name="apellido" placeholder="Apellido" required className="w-1/2 rounded-lg border p-3" />
          </div>
        )}
        <input name="email" type="email" placeholder="Email" required className="rounded-lg border p-3" />
        <input name="password" type="password" placeholder="Contraseña" required minLength={8} className="rounded-lg border p-3" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded-lg bg-slate-900 py-3 font-medium text-white">
          {flow === "signIn" ? "Ingresar" : "Registrarme"}
        </button>
        <button
          type="button"
          onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          className="text-sm text-gray-500"
        >
          {flow === "signIn" ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Ingresá"}
        </button>
      </form>
    </div>
  );
}
```

</details>

### `src/lib/validateFile.ts`

<details><summary>Ver código</summary>

```typescript
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
// ⚠️ EL gotcha de Vite: importar el worker con ?url
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB (después se comprime)
const MAX_PDF_BYTES = 5 * 1024 * 1024;    // 5 MB (no se puede comprimir en cliente)

export type ValidationResult =
  | { ok: true; kind: "image" | "pdf" }
  | { ok: false; reason: string };

/** Algunos pickers de Android mandan file.type vacío → fallback por extensión */
function resolveType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

export async function validateFile(file: File): Promise<ValidationResult> {
  const type = resolveType(file);

  if (type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) {
      return { ok: false, reason: `PDF demasiado grande (${mb(file.size)} — máx. 5 MB)` };
    }
    const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
    if (pdf.numPages !== 1) {
      return { ok: false, reason: `PDF de ${pdf.numPages} páginas — solo se acepta 1 comprobante por archivo` };
    }
    return { ok: true, kind: "pdf" };
  }

  if (IMAGE_TYPES.includes(type)) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, reason: `Imagen demasiado grande (${mb(file.size)} — máx. 15 MB)` };
    }
    return { ok: true, kind: "image" };
  }

  return { ok: false, reason: "Tipo no soportado (solo JPG, PNG, WebP o PDF)" };
}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
```

</details>

### `src/lib/compressImage.ts`

<details><summary>Ver código</summary>

```typescript
import imageCompression from "browser-image-compression";

/** Comprime a JPEG ≤ ~0.8 MB, máx. 1600px — legible y barato en tokens/storage */
export async function compressImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
  });
}
```

</details>

### `src/pages/Capture.tsx`

<details><summary>Ver código</summary>

```tsx
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { validateFile } from "../lib/validateFile";
import { compressImage } from "../lib/compressImage";

type ItemState = "validando" | "comprimiendo" | "subiendo" | "listo" | "rechazado";
interface QueueItem { id: number; name: string; state: ItemState; reason?: string }

let nextId = 0;

export default function Capture({ onDone }: { onDone: () => void }) {
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);
  const createReceipt = useMutation(api.receipts.createReceipt);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const update = (id: number, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  // Cola SECUENCIAL: los archivos se procesan uno detrás del otro
  async function handleFiles(files: FileList | File[]) {
    const items = Array.from(files).map((file) => ({
      id: nextId++,
      file,
      entry: { id: nextId - 1, name: file.name, state: "validando" as ItemState },
    }));
    setQueue((q) => [...q, ...items.map((i) => i.entry)]);
    setBusy(true);

    for (const { id, file } of items) {
      try {
        const validation = await validateFile(file);
        if (!validation.ok) {
          update(id, { state: "rechazado", reason: validation.reason });
          continue;
        }

        let toUpload: File = file;
        if (validation.kind === "image") {
          update(id, { state: "comprimiendo" });
          toUpload = await compressImage(file);
        }

        update(id, { state: "subiendo" });
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": toUpload.type },
          body: toUpload,
        });
        if (!res.ok) throw new Error("Error subiendo el archivo");
        const { storageId } = await res.json();

        await createReceipt({
          storageId,
          fileName: file.name,
          mimeType: toUpload.type,
          fileSize: toUpload.size,
        });
        update(id, { state: "listo" });
      } catch (err) {
        update(id, { state: "rechazado", reason: err instanceof Error ? err.message : "Error" });
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
                {it.state === "rechazado" ? `✗ ${it.reason}` : it.state === "listo" ? "✓ en proceso" : `${it.state}…`}
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

### `src/components/StatusBadge.tsx`

<details><summary>Ver código</summary>

```tsx
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
```

</details>

### `src/pages/Receipts.tsx`

<details><summary>Ver código</summary>

```tsx
import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import StatusBadge from "../components/StatusBadge";

export const formatARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default function Receipts({ onSelect }: { onSelect: (id: Id<"receipts">) => void }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.receipts.list, {}, { initialNumItems: 25 }
  );

  if (results.length === 0 && status !== "LoadingFirstPage") {
    return <p className="p-8 text-center text-gray-400">Todavía no escaneaste ningún comprobante.</p>;
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {results.map((r) => (
        <button key={r._id} onClick={() => onSelect(r._id)}
          className="flex items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm">
          {r.url && r.mimeType.startsWith("image/") ? (
            <img src={r.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">📄</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.proveedor ?? r.fileName}</p>
            <p className="text-xs text-gray-500">{r.fecha ?? new Date(r._creationTime).toLocaleDateString("es-AR")}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {r.total !== undefined && <span className="font-semibold">{formatARS.format(r.total)}</span>}
            <StatusBadge status={r.status} />
          </div>
        </button>
      ))}
      {status === "CanLoadMore" && (
        <button onClick={() => loadMore(25)} className="py-3 text-sm text-blue-600">Cargar más</button>
      )}
    </div>
  );
}
```

</details>

### `src/pages/ReceiptDetail.tsx`

<details><summary>Ver código</summary>

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import StatusBadge from "../components/StatusBadge";
import { formatARS } from "./Receipts";

export default function ReceiptDetail({ id, onBack }: { id: Id<"receipts">; onBack: () => void }) {
  const receipt = useQuery(api.receipts.get, { id });
  const remove = useMutation(api.receipts.remove);

  if (receipt === undefined) return <p className="p-8 text-center text-gray-400">Cargando…</p>;
  if (receipt === null) return <p className="p-8 text-center text-gray-400">No encontrado.</p>;

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

      {receipt.url && (receipt.mimeType.startsWith("image/") ? (
        <img src={receipt.url} alt={receipt.fileName} className="max-h-80 rounded-xl object-contain shadow" />
      ) : (
        <a href={receipt.url} target="_blank" rel="noreferrer"
          className="rounded-xl bg-white p-4 text-center shadow-sm">📄 Ver PDF</a>
      ))}

      <div className="flex items-center justify-between">
        <StatusBadge status={receipt.status} />
        <span className="text-xs text-gray-400">
          escaneado el {new Date(receipt._creationTime).toLocaleString("es-AR")}
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
        {receipt.url && (
          <a href={receipt.url} download={receipt.fileName}
            className="flex-1 rounded-xl bg-slate-900 py-3 text-center font-medium text-white">
            ⬇️ Descargar original
          </a>
        )}
        <button
          onClick={() => { if (confirm("¿Eliminar este comprobante?")) { void remove({ id }); onBack(); } }}
          className="rounded-xl border border-red-300 px-4 text-red-600">
          🗑️
        </button>
      </div>
    </div>
  );
}
```

</details>

### `src/lib/exportXlsx.ts` y `src/pages/Export.tsx`

<details><summary>Ver código</summary>

```typescript
// src/lib/exportXlsx.ts
import * as XLSX from "xlsx";

export interface ExportRow {
  fecha?: string; proveedor?: string; cuit?: string; numeroFactura?: string;
  documentType?: string; total?: number; iva?: number; status: string;
  fileName: string; _creationTime: number;
}

export function exportXlsx(rows: ExportRow[], nombre: string) {
  const data = rows.map((r) => ({
    "Fecha Doc": r.fecha ?? "",
    "Proveedor": r.proveedor ?? "",
    "CUIT": r.cuit ?? "",
    "Nro Comprobante": r.numeroFactura ?? "",
    "Tipo": r.documentType ?? "",
    "Total": r.total ?? "",
    "IVA": r.iva ?? "",
    "Estado": r.status,
    "Archivo": r.fileName,
    "Escaneado": new Date(r._creationTime).toLocaleString("es-AR"),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Comprobantes");
  XLSX.writeFile(wb, `${nombre}.xlsx`); // dispara la descarga, también en mobile
}
```

```tsx
// src/pages/Export.tsx
import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { exportXlsx } from "../lib/exportXlsx";

const toISO = (d: Date) => d.toISOString().slice(0, 10);

export default function Export() {
  const convex = useConvex();
  const [from, setFrom] = useState(toISO(new Date()));
  const [to, setTo] = useState(toISO(new Date()));
  const [onlyDone, setOnlyDone] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function doExport(start: number, end: number, nombre: string) {
    setMsg(null);
    // query one-shot (no suscripción): se pide solo al apretar el botón
    let rows = await convex.query(api.receipts.listByRange, { start, end });
    if (onlyDone) rows = rows.filter((r) => r.status === "done");
    if (rows.length === 0) { setMsg("No hay comprobantes en ese rango."); return; }
    exportXlsx(rows, nombre);
    setMsg(`✓ ${rows.length} comprobantes exportados`);
  }

  const startOfDay = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
  const endOfDay = (iso: string) => new Date(`${iso}T00:00:00`).getTime() + 86_400_000;

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        onClick={() => { const hoy = toISO(new Date()); void doExport(startOfDay(hoy), endOfDay(hoy), `comprobantes-${hoy}`); }}
        className="rounded-xl bg-slate-900 py-5 text-lg font-semibold text-white shadow">
        📊 Exportar HOY a Excel
      </button>

      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <p className="font-medium">Exportar rango</p>
        <label className="flex items-center justify-between text-sm">
          Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border p-2" />
        </label>
        <label className="flex items-center justify-between text-sm">
          Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border p-2" />
        </label>
        <button
          onClick={() => void doExport(startOfDay(from), endOfDay(to), `comprobantes-${from}-a-${to}`)}
          className="rounded-lg border-2 border-slate-900 py-3 font-medium">
          Exportar rango
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={onlyDone} onChange={(e) => setOnlyDone(e.target.checked)} />
        Solo comprobantes procesados (status “done”)
      </label>

      {msg && <p className="text-center text-sm text-gray-600">{msg}</p>}
    </div>
  );
}
```

</details>

## 3. PWA — al final, cuando todo funcione

1. Descomentar el import de `VitePWA` en `vite.config.ts` y agregar al array de plugins:

<details><summary>Ver configuración</summary>

```typescript
VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "Scanea Comprobante",
    short_name: "Comprobantes",
    description: "Escaneá y organizá tus comprobantes",
    theme_color: "#0f172a",
    background_color: "#ffffff",
    display: "standalone",
    orientation: "portrait",
    lang: "es-AR",
    icons: [
      { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"] },
}),
```

</details>

2. Generar `public/pwa-192x192.png` y `public/pwa-512x512.png` (cualquier generador de íconos, p. ej. https://favicon.io con un emoji 🧾).
3. En `index.html`: `<meta name="theme-color" content="#0f172a">`.
4. **Probar en el teléfono**: cámara y service worker requieren HTTPS →
   ```bash
   npm run dev -- --host          # terminal 1
   npx cloudflared tunnel --url http://localhost:5173   # terminal 2 → te da una URL https
   ```
   Abrir la URL en el teléfono → menú del navegador → "Agregar a pantalla de inicio".

## 4. Checklist de verificación de la fase

- [ ] Login con email (nombre/apellido) y con Google; al refrescar sigue logueado.
- [ ] "Tomar foto" abre la cámara en el teléfono; galería permite seleccionar varios.
- [ ] Foto de 5 MB entra comprimida (verificar `fileSize` en el dashboard < 1 MB).
- [ ] PDF de 2+ páginas rechazado con mensaje claro; PDF de 1 página pasa.
- [ ] El listado muestra `pending → processing → done` EN VIVO sin refrescar.
- [ ] Detalle: preview + descarga del original + borrar.
- [ ] "Exportar HOY" descarga un `.xlsx` que abre bien en Excel/Google Sheets.
- [ ] Segundo usuario → listado vacío (datos aislados).
- [ ] PWA instalada en el teléfono abre standalone con ícono propio.

🎉 Con esto el MVP está completo y listo para validar con usuarios reales.

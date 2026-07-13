/**
 * FASE C — Validación en el cliente ANTES de subir
 * Guía: docs/GUIA-FASE-C-FRONTEND.md (§2)
 *
 * Reglas del producto:
 *  - Solo image/jpeg, image/png, image/webp o application/pdf
 *  - PDF: 1 SOLA página (nada de PDFs con 50 comprobantes) y máx. 5 MB
 *  - Imagen: máx. 15 MB (después se comprime)
 */
// import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
// ⚠️ Gotcha de Vite — el worker se importa así (con ?url) o pdfjs falla silenciosamente:
// import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
// GlobalWorkerOptions.workerSrc = workerUrl;

export type ValidationResult =
  | { ok: true; kind: "image" | "pdf" }
  | { ok: false; reason: string };

// TODO 1: resolveType(file) — file.type, y si viene vacío (pickers de Android) fallback por extensión

// TODO 2: validateFile(file): Promise<ValidationResult>
//   - PDF → validar tamaño, luego getDocument({ data: await file.arrayBuffer() }).promise
//           y rechazar si pdf.numPages !== 1 (con mensaje que diga cuántas páginas tiene)
//   - imagen → validar tipo permitido y tamaño
//   - otro → { ok: false, reason: "Tipo no soportado..." }

export async function validateFile(_file: File): Promise<ValidationResult> {
  // placeholder para que compile — reemplazar con la implementación real
  return { ok: false, reason: "validateFile sin implementar (Fase C, TODO 2)" };
}

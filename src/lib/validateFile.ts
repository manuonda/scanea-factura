/**
 * FASE C — Validación en el cliente ANTES de subir
 * Guía: docs/GUIA-FASE-C-FRONTEND.md (§2)
 *
 * Reglas del producto:
 *  - Solo image/jpeg, image/png, image/webp o application/pdf
 *  - PDF: 1 SOLA página (nada de PDFs con 50 comprobantes) y máx. 5 MB
 *  - Imagen: máx. 15 MB (después se comprime)
 */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
// ⚠️ Gotcha de Vite — el worker se importa así (con ?url) o pdfjs falla silenciosamente
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

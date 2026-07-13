/**
 * FASE C LOCAL — Llamada a Gemini directo desde el navegador
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 *
 * Reusá el mismo PROMPT y ExtractionResult de experiments/gemini-test.ts (Fase A) —
 * lo único que cambia es cómo se lee el archivo (File del browser, no readFileSync).
 *
 * ⚠️ VITE_GEMINI_API_KEY queda expuesta en el bundle del cliente. Aceptable SOLO en
 * localhost para validar esta semana — nunca deployar esta versión a un dominio público.
 */
// import { GoogleGenAI } from "@google/genai";

// const MODEL = "gemini-2.5-flash-lite";

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

// TODO 1: PROMPT — copiá el mismo texto que ya probaste en experiments/gemini-test.ts

// TODO 2: detectMimeType(file: File) — file.type, y si viene vacío fallback por extensión
//         (mismo patrón que resolveType en validateFile.ts)

// TODO 3: fileToBase64(file: File): Promise<string>
//         - const bytes = new Uint8Array(await file.arrayBuffer())
//         - btoa no acepta arrays gigantes de una → armar el string binario en chunks
//           (p. ej. de a 0x8000 bytes) antes de btoa()

// TODO 4: extractReceipt(file: File): Promise<ExtractionResult>
//         - leer apiKey de import.meta.env.VITE_GEMINI_API_KEY (tirar error claro si falta)
//         - new GoogleGenAI({ apiKey }) + client.models.generateContent(...) igual que Fase A
//           (mismo PROMPT, misma inlineData con mimeType + data en base64)
//         - JSON.parse(response.text) + el mismo override de clasificación:
//           tiposValidos.includes(documentType) || isInvoice

export async function extractReceipt(_file: File): Promise<ExtractionResult> {
  throw new Error("extractReceipt sin implementar (Fase C LOCAL, TODO 4)");
}

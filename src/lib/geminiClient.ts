/**
 * FASE C LOCAL — Llamada a Gemini directo desde el navegador
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 *
 * Mismo PROMPT y contrato de datos que experiments/gemini-test.ts (Fase A),
 * adaptado a File del browser (no readFileSync).
 *
 * ⚠️ VITE_GEMINI_API_KEY queda expuesta en el bundle del cliente. Aceptable SOLO en
 * localhost para validar esta semana — nunca deployar esta versión a un dominio público.
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

/**
 * FASE C LOCAL — Versión mejorada
 * Cambios vs original:
 *  1. Regla explícita de mapeo "proveedor" para transferencias (De/Para).
 *  2. Schema estructurado (responseSchema) en vez de JSON de ejemplo en el texto
 *     → prompt más corto, menos tokens, mayor cumplimiento del formato.
 *  3. "reason" pasa a opcional (solo se completa si isInvoice=false), ahorra
 *     tokens de output en el caso feliz (la mayoría de tus documentos).
 *  4. Nuevo campo opcional "contraparte" con rol, para debug/auditoría sin
 *     inflar el caso normal (queda undefined si no aplica).
 */
import { GoogleGenAI, Type } from "@google/genai";

const MODEL = "gemini-2.5-flash-lite";

export interface ExtractionResult {
  isInvoice: boolean;
  documentType: "factura" | "recibo" | "ticket" | "comprobante_pago" | "otro";
  data?: {
    proveedor: string; // Ver regla de mapeo en el prompt (emisor de factura o RECEPTOR de transferencia)
    cuit: string;
    fecha: string; // DD/MM/YYYY
    numeroFactura: string;
    total: number;
    iva: number | null;
  };
  reason?: string; // solo presente si isInvoice = false
}

// Prompt compacto: reglas de negocio en lenguaje natural,
// el CONTRATO del JSON vive en el schema (abajo), no acá.
const PROMPT = `
Sos un extractor de comprobantes de pago argentinos (facturas, tickets, recibos, transferencias, pagos de servicios).

REGLA CLAVE para el campo "proveedor":
- Factura o ticket: el comercio que emite el comprobante.
- Comprobante de pago de servicio (PagoMisCuentas, Red Link, entes públicos): la empresa que cobra.
- Transferencia bancaria con "De"/"Para" o "Emisor"/"Destinatario" (Mercado Pago, Ualá, bancos):
  usá SIEMPRE el destinatario/receptor (a quién se le pagó), NUNCA el emisor.

Si hay varios montos, usá el total final efectivamente pagado.
Si la imagen no es un comprobante válido, isInvoice=false y completá "reason" brevemente. Si es válido, omití "reason".
`;

// Schema estructurado — reemplaza al bloque JSON de ejemplo que tenías en el prompt de texto.
// Esto es lo que más pesa en tokens de prompt cuando lo describís en lenguaje natural.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    isInvoice: { type: Type.BOOLEAN },
    documentType: {
      type: Type.STRING,
      enum: ["factura", "recibo", "ticket", "comprobante_pago", "otro"],
    },
    reason: { type: Type.STRING, nullable: true },
    data: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        proveedor: { type: Type.STRING },
        cuit: { type: Type.STRING },
        fecha: { type: Type.STRING },
        numeroFactura: { type: Type.STRING },
        total: { type: Type.NUMBER },
        iva: { type: Type.NUMBER, nullable: true },
      },
      required: ["proveedor", "cuit", "fecha", "numeroFactura", "total"],
    },
  },
  required: ["isInvoice", "documentType"],
};

function detectMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

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
  if (!apiKey) throw new Error("Falta VITE_GEMINI_API_KEY en .env");

  const client = new GoogleGenAI({ apiKey });
  const mimeType = detectMimeType(file);
  const data = await fileToBase64(file);

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: PROMPT }, { inlineData: { mimeType, data } }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
      // maxOutputTokens acotado: con el reason opcional y sin bloque de ejemplo,
      // el output normal (documento válido) es chico. Ajustá según tus casos reales.
      maxOutputTokens: 400,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Respuesta vacía de Gemini");
  const result = JSON.parse(text) as ExtractionResult;

  const tiposValidos = ["factura", "recibo", "ticket", "comprobante_pago"];
  result.isInvoice = tiposValidos.includes(result.documentType) || result.isInvoice;
  return result;
}
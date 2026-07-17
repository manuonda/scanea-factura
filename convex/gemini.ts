"use node";
/**
 * FASE B — La action que procesa el comprobante con Gemini (en background)
 * Guía: docs/GUIA-FASE-B-CONVEX.md (§4)
 *
 * Mismo prompt y contrato de datos que experiments/gemini-test.ts (Fase A),
 * con el campo "documento" agregado al JSON del prompt.
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash-lite";

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
    "iva": number | null (monto del IVA si está discriminado),
    "documento": number | null (número de documento del receptor si figura, solo dígitos)
  }
}
`;

const TIPOS_VALIDOS = ["factura", "recibo", "ticket", "comprobante_pago"];

export const processReceipt = internalAction({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, { receiptId }) => {
    await ctx.runMutation(internal.receipts.markProcessing, { id: receiptId });
    try {
      const doc = await ctx.runQuery(internal.receipts.getInternal, { id: receiptId });
      if (!doc) throw new Error("Comprobante no encontrado");

      // En vez de readFileSync (Fase A): el archivo viene del storage de Convex
      const blob = await ctx.storage.get(doc.storageId);
      if (!blob) throw new Error("Archivo no encontrado en storage");
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await client.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType: doc.mimeType, data: base64 } },
            ],
          },
        ],
        config: { responseMimeType: "application/json", temperature: 0.1 },
      });

      const text = response.text;
      if (!text) throw new Error("Respuesta vacía de Gemini");
      const result = JSON.parse(text);

      // override de clasificación (igual que Fase A)
      const isValid = TIPOS_VALIDOS.includes(result.documentType) || result.isInvoice;

      if (!isValid) {
        await ctx.runMutation(internal.receipts.markFailed, {
          id: receiptId,
          status: "not_a_receipt",
          errorMessage: result.reason ?? "No es un comprobante válido",
          rawExtraction: text,
        });
        return;
      }

      await ctx.runMutation(internal.receipts.saveExtraction, {
        id: receiptId,
        documentType: typeof result.documentType === "string" ? result.documentType : undefined,
        proveedor: typeof result.data?.proveedor === "string" ? result.data.proveedor : undefined,
        cuit: typeof result.data?.cuit === "string" ? result.data.cuit : undefined,
        fecha: typeof result.data?.fecha === "string" ? result.data.fecha : undefined,
        fechaTs: parseFecha(result.data?.fecha),
        numeroFactura: typeof result.data?.numeroFactura === "string" ? result.data.numeroFactura : undefined,
        total: typeof result.data?.total === "number" ? result.data.total : undefined,
        iva: typeof result.data?.iva === "number" ? result.data.iva : undefined,
        documento: typeof result.data?.documento === "number" ? result.data.documento : undefined,
        rawExtraction: text,
      });
    } catch (err) {
      // NUNCA dejar un doc clavado en "processing"
      await ctx.runMutation(internal.receipts.markFailed, {
        id: receiptId,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

/** "25/12/2026" -> timestamp ms, o undefined si no parsea */
function parseFecha(fecha?: string): number | undefined {
  if (!fecha) return undefined;
  const m = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const ts = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

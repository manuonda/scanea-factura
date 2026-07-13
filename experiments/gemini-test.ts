/**
 * FASE A — Prueba de extracción de comprobantes con Gemini (standalone, sin Convex)
 *
 * Uso:   npm run gemini -- <ruta-a-imagen-o-pdf>
 * Ej:    npm run gemini -- ../factura-scanner-mvp/backend/images/mercado_pago.jpeg
 *
 * Guía completa con el código explicado: docs/GUIA-FASE-A-GEMINI.md
 * (intentá resolver los TODOs vos primero, y consultá la guía si te trabás)
 */

import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";

// El modelo va en una constante para poder cambiarlo fácil si la calidad no alcanza
// (alternativa probada: "gemini-2.0-flash")
const MODEL = "gemini-2.5-flash-lite";

// Contrato de datos: esto mismo se guardará después en Convex (Fase B)
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
    documento: number | null;
  };
}

// Prompt probado en factura-scanner-mvp (ocr.ts) — cubre AFIP, MP, bancos, servicios
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


/**
 * Funcion para detectar el mime type de un archivo
 * @param buffer - Buffer del archivo
 * @param filePath - Ruta del archivo
 * @returns Mime type del archivo
 */
function detectTMimeType(buffer: Buffer, filePath: string): string {
    if(buffer.subarray(0, 4).toString() === "%PDF") {
        return "application/pdf";
    } else if(filePath.endsWith(".png")) {
        return "image/png";
    } else if(filePath.endsWith(".webp")) {
        return "image/webp";
    } else {
        return "image/jpeg";
    }
}

async function main() {
    // Leer la ruta del archivo desde los argumentos
    const filePath = process.argv[2];
    if(!filePath) {
        console.error("Error: No se proporciono una ruta de archivo");
        process.exit(1);
    }
    // Leer el archivo y detectar el mime type
    const buffer = readFileSync(filePath);
    const mimeType = detectTMimeType(buffer, filePath);
    if(!mimeType) {
        console.error("Error: No se pudo detectar el mime type del archivo");
        process.exit(1);
    }
    console.log(`Mime type del archivo: ${mimeType}`);

    // Validar que exista GEMINI_API_KEY en process.env
    const apiKey = process.env.GEMINI_API_KEY;
    if(!apiKey) {
        console.error("Error: No se encontró la API key de Gemini en el archivo .env.local");
        process.exit(1);
    }
    
  // Crear el cliente y llamar a Gemini
  const client = new GoogleGenAI({ apiKey });
  console.log("Client created");
  const response = await client.models.generateContent({
    model: MODEL,
    contents : [{
      role: "user",
      parts :[
         {text: PROMPT},
         {inlineData: {mimeType, data:buffer.toString("base64")}},
      ]
    }],
    config: { responseMimeType: "application/json", temperature: 0.1 },
  });


  // parsear + override de clasificacion
  const text = response.text;
  if(!text) throw new Error("Respuesta vacia de Gemini");
  const result = JSON.parse(text) as ExtractionResult;

  console.log("Resultado de Gemini:", result);
  const tiposValidos = ["factura","recibo","ticket","comprobante_pago"];
  result.isInvoice = tiposValidos.includes(result.documentType) || result.isInvoice;

  // salida + tokens + costo
  console.log("Salida de Gemini:", response.text);
  console.log(JSON.stringify(result, null, 2));
  const usage = response.usageMetadata;
  if (usage) {
    const inTokens = usage.promptTokenCount ?? 0;
    const outTokens = usage.candidatesTokenCount ?? 0;
    const costo = (inTokens * 0.1 + outTokens * 0.4) / 1_000_000;
    console.log(
      `\n📊 Tokens: ${inTokens} entrada + ${outTokens} salida = ${usage.totalTokenCount} ` +
      `(~$${costo.toFixed(6)} USD)`
    );
  }
   
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});

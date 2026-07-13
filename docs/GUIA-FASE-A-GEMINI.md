# Guía Fase A — Conexión con Google Gemini

**Objetivo:** validar el corazón de la idea en 30 minutos: un script de consola que recibe la foto/PDF de un comprobante argentino y devuelve el JSON con proveedor, CUIT, fecha, número, total e IVA. Sin Convex, sin frontend — solo Node + Gemini.

**Archivo a programar:** `experiments/gemini-test.ts` (tiene los TODOs numerados).

---

## 1. Conseguir la API key (gratis)

1. Entrá a https://aistudio.google.com/apikey con tu cuenta de Google.
2. "Create API key" → copiala.
3. En la raíz del proyecto: `cp .env.local.example .env.local` y pegá la key en `GEMINI_API_KEY=`.

El free tier de AI Studio alcanza de sobra para probar (con `gemini-2.5-flash-lite` tenés miles de requests por día gratis).

## 2. Cómo se ejecuta

```bash
npm run gemini -- <archivo>

# con los comprobantes de prueba del proyecto hermano:
npm run gemini -- ../factura-scanner-mvp/backend/images/mercado_pago.jpeg
```

El script `gemini` de `package.json` ya está configurado: usa `node --env-file=.env.local --import tsx`, o sea que `.env.local` se carga solo y TypeScript corre sin compilar.

## 3. Conceptos clave antes de codear

- **Gemini recibe la imagen inline**: se manda el archivo como base64 dentro de `inlineData`, junto al prompt de texto, en un solo request. No hay que subir el archivo a ningún lado.
- **JSON mode**: `responseMimeType: "application/json"` obliga al modelo a responder JSON válido — sin "```json" ni texto alrededor. Igual conviene el `try/catch` en el parse.
- **`temperature: 0.1`**: extracción de datos quiere respuestas deterministas, no creatividad.
- **El override de clasificación**: a veces el modelo dice `isInvoice: false` pero clasifica bien el `documentType`. La regla del proyecto hermano: si el tipo es válido, es comprobante. Confiamos en la clasificación más que en el booleano.

## 4. Solución completa (consultar si te trabás)

<details>
<summary>Ver código completo</summary>

```typescript
import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";

const MODEL = "gemini-2.5-flash-lite";

export interface ExtractionResult {
  isInvoice: boolean;
  documentType: "factura" | "recibo" | "ticket" | "comprobante_pago" | "otro";
  reason: string;
  data?: {
    proveedor: string;
    cuit: string;
    fecha: string;
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

function detectMimeType(buffer: Buffer, filePath: string): string {
  if (buffer.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function main() {
  // TODO 2 — argumento
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npm run gemini -- <ruta-a-imagen-o-pdf>");
    process.exit(1);
  }

  // TODO 3 — API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Falta GEMINI_API_KEY en .env.local (ver .env.local.example)");
    process.exit(1);
  }

  // TODO 4 — leer archivo + mime
  const buffer = readFileSync(filePath);
  const mimeType = detectMimeType(buffer, filePath);
  console.log(`📄 ${filePath} (${mimeType}, ${(buffer.length / 1024).toFixed(0)} KB)`);

  // TODO 5 — llamada a Gemini
  const client = new GoogleGenAI({ apiKey });
  console.log(`🤖 Consultando ${MODEL}...`);
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: buffer.toString("base64") } },
        ],
      },
    ],
    config: { responseMimeType: "application/json", temperature: 0.1 },
  });

  // TODO 6 — parse + override
  const text = response.text;
  if (!text) throw new Error("Respuesta vacía de Gemini");
  const result = JSON.parse(text) as ExtractionResult;

  const tiposValidos = ["factura", "recibo", "ticket", "comprobante_pago"];
  result.isInvoice = tiposValidos.includes(result.documentType) || result.isInvoice;

  // TODO 7 — salida + tokens + costo
 
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
```

</details>

## 5. Checklist de verificación de la fase

- [ ] `npm run gemini -- ../factura-scanner-mvp/backend/images/mercado_pago.jpeg` → JSON con proveedor y total correctos.
- [ ] Probar los demás archivos de `../factura-scanner-mvp/backend_node/comprobantes/`.
- [ ] Probar con una foto que NO sea un comprobante (cualquier imagen) → `isInvoice: false` con `reason` explicando.
- [ ] Mirar los tokens: una imagen típica debería andar entre 500–2000 tokens de entrada (≈ $0.0002 por comprobante).

## 6. Qué aprendiste para las fases siguientes

- El prompt y el `ExtractionResult` van a ir **tal cual** dentro de una action de Convex (`convex/gemini.ts`, Fase B) — solo cambia de dónde viene el archivo (Convex storage en vez de disco).
- El costo por comprobante que mediste es el número real para proyectar el costo del MVP.

**Siguiente fase:** `docs/GUIA-FASE-B-CONVEX.md` (se crea cuando termines esta).

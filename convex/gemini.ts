"use node";
/**
 * FASE B — La action que procesa el comprobante con Gemini (en background)
 * Guía: docs/GUIA-FASE-B-CONVEX.md (§4)
 *
 * Acá reutilizás tu código de la Fase A (experiments/gemini-test.ts):
 * mismo PROMPT, misma llamada a generateContent, mismo override de clasificación.
 * Lo único distinto: el archivo viene de ctx.storage.get() en vez de readFileSync,
 * y el resultado se guarda con ctx.runMutation en vez de console.log.
 */
// import { v } from "convex/values";
// import { internalAction } from "./_generated/server";
// import { internal } from "./_generated/api";
// import { GoogleGenAI } from "@google/genai";

// const MODEL = "gemini-2.5-flash-lite";
// const PROMPT = `...el de la Fase A...`;

// TODO 1: processReceipt = internalAction({ args: { receiptId: v.id("receipts") }, handler })
//   1. ctx.runMutation(internal.receipts.markProcessing, ...)
//   2. try { ... } catch → markFailed con status "error" (NUNCA dejar docs en "processing")
//   3. doc = ctx.runQuery(internal.receipts.getInternal, ...)
//   4. blob = await ctx.storage.get(doc.storageId) → Buffer.from(await blob.arrayBuffer()).toString("base64")
//   5. llamada a Gemini (API key: process.env.GEMINI_API_KEY — se setea con `npx convex env set`)
//   6. JSON.parse + override: TIPOS_VALIDOS.includes(documentType) || isInvoice
//   7. válido   → saveExtraction (campos + fechaTs parseado de DD/MM/YYYY + rawExtraction)
//      inválido → markFailed con status "not_a_receipt" y errorMessage = reason

// TODO 2: función parseFecha("DD/MM/YYYY") → timestamp ms | undefined (regex + new Date(año, mes-1, día))

export {};

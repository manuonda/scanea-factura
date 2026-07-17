/**
 * FASE B — Schema de la base de datos
 * Guía: docs/GUIA-FASE-B-CONVEX.md (§4)
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// NOTA: sin auth por ahora — cuando se agregue Convex Auth, volver a poner
// authTables, el campo userId y los índices por usuario.
export default defineSchema({
  receipts: defineTable({
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(), // bytes, ya comprimido

    status: v.union(
      v.literal("pending"),      // subido, action agendada
      v.literal("processing"),   // Gemini en vuelo
      v.literal("done"),
      v.literal("error"),
      v.literal("not_a_receipt")
    ),

    // Campos extraídos, aplanados para consultar/exportar (opcionales hasta "done")
    documentType: v.optional(v.string()), // factura|recibo|ticket|comprobante_pago|otro
    proveedor: v.optional(v.string()),
    cuit: v.optional(v.string()),
    fecha: v.optional(v.string()),        // "DD/MM/YYYY" tal como lo devuelve Gemini
    fechaTs: v.optional(v.number()),      // timestamp ms parseado — ordenable
    numeroFactura: v.optional(v.string()),
    total: v.optional(v.number()),
    iva: v.optional(v.number()),
    documento: v.optional(v.number()),

    rawExtraction: v.optional(v.string()), // JSON crudo de Gemini (auditoría/debug)
    errorMessage: v.optional(v.string()),
  }).index("by_fechaTs", ["fechaTs"]), // rangos por fecha del documento
});

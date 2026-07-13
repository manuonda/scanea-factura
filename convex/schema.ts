/**
 * FASE B — Schema de la base de datos
 * Guía: docs/GUIA-FASE-B-CONVEX.md (§4)
 */
import { defineSchema } from "convex/server";
// import { defineTable } from "convex/server";
// import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables, // users, authSessions, authAccounts... (las necesita Convex Auth)

  // TODO 1: definir la tabla "receipts" con defineTable({...}):
  //   - userId (v.id("users")), storageId (v.id("_storage")), fileName, mimeType, fileSize
  //   - status: v.union de 5 v.literal: pending | processing | done | error | not_a_receipt
  //   - campos extraídos OPCIONALES (v.optional): documentType, proveedor, cuit,
  //     fecha (string DD/MM/YYYY), fechaTs (number, para ordenar), numeroFactura,
  //     total, iva, documento, rawExtraction, errorMessage
  //
  // TODO 2: índices:
  //   .index("by_user", ["userId"])            → listado + "hoy" (usa _creationTime implícito)
  //   .index("by_user_fechaTs", ["userId", "fechaTs"]) → rangos por fecha del documento
});

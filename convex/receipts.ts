/**
 * FASE B — Mutations y queries de comprobantes
 * Guía: docs/GUIA-FASE-B-CONVEX.md (§4)
 *
 * Regla de oro: TODA función pública arranca con getAuthUserId(ctx)
 * y falla/devuelve vacío si es null.
 */
// import { v } from "convex/values";
// import { paginationOptsValidator } from "convex/server";
// import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
// import { internal } from "./_generated/api";
// import { getAuthUserId } from "@convex-dev/auth/server";

// ---------- públicas (las llama el frontend) ----------

// TODO 1: generateUploadUrl (mutation sin args)
//         → auth check + return ctx.storage.generateUploadUrl()

// TODO 2: createReceipt (mutation: storageId, fileName, mimeType, fileSize)
//         → insert con status "pending"
//         → ctx.scheduler.runAfter(0, internal.gemini.processReceipt, { receiptId })  ← LA COLA

// TODO 3: list (query paginada con paginationOptsValidator)
//         → withIndex("by_user").order("desc").paginate(...)
//         → enriquecer cada item con url: await ctx.storage.getUrl(storageId)

// TODO 4: get (query: id) → ownership check (doc.userId === userId) o null

// TODO 5: listByRange (query: start, end en ms)
//         → withIndex("by_user", q => q.eq(...).gte("_creationTime", start).lt("_creationTime", end))
//         → .collect()

// TODO 6: remove (mutation: id) → ownership check + storage.delete + db.delete

// ---------- internas (solo las usa convex/gemini.ts) ----------

// TODO 7: getInternal (internalQuery: id) → ctx.db.get(id)
// TODO 8: markProcessing (internalMutation: id) → patch status "processing"
// TODO 9: saveExtraction (internalMutation: id + campos opcionales) → patch campos + status "done"
// TODO 10: markFailed (internalMutation: id, status error|not_a_receipt, errorMessage?, rawExtraction?)

export {};

/**
 * FASE B — Mutations y queries de comprobantes
 * Guía: docs/GUIA-FASE-B-CONVEX.md (§4)
 *
 * Regla de oro: TODA función pública arranca con getAuthUserId(ctx)
 * y falla/devuelve vacío si es null.
 */
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------- públicas (las llama el frontend) ----------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("No autenticado");
    return await ctx.storage.generateUploadUrl();
  },
});

export const createReceipt = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("No autenticado");
    const receiptId = await ctx.db.insert("receipts", {
      userId,
      ...args,
      status: "pending",
    });
    // LA COLA: agenda el procesamiento en background y responde ya
    await ctx.scheduler.runAfter(0, internal.gemini.processReceipt, { receiptId });
    return receiptId;
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts);
    // enriquecer con la URL del archivo para thumbnails
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (r) => ({
          ...r,
          url: await ctx.storage.getUrl(r.storageId),
        }))
      ),
    };
  },
});

export const get = query({
  args: { id: v.id("receipts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) return null; // ownership check
    return { ...doc, url: await ctx.storage.getUrl(doc.storageId) };
  },
});

export const listByRange = query({
  args: { start: v.number(), end: v.number() }, // timestamps ms (fecha de escaneo)
  handler: async (ctx, { start, end }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) =>
        q.eq("userId", userId).gte("_creationTime", start).lt("_creationTime", end)
      )
      .collect();
  },
});

export const remove = mutation({
  args: { id: v.id("receipts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) throw new Error("No encontrado");
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(id);
  },
});

// ---------- internas (solo las usa convex/gemini.ts) ----------

export const getInternal = internalQuery({
  args: { id: v.id("receipts") },
  handler: (ctx, { id }) => ctx.db.get(id),
});

export const markProcessing = internalMutation({
  args: { id: v.id("receipts") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "processing" });
  },
});

export const saveExtraction = internalMutation({
  args: {
    id: v.id("receipts"),
    documentType: v.optional(v.string()),
    proveedor: v.optional(v.string()),
    cuit: v.optional(v.string()),
    fecha: v.optional(v.string()),
    fechaTs: v.optional(v.number()),
    numeroFactura: v.optional(v.string()),
    total: v.optional(v.number()),
    iva: v.optional(v.number()),
    documento: v.optional(v.number()),
    rawExtraction: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, { ...fields, status: "done" });
  },
});

export const markFailed = internalMutation({
  args: {
    id: v.id("receipts"),
    status: v.union(v.literal("error"), v.literal("not_a_receipt")),
    errorMessage: v.optional(v.string()),
    rawExtraction: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
  },
});

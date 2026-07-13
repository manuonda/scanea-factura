# Guía Fase B — Backend Convex (DB + storage + cola de procesamiento + auth)

**Objetivo:** el backend completo. Al terminar esta fase, Convex puede: recibir un archivo subido, guardarlo en su storage, procesarlo en background con Gemini (el mismo código de la Fase A adaptado), guardar el JSON extraído en la base de datos, y autenticar usuarios (email/password y Google).

**Archivos a programar** (esqueletos con TODOs ya creados):
- `convex/schema.ts` — las tablas e índices
- `convex/receipts.ts` — mutations/queries públicas + funciones internas
- `convex/gemini.ts` — la action que llama a Gemini (acá reutilizás tu Fase A)
- `convex/auth.ts` — lo crea el scaffold, después lo editás

---

## 1. Setup (una sola vez)

```bash
# 1. Conectar el proyecto a Convex (abre el navegador para login, crea el proyecto
#    y escribe VITE_CONVEX_URL + CONVEX_DEPLOYMENT en .env.local)
npx convex dev
# dejalo corriendo en una terminal aparte: re-deploya cada vez que guardás un archivo de convex/

# 2. En OTRA terminal — scaffold de Convex Auth (configura JWT_PRIVATE_KEY, JWKS, SITE_URL)
npx @convex-dev/auth

# 3. La API key de Gemini, como variable de entorno DEL DEPLOYMENT (no de tu .env.local):
npx convex env set GEMINI_API_KEY <tu-key>
```

> **Concepto**: `npx convex dev` observa la carpeta `convex/`, typechequea y sube tus funciones al deployment de desarrollo. También genera `convex/_generated/` (los tipos de `api`, `internal`, etc.). Si ves errores de import de `./_generated/server`, es porque `npx convex dev` no está corriendo.

## 2. Conceptos clave de Convex antes de codear

- **query** = lectura reactiva (el frontend se re-renderiza solo cuando cambian los datos). **mutation** = escritura transaccional. **action** = código con efectos externos (llamar a Gemini) — es lo ÚNICO que puede hacer `fetch` a APIs externas.
- **Las actions NO tocan la base de datos directamente.** Leen con `ctx.runQuery(internal...)` y escriben con `ctx.runMutation(internal...)`. Por eso `receipts.ts` necesita funciones `internal*` (no expuestas al cliente).
- **La cola**: `ctx.scheduler.runAfter(0, internal.gemini.processReceipt, {...})` dentro de una mutation agenda la action en background. La mutation responde al instante y el procesamiento sigue solo — esa es tu cola LLM sin Redis ni workers.
- **`"use node"`**: la primera línea de `gemini.ts`. Hace que esa action corra en runtime Node.js (necesario para `@google/genai` y `Buffer`).
- **`_creationTime`**: Convex lo agrega solo a cada documento, y todo índice lo incluye implícitamente al final. Por eso el índice `by_user` ya sirve para "comprobantes de hoy" sin campo extra.
- **Auth en el servidor**: `getAuthUserId(ctx)` devuelve el id del usuario logueado (o null). TODA función pública debe chequearlo — es tu única barrera de seguridad.

## 3. Flujo completo que vas a construir

```
[cliente]                     [convex]
subir archivo  ──POST──▶  storage (generateUploadUrl)
createReceipt  ──────▶  insert status:"pending" + scheduler.runAfter(0, processReceipt)
                              │
                              ▼ (background)
                        processReceipt (action, "use node")
                          markProcessing → status:"processing"
                          storage.get(storageId) → base64
                          Gemini (tu código Fase A) → JSON
                          ¿es comprobante?
                            sí → saveExtraction → status:"done" + campos
                            no → markFailed → status:"not_a_receipt" + reason
                            error → markFailed → status:"error"
[cliente] la query `list` se actualiza SOLA en cada cambio de status
```

## 4. Solución completa (consultar si te trabás)

### `convex/schema.ts`

<details>
<summary>Ver código completo</summary>

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables, // users, authSessions, authAccounts, ...

  receipts: defineTable({
    userId: v.id("users"),
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
    documento: v.optional(v.number()),    // el campo que agregaste en Fase A

    rawExtraction: v.optional(v.string()), // JSON crudo de Gemini (auditoría/debug)
    errorMessage: v.optional(v.string()),
  })
    .index("by_user", ["userId"])                     // + _creationTime implícito → "hoy"
    .index("by_user_fechaTs", ["userId", "fechaTs"]), // rangos por fecha del documento
});
```

⚠️ Para que Gemini devuelva `documento`, tenés que agregarlo también al PROMPT (en el JSON de ejemplo del PASO 2), igual que hiciste con el interface.

</details>

### `convex/receipts.ts`

<details>
<summary>Ver código completo</summary>

```typescript
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

// ---------- internas (solo las usa la action de gemini) ----------

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
```

</details>

### `convex/gemini.ts`

<details>
<summary>Ver código completo</summary>

```typescript
"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash-lite";

// EL MISMO PROMPT de tu Fase A (experiments/gemini-test.ts) — copialo acá.
// (Cuando funcione todo, podés moverlo a un archivo compartido para no duplicar.)
const PROMPT = `...tu prompt de la Fase A...`;

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
```

</details>

### `convex/auth.ts` (editar el que crea el scaffold)

<details>
<summary>Ver código completo</summary>

```typescript
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Registro simple: nombre + apellido + email + password
    Password({
      profile(params) {
        return {
          email: params.email as string,
          name: `${params.nombre ?? ""} ${params.apellido ?? ""}`.trim() || undefined,
        };
      },
    }),
    Google, // requiere AUTH_GOOGLE_ID/SECRET — se puede configurar al final (ver §6)
  ],
});
```

Si todavía no configuraste Google OAuth, dejá solo `Password(...)` en el array para que el deploy no falle, y agregá `Google` cuando hagas el paso 6.

</details>

## 5. Prueba del pipeline sin frontend (dashboard de Convex)

Con `npx convex dev` corriendo, abrí el dashboard (la URL aparece en la terminal, o `npx convex dashboard`):

1. **Data → receipts**: la tabla existe (vacía).
2. **Files**: subí a mano un comprobante de prueba → copiá el `storageId`.
3. **Data → users**: todavía no hay usuarios. Para probar sin auth, creá un doc a mano en `users` (con `{}` alcanza) y copiá su `_id`.
4. **Data → receipts → Add document**: creá `{ userId: <id>, storageId: <storageId>, fileName: "test.jpeg", mimeType: "image/jpeg", fileSize: 100000, status: "pending" }`.
5. **Functions → gemini:processReceipt → Run** con `{ "receiptId": "<el _id del doc>" }`.
6. Volvé a **Data → receipts**: el doc tiene que pasar a `done` con proveedor/total/rawExtraction llenos. En **Logs** ves la ejecución de la action.

## 6. Google OAuth (se puede dejar para el final)

1. https://console.cloud.google.com → proyecto nuevo → "OAuth consent screen" (External, agregate como test user).
2. Credentials → Create Credentials → OAuth Client ID → Web application.
3. Authorized redirect URI: `https://<tu-deployment>.convex.site/api/auth/callback/google` — ⚠️ dominio **`.convex.site`**, NO `.convex.cloud` (el error clásico). El nombre del deployment está en `.env.local` (`CONVEX_DEPLOYMENT`).
4. `npx convex env set AUTH_GOOGLE_ID <client-id>` y `npx convex env set AUTH_GOOGLE_SECRET <secret>`.
5. Agregá `Google` al array de providers de `auth.ts`.

## 7. Checklist de verificación de la fase

- [ ] `npx convex dev` deploya sin errores (schema + receipts + gemini + auth).
- [ ] En el dashboard se ven las tablas `receipts`, `users`, `authSessions`...
- [ ] La prueba del §5 procesa un comprobante real: `pending` → `done` con los campos extraídos.
- [ ] Un archivo que no es comprobante termina en `not_a_receipt` con `errorMessage` = reason.
- [ ] `GEMINI_API_KEY` está en `npx convex env list` (NO en el código).

**Siguiente fase:** `docs/GUIA-FASE-C-FRONTEND.md` — la PWA que usa todo esto.

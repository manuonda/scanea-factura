# Estado del proyecto — sesión 2026-07-16

## Qué se hizo hoy (Fase B — Backend Convex)

- Implementados los 3 archivos de la guía `docs/GUIA-FASE-B-CONVEX.md`:
  - `convex/schema.ts` — tabla `receipts` (5 estados, campos extraídos opcionales, índices `by_user` y `by_user_fechaTs`)
  - `convex/receipts.ts` — mutations/queries públicas con auth check + funciones internas para la action
  - `convex/gemini.ts` — action `processReceipt` (prompt de Fase A + campo `documento` agregado al JSON del prompt)
- Proyecto conectado a Convex Cloud (cuenta creada, deployment dev: `strong-crocodile-491`,
  dashboard: https://dashboard.convex.dev/d/strong-crocodile-491).
  `.env.local` tiene `CONVEX_DEPLOYMENT` y `VITE_CONVEX_URL` (NO se commitea — regenerar con `npx convex dev` en otra máquina).
- Deploy exitoso: índices de `receipts` y tablas de auth creados.

## Pendiente (retomar acá)

1. `npx @convex-dev/auth` — scaffold de Convex Auth (crea `convex/auth.ts` + `convex/http.ts`, configura JWT). **NO se corrió todavía.**
2. `npx convex env set GEMINI_API_KEY <key>` — **NO se seteó todavía.**
3. Editar `convex/auth.ts` con `Password` (nombre + apellido); `Google` OAuth queda para el final (§6 de la guía).
4. Prueba del pipeline sin frontend (§5 de la guía, desde el dashboard).
5. Fase C (frontend): decidido usar el adapter oficial `@convex-dev/react-query` (TanStack Query sobre Convex) en lugar de `useQuery` pelado de Convex.

## Decisiones tomadas

- Convex Cloud (plan gratuito) en vez de backend local (el binario local falla por glibc vieja en esta máquina) o VPS. Self-host en VPS queda como opción futura si el plan Pro ($25) doliera.
- Deploy futuro: frontend en Vercel (integración oficial con Convex), backend en Convex Cloud (`npx convex deploy` para prod).
- Conversación en español; código en inglés con términos de dominio argentino (`proveedor`, `cuit`, etc.).

## Nota para otra máquina

`npx convex dev` → login → elegir el proyecto existente `scanea-comprobante` → regenera `.env.local` y `convex/_generated/`.

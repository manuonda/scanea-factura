# Scanea Comprobante

PWA mobile-first para escanear comprobantes argentinos (facturas AFIP, tickets, transferencias MP/bancos), extraer los datos con Gemini, listarlos en tiempo real y exportarlos a Excel (.xlsx).

**Stack:** Vite + React + TypeScript (PWA) · Convex (DB + storage + cola LLM + auth) · Google Gemini 2.5 Flash-Lite

**Modo de trabajo:** los archivos tienen esqueletos con TODOs para programarlos uno mismo; cada fase tiene su guía en `docs/` con el código completo explicado.

## Fases

| Fase | Qué se construye | Guía | Estado |
|------|------------------|------|--------|
| A | Conexión con Gemini: script standalone que extrae el JSON de un comprobante | [docs/GUIA-FASE-A-GEMINI.md](docs/GUIA-FASE-A-GEMINI.md) | 🔨 en curso |
| B | Convex: schema, subida de archivos, cola de procesamiento (scheduler) + auth | docs/GUIA-FASE-B-CONVEX.md | pendiente |
| C | Frontend PWA: captura con cámara, validación (1 página, tamaño), listado en vivo, detalle, export .xlsx | docs/GUIA-FASE-C-FRONTEND.md | pendiente |

Plan completo aprobado: decisiones de arquitectura, schema, gotchas — preguntar a Claude o ver `.claude/` del proyecto.

## Comandos

```bash
npm run dev        # frontend Vite (Fase C)
npm run gemini -- <archivo>   # Fase A: probar extracción con un comprobante
npx convex dev     # backend Convex (Fase B)
```

## Setup

1. `npm install`
2. `cp .env.local.example .env.local` y completar `GEMINI_API_KEY` (https://aistudio.google.com/apikey)
3. Comprobantes de prueba: `../factura-scanner-mvp/backend/images/` y `../factura-scanner-mvp/backend_node/comprobantes/`

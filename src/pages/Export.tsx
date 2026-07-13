/**
 * FASE C — Export a Excel: "Exportar HOY" + rango de fechas
 * Guía: docs/GUIA-FASE-C-FRONTEND.md (§2)
 */
// import { useState } from "react";
// import { useConvex } from "convex/react";
// import { api } from "../../convex/_generated/api";
// import { exportXlsx } from "../lib/exportXlsx";

// TODO 1: query ONE-SHOT (no suscripción): const convex = useConvex();
//         const rows = await convex.query(api.receipts.listByRange, { start, end })
//         — se ejecuta solo al apretar el botón, no mantiene conexión
// TODO 2: botón "Exportar HOY": start = hoy 00:00 local, end = start + 86_400_000
// TODO 3: rango con dos <input type="date"> (ojo: new Date("2026-07-11") es UTC;
//         usar new Date(`${iso}T00:00:00`) para hora local)
// TODO 4: checkbox "solo status done" (default true) → filtrar antes de exportXlsx
// TODO 5: mensaje de resultado ("✓ N comprobantes exportados" / "No hay comprobantes en ese rango")

export default function Export() {
  return <p className="p-8 text-center">Export sin implementar (Fase C)</p>;
}

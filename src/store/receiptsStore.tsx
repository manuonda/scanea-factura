/**
 * FASE C LOCAL — Store en memoria (reemplaza a Convex mientras no está la Fase B)
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 *
 * Un Context + useState que hace de "base de datos" en memoria. Cualquier componente
 * que llame a useReceiptsStore() lee el mismo array y se re-renderiza cuando cambia.
 * Se pierde todo al refrescar — es intencional para esta fase de validación.
 */
// import { createContext, useContext, useState, type ReactNode } from "react";

export type ReceiptStatus = "pending" | "processing" | "done" | "error" | "not_a_receipt";

// TODO 1: LocalReceipt — mismos campos que va a tener la tabla "receipts" de Convex
//         (así migrar después es mecánico): id, file (File), fileName, mimeType, fileSize,
//         status: ReceiptStatus, createdAt (number), + opcionales: documentType, proveedor,
//         cuit, fecha, numeroFactura, total, iva, errorMessage

// TODO 2: ReceiptsStore (la forma del contexto):
//         receipts: LocalReceipt[]
//         addReceipt(file): string          → crea con status "pending", devuelve el id
//         updateReceipt(id, patch): void     → merge parcial
//         removeReceipt(id): void
//         getReceipt(id): LocalReceipt | undefined

// TODO 3: ReceiptsContext = createContext<ReceiptsStore | null>(null)

// TODO 4: ReceiptsProvider({ children }) — useState<LocalReceipt[]>([]) + las 4 funciones
//         de arriba implementadas con setReceipts, y <ReceiptsContext.Provider value={...}>

// TODO 5: useReceiptsStore() — useContext(ReceiptsContext), tirar error si es null
//         (te olvidaste de envolver <App> con <ReceiptsProvider> en main.tsx)

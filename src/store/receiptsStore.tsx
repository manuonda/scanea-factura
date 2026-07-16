/**
 * FASE C LOCAL — Store en memoria (reemplaza a Convex mientras no está la Fase B)
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 *
 * Un Context + useState que hace de "base de datos" en memoria. Cualquier componente
 * que llame a useReceiptsStore() lee el mismo array y se re-renderiza cuando cambia.
 * Se pierde todo al refrescar — es intencional para esta fase de validación.
 */
import { createContext, useContext, useState, type ReactNode } from "react";

export type ReceiptStatus = "pending" | "processing" | "done" | "error" | "not_a_receipt";

// Mismos campos que va a tener la tabla "receipts" de Convex — migrar después es mecánico
export interface LocalReceipt {
  id: string;
  file: File;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: ReceiptStatus;
  createdAt: number;
  documentType?: string;
  proveedor?: string;
  cuit?: string;
  fecha?: string;
  numeroFactura?: string;
  total?: number;
  iva?: number | null;
  errorMessage?: string;
}

interface ReceiptsStore {
  receipts: LocalReceipt[];
  addReceipt: (file: File) => string;
  updateReceipt: (id: string, patch: Partial<LocalReceipt>) => void;
  removeReceipt: (id: string) => void;
  getReceipt: (id: string) => LocalReceipt | undefined;
}

const ReceiptsContext = createContext<ReceiptsStore | null>(null);

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);

  const addReceipt = (file: File) => {
    const id = crypto.randomUUID();
    setReceipts((prev) => [
      {
        id,
        file,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        status: "pending",
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    return id;
  };

  const updateReceipt = (id: string, patch: Partial<LocalReceipt>) =>
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeReceipt = (id: string) => setReceipts((prev) => prev.filter((r) => r.id !== id));

  const getReceipt = (id: string) => receipts.find((r) => r.id === id);

  return (
    <ReceiptsContext.Provider value={{ receipts, addReceipt, updateReceipt, removeReceipt, getReceipt }}>
      {children}
    </ReceiptsContext.Provider>
  );
}

export function useReceiptsStore() {
  const ctx = useContext(ReceiptsContext);
  if (!ctx) throw new Error("useReceiptsStore debe usarse dentro de <ReceiptsProvider>");
  return ctx;
}

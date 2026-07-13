/**
 * FASE C — Generación del .xlsx en el cliente (SheetJS)
 * Guía: docs/GUIA-FASE-C-FRONTEND.md (§2)
 */
// import * as XLSX from "xlsx";

export interface ExportRow {
  fecha?: string;
  proveedor?: string;
  cuit?: string;
  numeroFactura?: string;
  documentType?: string;
  total?: number;
  iva?: number;
  status: string;
  fileName: string;
  _creationTime: number;
}

// TODO: exportXlsx(rows, nombre):
//   1. mapear rows a objetos con las columnas en español:
//      Fecha Doc, Proveedor, CUIT, Nro Comprobante, Tipo, Total, IVA, Estado, Archivo, Escaneado
//   2. XLSX.utils.json_to_sheet(data) → XLSX.utils.book_new() → book_append_sheet
//   3. XLSX.writeFile(wb, `${nombre}.xlsx`)  ← dispara la descarga, también en mobile

export function exportXlsx(_rows: ExportRow[], _nombre: string): void {
  throw new Error("exportXlsx sin implementar (Fase C)");
}

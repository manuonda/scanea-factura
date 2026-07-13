/**
 * FASE C — Compresión de imágenes antes de subir
 * Guía: docs/GUIA-FASE-C-FRONTEND.md (§2)
 *
 * Por qué importa: baja storage, egress Y tokens de Gemini a la vez.
 * Un comprobante a 1600px / ~0.8MB se lee perfecto.
 */
// import imageCompression from "browser-image-compression";

// TODO: compressImage(file) → imageCompression(file, { maxSizeMB: 0.8,
//       maxWidthOrHeight: 1600, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.8 })

export async function compressImage(file: File): Promise<File> {
  return file; // placeholder: devuelve sin comprimir — reemplazar
}

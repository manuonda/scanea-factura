/**
 * FASE C LOCAL — Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 * <App /> envuelta con <ReceiptsProvider> para que Capture/Receipts/ReceiptDetail
 * puedan leer y escribir el store en memoria.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ReceiptsProvider } from './store/receiptsStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReceiptsProvider>
      <App />
    </ReceiptsProvider>
  </StrictMode>,
)

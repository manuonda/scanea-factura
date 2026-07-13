/**
 * FASE C LOCAL — Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 * TODO: envolver <App /> con <ReceiptsProvider> (de src/store/receiptsStore.tsx)
 *       para que Capture/Receipts/ReceiptDetail puedan leer y escribir el store.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// import { ReceiptsProvider } from './store/receiptsStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

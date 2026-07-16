/**
 * FASE C LOCAL — Shell con tabs (sin login, sin Convex)
 * Guía: docs/GUIA-FASE-C-LOCAL.md (§2)
 */
import { useState } from "react";
import Capture from "./pages/Capture";
import Receipts from "./pages/Receipts";
import ReceiptDetail from "./pages/ReceiptDetail";

type Tab = "capture" | "receipts";

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">Scanea Comprobante</h1>
        <span className="text-xs text-slate-400">prototipo local</span>
      </header>

      <main className="flex-1 overflow-y-auto">
        {selectedId ? (
          <ReceiptDetail id={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            {tab === "capture" && <Capture onDone={() => setTab("receipts")} />}
            {tab === "receipts" && <Receipts onSelect={setSelectedId} />}
          </>
        )}
      </main>

      <nav className="grid grid-cols-2 border-t bg-white">
        {(
          [
            ["capture", "📷 Escanear"],
            ["receipts", "🧾 Comprobantes"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => { setSelectedId(null); setTab(t); }}
            className={`py-3 text-sm ${tab === t ? "font-bold text-slate-900" : "text-gray-500"}`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

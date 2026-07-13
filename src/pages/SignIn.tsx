/**
 * FASE C — Login: Google + registro email/password (nombre, apellido)
 * Guía: docs/GUIA-FASE-C-FRONTEND.md (§2)
 */
// import { useState } from "react";
// import { useAuthActions } from "@convex-dev/auth/react";

// TODO 1: botón "Continuar con Google" → signIn("google")
// TODO 2: form con estado flow "signIn" | "signUp":
//         - en signUp: inputs nombre y apellido (llegan al profile() de convex/auth.ts)
//         - submit: FormData del form + formData.set("flow", flow) → signIn("password", formData)
//         - catch → mensaje de error legible
// TODO 3: toggle entre "¿No tenés cuenta? Registrate" / "¿Ya tenés cuenta? Ingresá"

export default function SignIn() {
  return <p className="p-8 text-center">SignIn sin implementar (Fase C)</p>;
}

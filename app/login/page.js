"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { LogIn } from "lucide-react";
import Footer from "../../components/Footer";
import AresaBackdrop from "../../components/AresaBackdrop";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.replace("/ingreso-egreso");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ backgroundColor: "rgba(22, 58, 95, 0.05)" }}>
      <AresaBackdrop />
      <div className="w-full max-w-sm relative">
        <div className="flex items-center justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.png" alt="Simonetti Montajes Industriales" className="h-12 w-auto" />
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-line rounded-sm p-6">
          <h1 className="font-display text-xl font-semibold text-ink mb-4">Iniciar sesión</h1>

          {error && <p className="text-sm text-red mb-4">{error}</p>}

          <label className="block mb-3">
            <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">Correo</span>
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>

          <label className="block mb-5">
            <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">Contraseña</span>
            <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            <LogIn size={15} /> {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <Footer />
      </div>
    </div>
  );
}

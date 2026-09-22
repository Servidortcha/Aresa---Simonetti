"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { UserPlus } from "lucide-react";
import Footer from "../../components/Footer";
import AresaBackdrop from "../../components/AresaBackdrop";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(error.message.includes("already registered") ? "Ese correo ya está registrado. Iniciá sesión." : error.message);
      return;
    }
    if (data.session) {
      router.replace("/sin-acceso");
    } else {
      setOk(true);
    }
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
          <h1 className="font-display text-xl font-semibold text-ink mb-1">Crear cuenta</h1>
          <p className="text-xs text-[#6B6558] mb-4">Después el administrador te activa el acceso y te asigna tu frente.</p>

          {error && <p className="text-sm text-red mb-4">{error}</p>}
          {ok && (
            <p className="text-sm text-green mb-4">
              Cuenta creada. Pedile al administrador que te active el acceso y después iniciá sesión.
            </p>
          )}

          <label className="block mb-3">
            <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">Correo</span>
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>

          <label className="block mb-3">
            <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">Contraseña</span>
            <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <label className="block mb-5">
            <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">Repetir contraseña</span>
            <input type="password" className={inputCls} value={password2} onChange={(e) => setPassword2(e.target.value)} required />
          </label>

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            <UserPlus size={15} /> {loading ? "Creando..." : "Crear cuenta"}
          </button>

          <p className="text-xs text-center text-[#6B6558] mt-4">
            ¿Ya tenés cuenta? <Link href="/login" className="text-[#3B5166] hover:underline">Iniciar sesión</Link>
          </p>
        </form>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <Footer />
      </div>
    </div>
  );
}

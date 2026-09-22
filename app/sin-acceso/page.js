"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { Clock, LogOut } from "lucide-react";
import Footer from "../../components/Footer";
import AresaBackdrop from "../../components/AresaBackdrop";

export default function SinAccesoPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || "");
    });
  }, []);

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ backgroundColor: "rgba(22, 58, 95, 0.05)" }}>
      <AresaBackdrop />
      <div className="w-full max-w-sm relative">
        <div className="flex items-center justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.png" alt="Simonetti Montajes Industriales" className="h-12 w-auto" />
        </div>

        <div className="bg-white border border-line rounded-sm p-6 text-center">
          <Clock size={28} color="#F4791E" className="mx-auto mb-3" />
          <h1 className="font-display text-xl font-semibold text-ink mb-2">Cuenta pendiente de activación</h1>
          <p className="text-sm text-[#6B6558] mb-1">
            {email ? <>Tu cuenta <b>{email}</b> fue creada correctamente.</> : "Tu cuenta fue creada correctamente."}
          </p>
          <p className="text-sm text-[#6B6558] mb-5">
            Pedile al administrador que te active el acceso y te asigne tu rol. Después vas a poder entrar.
          </p>
          <button onClick={salir} className="w-full flex items-center justify-center gap-2 border border-line text-ink py-2.5 rounded-sm text-sm font-medium hover:bg-[#F2EEE3]">
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <Footer />
      </div>
    </div>
  );
}

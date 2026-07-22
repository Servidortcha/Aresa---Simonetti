"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { AuthContext } from "../../lib/AuthContext";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";

export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [rol, setRol] = useState(null);

  async function loadRol(userId) {
    const { data } = await supabase.from("perfiles").select("rol").eq("id", userId).single();
    setRol(data?.rol || "operario");
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setSession(data.session);
        await loadRol(data.session.user.id);
      }
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        router.replace("/login");
      } else {
        await loadRol(newSession.user.id);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  if (checking || (session && rol === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-[#6B6558] text-sm">
        Verificando sesión...
      </div>
    );
  }

  if (!session) return null;

  return (
    <AuthContext.Provider value={{ session, rol }}>
      <div className="sm:flex sm:min-h-screen">
        <Nav userEmail={session.user?.email} rol={rol} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1">{children}</div>
          <Footer />
        </div>
      </div>
    </AuthContext.Provider>
  );
}

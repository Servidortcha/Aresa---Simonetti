"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const TABS = [
  { href: "/ingreso-egreso", label: "Ingreso / Egreso", short: "Mov." },
  { href: "/stock", label: "Stock", short: "Stock" },
  { href: "/movimientos", label: "Movimientos", short: "Historial" },
  { href: "/stock-panol", label: "Stock Pañol", short: "Pañol", adminOnly: true },
  { href: "/trabajos", label: "Trabajos", short: "Trabajos" },
  { href: "/taller", label: "Taller", short: "Taller", adminOnly: true },
];

export default function Nav({ userEmail, rol }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs =
    rol === "admin"
      ? TABS
      : rol === "taller_stock"
      ? TABS.filter((t) => t.href === "/ingreso-egreso" || t.href === "/stock" || t.href === "/trabajos")
      : TABS.filter((t) => t.href === "/ingreso-egreso");

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="bg-ink text-paper flex flex-row sm:flex-col gap-3 sm:gap-6 px-4 sm:px-4 py-3 sm:py-6 sm:w-56 sm:flex-shrink-0 sm:min-h-screen sm:sticky sm:top-0 sm:h-screen sm:overflow-y-auto">
      {/* Logo + botón salir en móvil */}
      <div className="flex items-center justify-between sm:justify-start gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-paper rounded-sm px-2.5 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horizontal.png" alt="Simonetti Montajes Industriales" className="h-5 sm:h-6 w-auto" />
          </div>
          <span className="text-xs text-green ml-1 font-mono hidden md:inline sm:hidden lg:inline">insumos · producción</span>
        </div>
        <button onClick={handleLogout} className="sm:hidden flex items-center gap-1.5 px-2 py-1 rounded-sm text-[#B8B2A2] hover:text-paper" title="Cerrar sesión">
          <LogOut size={16} />
        </button>
      </div>

      {/* Pestañas */}
      <div className="flex items-center sm:flex-col sm:items-stretch gap-1 text-sm overflow-x-auto sm:overflow-visible no-scrollbar sm:flex-1">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 sm:px-3 py-1.5 sm:py-2 rounded-sm transition-colors whitespace-nowrap flex-shrink-0 sm:w-full"
            style={{
              backgroundColor: pathname === t.href ? "#F2EEE3" : "transparent",
              color: pathname === t.href ? "#1C1F1C" : "#B8B2A2",
              fontWeight: pathname === t.href ? 600 : 400,
            }}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </Link>
        ))}
      </div>

      {/* Usuario + cerrar sesión, al pie del sidebar en pantallas grandes */}
      <div className="hidden sm:flex sm:flex-col sm:gap-2 sm:pt-4 sm:border-t sm:border-[#3A3D38]">
        {userEmail && <span className="text-xs text-[#8A8578] truncate">{userEmail}</span>}
        <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[#B8B2A2] hover:text-paper hover:bg-[#333731] transition-colors w-full">
          <LogOut size={15} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

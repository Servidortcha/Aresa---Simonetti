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
];

export default function Nav({ userEmail, rol }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs =
    rol === "admin"
      ? TABS
      : rol === "taller_stock"
      ? TABS.filter((t) => t.href === "/ingreso-egreso" || t.href === "/stock")
      : TABS.filter((t) => t.href === "/ingreso-egreso");

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="bg-ink text-paper px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center justify-between sm:justify-start gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-paper rounded-sm px-2.5 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horizontal.png" alt="Simonetti Montajes Industriales" className="h-5 sm:h-6 w-auto" />
          </div>
          <span className="text-xs text-green ml-1 font-mono hidden md:inline">insumos · producción</span>
        </div>
        <button onClick={handleLogout} className="sm:hidden flex items-center gap-1.5 px-2 py-1 rounded-sm text-[#B8B2A2] hover:text-paper" title="Cerrar sesión">
          <LogOut size={16} />
        </button>
      </div>
      <div className="flex items-center gap-1 text-sm overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 sm:px-4 py-1.5 rounded-sm transition-colors whitespace-nowrap flex-shrink-0"
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
        <div className="w-px h-5 bg-[#3A3D38] mx-2 hidden sm:block" />
        {userEmail && <span className="text-xs text-[#8A8578] mr-2 hidden lg:inline">{userEmail}</span>}
        <button onClick={handleLogout} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[#B8B2A2] hover:text-paper hover:bg-[#333731] transition-colors flex-shrink-0" title="Cerrar sesión">
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}

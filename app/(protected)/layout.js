"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const TABS = [
  { href: "/ingreso-egreso", label: "Ingreso / Egreso" },
  { href: "/stock", label: "Stock" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/stock-panol", label: "Stock Pañol", adminOnly: true },
  { href: "/trabajos", label: "Trabajos" },
  { href: "/taller", label: "Taller", adminOnly: true },
];

function AresaMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="40" width="10" height="26" fill="#14C3B0" />
      <rect x="21" y="28" width="10" height="38" fill="#2E6F9E" />
      <rect x="36" y="14" width="10" height="52" fill="#8FA0AC" />
      <rect x="51" y="34" width="10" height="32" fill="#2E6F9E" />
    </svg>
  );
}

export default function Nav({ userEmail, rol }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
    <>
      {/* Barra superior delgada, siempre visible */}
      <div className="bg-ink text-paper px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="text-paper hover:opacity-80" aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <div className="bg-paper rounded-sm px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horizontal.png" alt="Simonetti Montajes Industriales" className="h-4 sm:h-5 w-auto" />
          </div>
        </div>
        <button onClick={handleLogout} className="text-[#B8B2A2] hover:text-paper" title="Cerrar sesión">
          <LogOut size={17} />
        </button>
      </div>

      {/* Fondo oscuro detrás del menú, solo cuando está abierto */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setOpen(false)}
      />

      {/* Menú desplegable */}
      <div
        className={`fixed top-0 left-0 h-full w-64 max-w-[78vw] bg-ink text-paper z-50 flex flex-col px-5 py-5 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="bg-paper rounded-sm px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-horizontal.png" alt="Simonetti Montajes Industriales" className="h-5 w-auto" />
          </div>
          <button onClick={() => setOpen(false)} className="text-[#B8B2A2] hover:text-paper" aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-sm text-sm transition-colors"
              style={{
                backgroundColor: pathname === t.href ? "#F2EEE3" : "transparent",
                color: pathname === t.href ? "#1C1F1C" : "#B8B2A2",
                fontWeight: pathname === t.href ? 600 : 400,
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t border-[#3A3D38]">
          {userEmail && <span className="text-xs text-[#8A8578] truncate">{userEmail}</span>}
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-sm text-[#B8B2A2] hover:text-paper hover:bg-[#333731] transition-colors text-sm">
            <LogOut size={15} /> Cerrar sesión
          </button>
          <div className="flex items-center gap-1.5 text-[10px] text-[#6A6F76] pt-1">
            <AresaMark />
            <span>Powered by Aresa</span>
          </div>
        </div>
      </div>
    </>
  );
}

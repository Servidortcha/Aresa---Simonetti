"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import * as XLSX from "xlsx";
import { History, ArrowDownCircle, ArrowUpCircle, Download } from "lucide-react";

export default function MovimientosPage() {
  const { rol } = useAuth();
  const router = useRouter();
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("movimientos")
        .select("id, tipo, cantidad, nota, fecha, producto_texto, usuario_email, insumos(nombre, unidad)")
        .order("fecha", { ascending: false });
      if (error) setError(error.message);
      else setMovimientos(data);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (rol && rol !== "admin") router.replace("/ingreso-egreso");
  }, [rol, router]);

  function exportarExcel() {
    const filas = movimientos.map((m) => ({
      Fecha: new Date(m.fecha).toLocaleString("es-MX"),
      Insumo: m.insumos?.nombre,
      Tipo: m.tipo === "entrada" ? "Entrada" : "Salida",
      Cantidad: m.cantidad,
      Unidad: m.insumos?.unidad,
      "Usado en": m.producto_texto || "",
      Nota: m.nota || "",
      Usuario: m.usuario_email || "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Movimientos");
    XLSX.writeFile(libro, `movimientos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rol && rol !== "admin") return null;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <History size={20} color="#F4791E" />
          <h1 className="font-display text-3xl font-semibold">Historial de movimientos</h1>
        </div>
        <button onClick={exportarExcel} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
          <Download size={16} /> Exportar a Excel
        </button>
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      <div className="bg-white border border-line rounded-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Insumo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Usado en</th>
              <th className="px-4 py-3 font-medium">Nota</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
            {!loading && movimientos.map((m, idx) => (
              <tr key={m.id} className={idx !== movimientos.length - 1 ? "border-b border-[#EFEBE0]" : ""}>
                <td className="px-4 py-3 text-[#6B6558] font-mono">{new Date(m.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-4 py-3 font-medium">{m.insumos?.nombre}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: m.tipo === "entrada" ? "#4B7355" : "#C7522A" }}>
                    {m.tipo === "entrada" ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                    {m.tipo === "entrada" ? "Entrada" : "Salida"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">{m.cantidad} {m.insumos?.unidad}</td>
                <td className="px-4 py-3 text-[#4A463D]">{m.producto_texto || "—"}</td>
                <td className="px-4 py-3 text-[#8A8578]">{m.nota || "—"}</td>
                <td className="px-4 py-3 text-[#8A8578] text-xs">{m.usuario_email?.replace("@simonetti.local", "") || "—"}</td>
              </tr>
            ))}
            {!loading && movimientos.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Aún no hay movimientos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

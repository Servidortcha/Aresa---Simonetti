"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { History, ArrowDownCircle, ArrowUpCircle, Download, Search, Settings2, X } from "lucide-react";

function tipoInfo(tipo) {
  if (tipo === "entrada") return { label: "Entrada", color: "#4B7355", Icon: ArrowDownCircle };
  if (tipo === "salida") return { label: "Salida", color: "#C7522A", Icon: ArrowUpCircle };
  return { label: "Ajuste", color: "#B25A1E", Icon: Settings2 };
}

function cantidadConSigno(m) {
  const cant = m.cantidad ?? "";
  const uni = m.insumos?.unidad || "";
  if (m.tipo === "entrada") return `+${cant} ${uni}`;
  if (m.tipo === "salida") return `-${cant} ${uni}`;
  return `${cant} ${uni}`;
}

export default function MovimientosPage() {
  const { rol } = useAuth();
  const router = useRouter();
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [depositoFilter, setDepositoFilter] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("movimientos")
        .select("id, tipo, cantidad, nota, fecha, producto_texto, usuario_email, stock_resultante, insumos(nombre, unidad, deposito)")
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

  const filtered = useMemo(() => {
    return movimientos.filter((m) => {
      if (query) {
        const q = query.toLowerCase();
        const ins = (m.insumos?.nombre || "").toLowerCase();
        const nota = (m.nota || "").toLowerCase();
        const uso = (m.producto_texto || "").toLowerCase();
        const usr = (m.usuario_email || "").toLowerCase();
        if (!(ins.includes(q) || nota.includes(q) || uso.includes(q) || usr.includes(q))) return false;
      }
      if (tipoFilter !== "todos" && m.tipo !== tipoFilter) return false;
      if (depositoFilter !== "todos" && (m.insumos?.deposito || "") !== depositoFilter) return false;
      const fechaStr = (m.fecha || "").slice(0, 10);
      if (desde && fechaStr < desde) return false;
      if (hasta && fechaStr > hasta) return false;
      return true;
    });
  }, [movimientos, query, tipoFilter, depositoFilter, desde, hasta]);

  const hayFiltros = query || tipoFilter !== "todos" || depositoFilter !== "todos" || desde || hasta;

  function limpiarFiltros() {
    setQuery("");
    setTipoFilter("todos");
    setDepositoFilter("todos");
    setDesde("");
    setHasta("");
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = filtered.map((m) => ({
      Fecha: new Date(m.fecha).toLocaleString("es-MX"),
      Insumo: m.insumos?.nombre,
      Depósito: m.insumos?.deposito || "",
      Tipo: tipoInfo(m.tipo).label,
      Cantidad: cantidadConSigno(m),
      Unidad: m.insumos?.unidad,
      "Stock resultante": m.stock_resultante ?? "",
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

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-line rounded-sm px-3 py-2 w-full sm:max-w-xs">
          <Search size={15} color="#6B6558" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar insumo, nota, usado en o usuario" className="flex-1 text-sm outline-none" />
        </div>
        <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="bg-white border border-line rounded-sm px-3 py-2 text-sm text-ink">
          <option value="todos">Todos los tipos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
          <option value="ajuste">Ajustes</option>
        </select>
        <select value={depositoFilter} onChange={(e) => setDepositoFilter(e.target.value)} className="bg-white border border-line rounded-sm px-3 py-2 text-sm text-ink">
          <option value="todos">Todos los depósitos</option>
          <option value="Principal">Principal</option>
          <option value="Pañol">Pañol</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[#6B6558]">
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-white border border-line rounded-sm px-2 py-2 text-sm text-ink" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[#6B6558]">
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-white border border-line rounded-sm px-2 py-2 text-sm text-ink" />
        </label>
        {hayFiltros && (
          <button onClick={limpiarFiltros} className="inline-flex items-center gap-1 text-sm text-[#3B5166] hover:underline">
            <X size={14} /> Limpiar filtros
          </button>
        )}
      </div>

      {!loading && hayFiltros && (
        <p className="text-xs text-[#8A8578] mb-3">{filtered.length} movimiento{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</p>
      )}

      {/* Móvil: tarjetas */}
      <div className="sm:hidden space-y-3">
        {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
        {!loading &&
          filtered.map((m) => {
            const ti = tipoInfo(m.tipo);
            return (
              <div key={m.id} className="bg-white border border-line rounded-sm p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium leading-snug">{m.insumos?.nombre || "—"}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: ti.color }}>
                    <ti.Icon size={14} />
                    {ti.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Fecha</span>
                    <span className="font-mono text-[#6B6558]">{new Date(m.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Cantidad</span>
                    <span className="font-mono">{cantidadConSigno(m)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Depósito</span>
                    <span className="text-[#8A8578] text-xs">{m.insumos?.deposito || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Stock resultante</span>
                    <span className="font-mono text-[#6B6558]">{m.stock_resultante ?? "—"} {m.stock_resultante != null ? m.insumos?.unidad : ""}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Usuario</span>
                    <span className="text-[#8A8578] text-xs">{m.usuario_email?.replace("@simonetti.local", "") || "—"}</span>
                  </div>
                </div>
                {(m.producto_texto || m.nota) && (
                  <div className="mt-2 pt-2 border-t border-[#EFEBE0] text-sm space-y-1">
                    {m.producto_texto && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-[#8A8578] mr-1.5">Usado en</span>
                        <span className="text-[#4A463D]">{m.producto_texto}</span>
                      </div>
                    )}
                    {m.nota && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-[#8A8578] mr-1.5">Nota</span>
                        <span className="text-[#8A8578]">{m.nota}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-sm text-[#8A8578] py-8">{hayFiltros ? "No hay movimientos que coincidan con los filtros" : "Aún no hay movimientos registrados"}</p>
        )}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Insumo</th>
              <th className="px-4 py-3 font-medium">Depósito</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Stock resultante</th>
              <th className="px-4 py-3 font-medium">Usado en</th>
              <th className="px-4 py-3 font-medium">Nota</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
            {!loading && filtered.map((m, idx) => {
              const ti = tipoInfo(m.tipo);
              return (
                <tr key={m.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== filtered.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                  <td className="px-4 py-3 text-[#6B6558] font-mono whitespace-nowrap">{new Date(m.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-4 py-3 font-medium">{m.insumos?.nombre}</td>
                  <td className="px-4 py-3 text-[#6B6558]">{m.insumos?.deposito || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: ti.color }}>
                      <ti.Icon size={14} />
                      {ti.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{cantidadConSigno(m)}</td>
                  <td className="px-4 py-3 font-mono text-[#6B6558]">{m.stock_resultante ?? "—"} {m.stock_resultante != null ? m.insumos?.unidad : ""}</td>
                  <td className="px-4 py-3 text-[#4A463D]">{m.producto_texto || "—"}</td>
                  <td className="px-4 py-3 text-[#8A8578]">{m.nota || "—"}</td>
                  <td className="px-4 py-3 text-[#8A8578] text-xs">{m.usuario_email?.replace("@simonetti.local", "") || "—"}</td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[#8A8578]">{hayFiltros ? "No hay movimientos que coincidan con los filtros" : "Aún no hay movimientos registrados"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

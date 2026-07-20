"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import * as XLSX from "xlsx";
import { AlertTriangle, Search, Plus, X, Pencil, Trash2, Download } from "lucide-react";

const CATS = ["Químicos", "Empaques", "Metales", "Textiles", "Seguridad", "Insumos para Fabricación"];
const UNITS = ["kg", "L", "unid", "m"];
const emptyForm = { nombre: "", categoria: "", unidad: UNITS[0], stock: "", minimo: "" };

function StockGauge({ stock, minimo }) {
  const ratio = Math.min(stock / (minimo * 2 || 1), 1);
  const low = stock < minimo;
  const color = low ? "#C7522A" : ratio < 0.6 ? "#F4791E" : "#4B7355";
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
      </div>
      {low && <AlertTriangle size={13} color="#C7522A" />}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function Stock2Page() {
  const { rol } = useAuth();
  const router = useRouter();
  const soloLectura = false;
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("Todas");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [archiving, setArchiving] = useState(null);
  const [verArchivados, setVerArchivados] = useState(false);

  async function loadInsumos() {
    setLoading(true);
    const { data, error } = await supabase.from("insumos").select("*").eq("deposito", "Pañol").order("nombre");
    if (error) setError(error.message);
    else setInsumos(data);
    setLoading(false);
  }

  useEffect(() => {
    loadInsumos();
  }, []);

  useEffect(() => {
    if (rol && rol !== "admin") router.replace("/ingreso-egreso");
  }, [rol, router]);

  const categorias = useMemo(() => ["Todas", ...new Set(insumos.map((i) => i.categoria).filter(Boolean))], [insumos]);

  const filtered = useMemo(
    () =>
      insumos
        .filter((i) => (verArchivados ? i.activo === false : i.activo !== false))
        .filter((i) => i.nombre.toLowerCase().includes(query.toLowerCase()) || (i.categoria || "").toLowerCase().includes(query.toLowerCase()))
        .filter((i) => catFilter === "Todas" || i.categoria === catFilter),
    [insumos, query, catFilter, verArchivados]
  );
  const lowCount = insumos.filter((i) => i.activo !== false && i.stock < i.minimo).length;

  function exportarExcel() {
    const filas = filtered.map((i) => ({
      Insumo: i.nombre,
      Categoría: i.categoria,
      Unidad: i.unidad,
      Stock: i.stock,
      "Stock mínimo": i.minimo,
      Estado: i.activo === false ? "Archivado" : "Activo",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Stock Pañol");
    XLSX.writeFile(libro, `stock-panol-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function openNuevo() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditar(i) {
    setEditingId(i.id);
    setForm({ nombre: i.nombre, categoria: i.categoria || "", unidad: i.unidad, stock: String(i.stock), minimo: String(i.minimo) });
    setShowForm(true);
  }

  async function submitForm(e) {
    e.preventDefault();
    const payload = {
      nombre: form.nombre,
      categoria: form.categoria,
      unidad: form.unidad,
      stock: Number(form.stock) || 0,
      minimo: Number(form.minimo) || 0,
      deposito: "Pañol",
    };
    const { error } = editingId
      ? await supabase.from("insumos").update(payload).eq("id", editingId)
      : await supabase.from("insumos").insert(payload);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    loadInsumos();
  }

  async function confirmarArchivar() {
    const { error } = await supabase.from("insumos").update({ activo: false }).eq("id", archiving.id);
    if (error) {
      setError(error.message);
      setArchiving(null);
      return;
    }
    setArchiving(null);
    loadInsumos();
  }

  async function reactivar(i) {
    const { error } = await supabase.from("insumos").update({ activo: true }).eq("id", i.id);
    if (error) {
      setError(error.message);
      return;
    }
    loadInsumos();
  }

  if (rol && rol !== "admin" && rol !== "taller_stock") return null;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold">Insumos — Pañol</h1>
          {!loading && (lowCount > 0 ? (
            <p className="text-sm text-red flex items-center gap-1 mt-0.5"><AlertTriangle size={14} /> {lowCount} insumo{lowCount > 1 ? "s" : ""} por debajo del mínimo</p>
          ) : (
            <p className="text-sm text-[#6B6558] mt-0.5">Todo el stock está en niveles saludables</p>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
            <Download size={16} /> Exportar a Excel
          </button>
          {!soloLectura && (
            <button onClick={openNuevo} className="flex items-center gap-1.5 bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] transition-colors">
              <Plus size={16} /> Nuevo insumo
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-line rounded-sm px-3 py-2 max-w-xs">
          <Search size={15} color="#6B6558" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar insumo o categoría" className="flex-1 text-sm outline-none" />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="bg-white border border-line rounded-sm px-3 py-2 text-sm text-ink">
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setVerArchivados((v) => !v)}
          className="text-sm px-3 py-2 rounded-sm border border-line"
          style={{ backgroundColor: verArchivados ? "#1C1F1C" : "white", color: verArchivados ? "white" : "#1C1F1C" }}
        >
          {verArchivados ? "Viendo archivados" : "Ver archivados"}
        </button>
      </div>

      <div className="bg-white border border-line rounded-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
              <th className="px-4 py-3 font-medium">Insumo</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Stock / Mínimo</th>
              <th className="px-4 py-3 font-medium">Nivel</th>
              {!soloLectura && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={soloLectura ? 4 : 5} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
            {!loading && filtered.map((i, idx) => (
              <tr key={i.id} className={idx !== filtered.length - 1 ? "border-b border-[#EFEBE0]" : ""}>
                <td className="px-4 py-3">
                  <div className="font-medium">{i.nombre}</div>
                </td>
                <td className="px-4 py-3 text-[#4A463D]">{i.categoria}</td>
                <td className="px-4 py-3 font-mono">
                  {i.stock} <span className="text-[#B0AA9A]">/ {i.minimo}</span> <span className="text-[#8A8578] text-xs">{i.unidad}</span>
                </td>
                <td className="px-4 py-3"><StockGauge stock={i.stock} minimo={i.minimo} /></td>
                {!soloLectura && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEditar(i)} className="text-[#4A4B4D] hover:opacity-70" title="Editar">
                        <Pencil size={15} />
                      </button>
                      {verArchivados ? (
                        <button onClick={() => reactivar(i)} className="text-green text-xs font-medium hover:underline">Reactivar</button>
                      ) : (
                        <button onClick={() => setArchiving(i)} className="text-red hover:opacity-70" title="Archivar">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={soloLectura ? 4 : 5} className="px-4 py-8 text-center text-sm text-[#8A8578]">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-sm border border-line shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-xl font-semibold">{editingId ? "Editar insumo" : "Nuevo insumo"}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitForm} className="p-5">
              <Field label="Nombre">
                <input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Categoría">
                  <select className={inputCls} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                    <option value="">— Seleccionar —</option>
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Unidad">
                  <select className={inputCls} value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="Stock">
                  <input type="number" className={inputCls} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </Field>
                <Field label="Stock mínimo">
                  <input type="number" className={inputCls} value={form.minimo} onChange={(e) => setForm({ ...form, minimo: e.target.value })} />
                </Field>
              </div>
              <button type="submit" className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731]">
                {editingId ? "Guardar cambios" : "Guardar insumo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {archiving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5">
            <h3 className="font-display text-xl font-semibold mb-2">¿Archivar insumo?</h3>
            <p className="text-sm text-[#6B6558] mb-5">
              <span className="font-medium text-ink">{archiving.nombre}</span> dejará de aparecer en tu inventario activo, pero su historial de movimientos se conserva. Puedes reactivarlo cuando quieras desde "Ver archivados".
            </p>
            <div className="flex gap-2">
              <button onClick={() => setArchiving(null)} className="flex-1 py-2 rounded-sm text-sm font-medium border border-line hover:bg-[#F2EEE3]">Cancelar</button>
              <button onClick={confirmarArchivar} className="flex-1 py-2 rounded-sm text-sm font-medium bg-red text-white hover:opacity-90">Archivar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

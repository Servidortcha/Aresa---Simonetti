"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Wrench, Download } from "lucide-react";

const TIPOS = ["Corte Láser", "Tornería"];
const emptyForm = { tipo: TIPOS[0], cliente: "", descripcion: "", cantidad: "", duracion_minutos: "", material: "", largo_mm: "", ancho_mm: "" };

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

function calcularM2(largo, ancho, cantidad) {
  const l = Number(largo);
  const a = Number(ancho);
  const c = Number(cantidad) || 1;
  if (!l || !a) return null;
  return (l * a * c) / 1_000_000; // mm² -> m², multiplicado por cantidad de piezas
}

export default function TrabajosPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const puedeAcceder = rol === "admin" || rol === "taller_stock";

  const [trabajos, setTrabajos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filtroTipo, setFiltroTipo] = useState("Todos");

  const esLaser = form.tipo === "Corte Láser";
  const m2Preview = useMemo(() => calcularM2(form.largo_mm, form.ancho_mm, form.cantidad), [form.largo_mm, form.ancho_mm, form.cantidad]);
  const trabajosFiltrados = useMemo(
    () => (filtroTipo === "Todos" ? trabajos : trabajos.filter((t) => t.tipo === filtroTipo)),
    [trabajos, filtroTipo]
  );

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase.from("trabajos").select("*").order("fecha", { ascending: false });
    if (error) setError(error.message);
    else setTrabajos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && !puedeAcceder) router.replace("/ingreso-egreso");
  }, [rol, puedeAcceder, router]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const metros_cuadrados = form.tipo === "Corte Láser" ? calcularM2(form.largo_mm, form.ancho_mm, form.cantidad) : null;
    const { error } = await supabase.from("trabajos").insert({
      tipo: form.tipo,
      cliente: form.cliente || null,
      descripcion: form.descripcion || null,
      cantidad: form.cantidad ? Number(form.cantidad) : null,
      duracion_minutos: form.duracion_minutos ? Number(form.duracion_minutos) : null,
      material: form.material || null,
      largo_mm: form.tipo === "Corte Láser" && form.largo_mm ? Number(form.largo_mm) : null,
      ancho_mm: form.tipo === "Corte Láser" && form.ancho_mm ? Number(form.ancho_mm) : null,
      metros_cuadrados,
      usuario_email: session?.user?.email || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setConfirmacion("Trabajo registrado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  function exportarExcel() {
    const filas = trabajosFiltrados.map((t) => ({
      Fecha: new Date(t.fecha).toLocaleString("es-MX"),
      Tipo: t.tipo,
      Cliente: t.cliente || "",
      Descripción: t.descripcion || "",
      Cantidad: t.cantidad ?? "",
      "Duración (min)": t.duracion_minutos ?? "",
      "Largo (mm)": t.largo_mm ?? "",
      "Ancho (mm)": t.ancho_mm ?? "",
      "m²": t.metros_cuadrados ?? "",
      Material: t.material || "",
      Usuario: t.usuario_email || "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Trabajos");
    XLSX.writeFile(libro, `trabajos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rol && !puedeAcceder) return null;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench size={20} color="#F4791E" />
          <h1 className="font-display text-3xl font-semibold">Trabajos — Corte Láser / Tornería</h1>
        </div>
        <button onClick={exportarExcel} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
          <Download size={16} /> Exportar a Excel
        </button>
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}
      {confirmacion && <p className="text-sm text-green mb-4">{confirmacion}</p>}

      <div className="flex flex-col gap-6">
        <form onSubmit={submit} className="bg-white border border-line rounded-sm p-4 sm:p-6 w-full max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Tipo de trabajo">
              <div className="flex gap-2">
                {TIPOS.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setForm({ ...form, tipo: t })}
                    className="flex-1 py-2 rounded-sm text-sm font-medium border transition-colors"
                    style={{
                      backgroundColor: form.tipo === t ? "#4A4B4D" : "white",
                      color: form.tipo === t ? "white" : "#1C1F1C",
                      borderColor: form.tipo === t ? "transparent" : "#D8D2C4",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Cliente">
              <input className={inputCls} value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Ej. Simonetti Montajes" />
            </Field>
          </div>

          <Field label="Descripción">
            <input className={inputCls} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej. Corte de placas 3mm" />
          </Field>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Cantidad">
              <input type="number" className={inputCls} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </Field>
            <Field label="Duración (min)">
              <input type="number" className={inputCls} value={form.duracion_minutos} onChange={(e) => setForm({ ...form, duracion_minutos: e.target.value })} />
            </Field>
            {esLaser && (
              <>
                <Field label="Largo (mm)">
                  <input type="number" className={inputCls} value={form.largo_mm} onChange={(e) => setForm({ ...form, largo_mm: e.target.value })} />
                </Field>
                <Field label="Ancho (mm)">
                  <input type="number" className={inputCls} value={form.ancho_mm} onChange={(e) => setForm({ ...form, ancho_mm: e.target.value })} />
                </Field>
              </>
            )}
          </div>

          {esLaser && m2Preview != null && (
            <div className="flex items-center gap-2 bg-[#F2EEE3] border border-line rounded-sm px-3 py-2 mb-3 -mt-1">
              <span className="text-xs text-[#6B6558]">Área total:</span>
              <span className="text-sm font-semibold text-ink font-mono">{m2Preview.toFixed(3)} m²</span>
              {Number(form.cantidad) > 1 && <span className="text-xs text-[#8A8578]">({form.cantidad} piezas)</span>}
            </div>
          )}

          <Field label="Material usado">
            <input className={inputCls} value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Ej. Chapa de acero 3mm" />
          </Field>

          <button type="submit" className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731]">
            Registrar trabajo
          </button>
        </form>

        <div className="w-full">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="font-display text-xl font-semibold text-ink">Historial de trabajos</h2>
            <div className="flex gap-1">
              {["Todos", ...TIPOS].map((t) => (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className="px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors"
                  style={{
                    backgroundColor: filtroTipo === t ? "#4A4B4D" : "white",
                    color: filtroTipo === t ? "white" : "#4A463D",
                    borderColor: filtroTipo === t ? "transparent" : "#D8D2C4",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-line rounded-sm overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Cant.</th>
                  <th className="px-4 py-3 font-medium">Duración</th>
                  <th className="px-4 py-3 font-medium">m²</th>
                  <th className="px-4 py-3 font-medium">Material</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
                {!loading && trabajosFiltrados.map((t, idx) => (
                  <tr key={t.id} className={idx !== trabajosFiltrados.length - 1 ? "border-b border-[#EFEBE0]" : ""}>
                    <td className="px-4 py-3 text-[#6B6558] font-mono whitespace-nowrap">{new Date(t.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm whitespace-nowrap"
                        style={{
                          backgroundColor: t.tipo === "Corte Láser" ? "#EAF0F5" : "#FBEFE6",
                          color: t.tipo === "Corte Láser" ? "#2E6F9E" : "#B25A1E",
                        }}
                      >
                        {t.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{t.cliente || "—"}</td>
                    <td className="px-4 py-3 text-[#4A463D]">{t.descripcion || "—"}</td>
                    <td className="px-4 py-3 font-mono">{t.cantidad ?? "—"}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{t.duracion_minutos != null ? `${t.duracion_minutos} min` : "—"}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{t.metros_cuadrados != null ? `${Number(t.metros_cuadrados).toFixed(3)} m²` : "—"}</td>
                    <td className="px-4 py-3 text-[#8A8578]">{t.material || "—"}</td>
                  </tr>
                ))}
                {!loading && trabajosFiltrados.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#8A8578]">Sin trabajos {filtroTipo !== "Todos" ? `de ${filtroTipo}` : "registrados"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

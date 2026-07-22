"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Hammer, Download } from "lucide-react";

const emptyForm = { cliente: "", cantidad: "", duracion_horas: "", cantidad_personas: "", descripcion_materiales: "" };

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";
const textareaCls = inputCls + " resize-y min-h-[110px]";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function TallerPage() {
  const { rol, session } = useAuth();
  const router = useRouter();

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [verDetalle, setVerDetalle] = useState(null);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase.from("taller_trabajos").select("*").order("fecha", { ascending: false });
    if (error) setError(error.message);
    else setRegistros(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && rol !== "admin") router.replace("/ingreso-egreso");
  }, [rol, router]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("taller_trabajos").insert({
      cliente: form.cliente || null,
      cantidad: form.cantidad ? Number(form.cantidad) : null,
      duracion_horas: form.duracion_horas ? Number(form.duracion_horas) : null,
      cantidad_personas: form.cantidad_personas ? Number(form.cantidad_personas) : null,
      descripcion_materiales: form.descripcion_materiales || null,
      usuario_email: session?.user?.email || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setConfirmacion("Registro guardado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  function exportarExcel() {
    const filas = registros.map((r) => ({
      Fecha: new Date(r.fecha).toLocaleString("es-MX"),
      Cliente: r.cliente || "",
      Cantidad: r.cantidad ?? "",
      "Duración (horas)": r.duracion_horas ?? "",
      Personas: r.cantidad_personas ?? "",
      "Materiales usados": r.descripcion_materiales || "",
      Usuario: r.usuario_email || "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Taller");
    XLSX.writeFile(libro, `taller-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rol && rol !== "admin") return null;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Hammer size={20} color="#F4791E" />
          <h1 className="font-display text-3xl font-semibold">Taller</h1>
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
            <Field label="Cliente">
              <input className={inputCls} value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Ej. Simonetti Montajes" />
            </Field>
            <Field label="Cantidad de personas">
              <input type="number" className={inputCls} value={form.cantidad_personas} onChange={(e) => setForm({ ...form, cantidad_personas: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad">
              <input type="number" className={inputCls} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </Field>
            <Field label="Duración (horas)">
              <input type="number" className={inputCls} value={form.duracion_horas} onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })} />
            </Field>
          </div>

          <Field label="Descripción de materiales usados">
            <textarea
              className={textareaCls}
              value={form.descripcion_materiales}
              onChange={(e) => setForm({ ...form, descripcion_materiales: e.target.value })}
              placeholder="Detalle completo de los materiales utilizados en el trabajo..."
            />
          </Field>

          <button type="submit" className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731]">
            Registrar
          </button>
        </form>

        <div className="w-full">
          <h2 className="font-display text-xl font-semibold text-ink mb-3">Historial de Taller</h2>
          <div className="bg-white border border-line rounded-sm overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Cant.</th>
                  <th className="px-4 py-3 font-medium">Duración</th>
                  <th className="px-4 py-3 font-medium">Personas</th>
                  <th className="px-4 py-3 font-medium">Materiales</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
                {!loading && registros.map((r, idx) => (
                  <tr key={r.id} className={idx !== registros.length - 1 ? "border-b border-[#EFEBE0]" : ""}>
                    <td className="px-4 py-3 text-[#6B6558] font-mono whitespace-nowrap">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{r.cliente || "—"}</td>
                    <td className="px-4 py-3 font-mono">{r.cantidad ?? "—"}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{r.duracion_horas != null ? `${r.duracion_horas} h` : "—"}</td>
                    <td className="px-4 py-3 font-mono">{r.cantidad_personas ?? "—"}</td>
                    <td className="px-4 py-3 text-[#4A463D] max-w-xs">
                      {r.descripcion_materiales ? (
                        <button onClick={() => setVerDetalle(r)} className="text-left text-[#3B5166] hover:underline line-clamp-1">
                          {r.descripcion_materiales.length > 40 ? r.descripcion_materiales.slice(0, 40) + "…" : r.descripcion_materiales}
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {!loading && registros.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8578]">Aún no hay registros de Taller</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {verDetalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setVerDetalle(null)}>
          <div className="bg-card w-full max-w-lg rounded-sm border border-line shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold mb-1">{verDetalle.cliente || "Sin cliente"}</h3>
            <p className="text-xs text-[#8A8578] mb-4">{new Date(verDetalle.fecha).toLocaleString("es-MX")}</p>
            <p className="text-sm text-[#4A463D] whitespace-pre-wrap">{verDetalle.descripcion_materiales}</p>
          </div>
        </div>
      )}
    </>
  );
}

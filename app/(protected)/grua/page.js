"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Truck, Download } from "lucide-react";

const emptyForm = { cliente: "", ubicacion: "", descripcion: "", tipo_grua: "", operador: "", horas_uso: "" };

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function GruaPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const puedeAcceder = rol === "admin" || rol === "grua";

  const [trabajos, setTrabajos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase.from("trabajos_grua").select("*").order("fecha", { ascending: false });
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
    if (enviando) return;
    setError(null);
    setEnviando(true);
    const { error } = await supabase.from("trabajos_grua").insert({
      cliente: form.cliente || null,
      ubicacion: form.ubicacion || null,
      descripcion: form.descripcion || null,
      tipo_grua: form.tipo_grua || null,
      operador: form.operador || null,
      horas_uso: form.horas_uso ? Number(form.horas_uso) : null,
      usuario_email: session?.user?.email || null,
    });
    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setConfirmacion("Trabajo registrado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = trabajos.map((t) => ({
      Fecha: new Date(t.fecha).toLocaleString("es-AR"),
      Cliente: t.cliente || "",
      Ubicación: t.ubicacion || "",
      Descripción: t.descripcion || "",
      "Tipo/Capacidad": t.tipo_grua || "",
      Operador: t.operador || "",
      "Horas de uso": t.horas_uso ?? "",
      Usuario: t.usuario_email || "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Grúa");
    XLSX.writeFile(libro, `grua-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rol && !puedeAcceder) return null;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Truck size={20} color="#F4791E" />
          <h1 className="font-display text-3xl font-semibold">Trabajos con Grúa</h1>
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
            <Field label="Ubicación / dirección">
              <input className={inputCls} value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} placeholder="Ej. Ruta 9 km 123" />
            </Field>
          </div>

          <Field label="Descripción del trabajo">
            <input className={inputCls} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej. Izaje de estructura metálica" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tipo / capacidad de grúa">
              <input className={inputCls} value={form.tipo_grua} onChange={(e) => setForm({ ...form, tipo_grua: e.target.value })} placeholder="Ej. Grúa 25 ton" />
            </Field>
            <Field label="Operador">
              <input className={inputCls} value={form.operador} onChange={(e) => setForm({ ...form, operador: e.target.value })} placeholder="Ej. Carlos Gómez" />
            </Field>
            <Field label="Horas de uso">
              <input type="number" step="0.5" className={inputCls} value={form.horas_uso} onChange={(e) => setForm({ ...form, horas_uso: e.target.value })} />
            </Field>
          </div>

          <button type="submit" disabled={enviando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            {enviando ? "Guardando..." : "Registrar trabajo"}
          </button>
        </form>

        <div className="w-full">
          <h2 className="font-display text-xl font-semibold text-ink mb-3">Historial de trabajos con grúa</h2>
          <div className="bg-white border border-line rounded-sm overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Tipo/Capacidad</th>
                  <th className="px-4 py-3 font-medium">Operador</th>
                  <th className="px-4 py-3 font-medium">Horas</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
                {!loading && trabajos.map((t, idx) => (
                  <tr key={t.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== trabajos.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                    <td className="px-4 py-3 text-[#6B6558] font-mono whitespace-nowrap">{new Date(t.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{t.cliente || "—"}</td>
                    <td className="px-4 py-3 text-[#4A463D]">{t.ubicacion || "—"}</td>
                    <td className="px-4 py-3 text-[#4A463D]">{t.descripcion || "—"}</td>
                    <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{t.tipo_grua || "—"}</td>
                    <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{t.operador || "—"}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{t.horas_uso != null ? `${t.horas_uso} h` : "—"}</td>
                  </tr>
                ))}
                {!loading && trabajos.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Aún no hay trabajos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

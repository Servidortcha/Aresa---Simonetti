"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Wrench, Download, Printer, Paperclip, Pencil, FileText, X } from "lucide-react";

const TIPOS = ["Corte Láser", "Tornería"];
const emptyForm = {
  tipo: TIPOS[0],
  cliente: "",
  descripcion: "",
  cantidad: "",
  duracion_minutos: "",
  duracion_horas: "",
  material: "",
  largo_mm: "",
  ancho_mm: "",
  confirmado: true,
  fabricacion_id: "",
};

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
  return (l * a * c) / 1_000_000;
}

function nro(n) {
  return n != null ? "T-" + String(n).padStart(4, "0") : null;
}

export default function TrabajosPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const puedeAcceder = rol === "admin" || rol === "taller_stock";

  const [trabajos, setTrabajos] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [archivosActuales, setArchivosActuales] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [tarjeta, setTarjeta] = useState(null);

  const esLaser = form.tipo === "Corte Láser";
  const m2Preview = useMemo(() => calcularM2(form.largo_mm, form.ancho_mm, form.cantidad), [form.largo_mm, form.ancho_mm, form.cantidad]);

  const obraPorId = useMemo(() => {
    const map = {};
    obras.forEach((o) => (map[o.id] = o));
    return map;
  }, [obras]);

  const trabajosFiltrados = useMemo(
    () =>
      trabajos
        .filter((t) => filtroTipo === "Todos" || t.tipo === filtroTipo)
        .filter((t) => filtroEstado === "Todos" || (filtroEstado === "Pendientes" ? !t.confirmado : t.confirmado)),
    [trabajos, filtroTipo, filtroEstado]
  );

  async function cargar() {
    setLoading(true);
    const [{ data, error }, { data: obrasData, error: errObras }] = await Promise.all([
      supabase.from("trabajos").select("*").order("fecha", { ascending: false }),
      supabase.from("fabricaciones").select("id, nombre, cliente, estado").order("fecha_apertura", { ascending: false }),
    ]);
    if (error) setError(error.message);
    else setTrabajos(data || []);
    if (errObras) setError(errObras.message);
    else setObras(obrasData || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && !puedeAcceder) router.replace("/ingreso-egreso");
  }, [rol, puedeAcceder, router]);

  function abrirNuevo() {
    setEditingId(null);
    setForm(emptyForm);
    setArchivosSeleccionados([]);
    setArchivosActuales([]);
    setError(null);
  }

  function abrirEditar(t) {
    setEditingId(t.id);
    setForm({
      tipo: t.tipo,
      cliente: t.cliente || "",
      descripcion: t.descripcion || "",
      cantidad: t.cantidad != null ? String(t.cantidad) : "",
      duracion_minutos: t.duracion_minutos != null ? String(t.duracion_minutos) : "",
      duracion_horas: t.duracion_horas != null ? String(t.duracion_horas) : "",
      material: t.material || "",
      largo_mm: t.largo_mm != null ? String(t.largo_mm) : "",
      ancho_mm: t.ancho_mm != null ? String(t.ancho_mm) : "",
      confirmado: t.confirmado,
      fabricacion_id: t.fabricacion_id != null ? String(t.fabricacion_id) : "",
    });
    setArchivosSeleccionados([]);
    setArchivosActuales(Array.isArray(t.archivo_dxf) ? t.archivo_dxf : t.archivo_dxf ? [t.archivo_dxf] : []);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    setEnviando(true);

    // 1. Subir los archivos DXF nuevos seleccionados.
    let archivo_dxf = editingId ? undefined : []; // undefined = no tocar el campo al editar si no se sube uno nuevo
    if (archivosSeleccionados.length > 0) {
      const lista = editingId ? [...archivosActuales] : [];
      for (const file of archivosSeleccionados) {
        const nombreSeguro = file.name
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${Date.now()}-${nombreSeguro}`;
        const { error: uploadError } = await supabase.storage.from("trabajos-archivos").upload(path, file);
        if (uploadError) {
          setError("Error al subir el archivo: " + uploadError.message);
          setEnviando(false);
          return;
        }
        const { data: pub } = supabase.storage.from("trabajos-archivos").getPublicUrl(path);
        lista.push({ name: file.name, url: pub.publicUrl });
      }
      archivo_dxf = lista;
    }

    const metros_cuadrados = esLaser ? calcularM2(form.largo_mm, form.ancho_mm, form.cantidad) : null;

    const payload = {
      tipo: form.tipo,
      cliente: form.cliente || null,
      descripcion: form.descripcion || null,
      cantidad: form.cantidad ? Number(form.cantidad) : null,
      duracion_minutos: esLaser && form.duracion_minutos ? Number(form.duracion_minutos) : null,
      duracion_horas: !esLaser && form.duracion_horas ? Number(form.duracion_horas) : null,
      material: form.material || null,
      largo_mm: esLaser && form.largo_mm ? Number(form.largo_mm) : null,
      ancho_mm: esLaser && form.ancho_mm ? Number(form.ancho_mm) : null,
      metros_cuadrados,
      confirmado: form.confirmado,
      fabricacion_id: form.fabricacion_id ? Number(form.fabricacion_id) : null,
    };
    if (archivo_dxf !== undefined) payload.archivo_dxf = archivo_dxf;

    let error;
    if (editingId) {
      ({ error } = await supabase.from("trabajos").update(payload).eq("id", editingId));
    } else {
      payload.usuario_email = session?.user?.email || null;
      ({ error } = await supabase.from("trabajos").insert(payload));
    }

    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setArchivosSeleccionados([]);
    setArchivosActuales([]);
    setConfirmacion(editingId ? "Trabajo actualizado" : "Trabajo registrado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  function imprimirTarjeta(t) {
    setTarjeta(t);
    const tituloOriginal = document.title;
    const nombreCliente = (t.cliente || "sin-cliente").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-");
    const fecha = new Date(t.fecha).toISOString().slice(0, 10);
    document.title = `Trabajo-${nombreCliente}-${fecha}`;
    function restaurarTitulo() {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurarTitulo);
    }
    window.addEventListener("afterprint", restaurarTitulo);
    setTimeout(() => window.print(), 100);
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = trabajosFiltrados.map((t) => ({
      "N°": nro(t.numero) || "",
      Fecha: new Date(t.fecha).toLocaleString("es-MX"),
      Tipo: t.tipo,
      Estado: t.confirmado ? "Confirmado" : "Pendiente",
      Cliente: t.cliente || "",
      Obra: t.fabricacion_id ? (obraPorId[t.fabricacion_id]?.nombre || "") : "",
      Descripción: t.descripcion || "",
      Cantidad: t.cantidad ?? "",
      "Duración (min)": t.duracion_minutos ?? "",
      "Duración (horas)": t.duracion_horas ?? "",
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
          {editingId && (
            <div className="flex items-center justify-between bg-[#F2EEE3] border border-line rounded-sm px-3 py-2 mb-4 text-xs text-[#6B6558]">
              Editando trabajo existente
              <button type="button" onClick={abrirNuevo} className="text-[#3B5166] hover:underline flex items-center gap-1">
                <X size={13} /> Cancelar edición
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Tipo de trabajo">
              <div className="flex gap-2">
                {TIPOS.map((t) => (
                  <button
                    type="button"
                    key={t}
                    disabled={!!editingId}
                    onClick={() => setForm({ ...form, tipo: t })}
                    className="flex-1 py-2 rounded-sm text-sm font-medium border transition-colors disabled:opacity-50"
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
            {esLaser ? (
              <Field label="Duración (min)">
                <input type="number" className={inputCls} value={form.duracion_minutos} onChange={(e) => setForm({ ...form, duracion_minutos: e.target.value })} />
              </Field>
            ) : (
              <Field label="Duración (horas)">
                <input type="number" step="0.5" className={inputCls} value={form.duracion_horas} onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })} />
              </Field>
            )}
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

          <Field label="Obra (opcional)">
            <select className={inputCls} value={form.fabricacion_id} onChange={(e) => setForm({ ...form, fabricacion_id: e.target.value })}>
              <option value="">— Sin obra asignada —</option>
              {obras
                .filter((o) => o.estado === "abierta" || String(o.id) === form.fabricacion_id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                    {o.cliente ? ` (${o.cliente})` : ""}
                  </option>
                ))}
            </select>
          </Field>

          {esLaser && (
            <Field label={editingId ? "Agregar archivos DXF (opcional)" : "Archivos DXF para el operador (opcional)"}>
              <label className="flex items-center gap-2 border border-dashed border-line rounded-sm px-3 py-2.5 text-sm text-[#6B6558] cursor-pointer hover:bg-[#F2EEE3] transition-colors">
                <Paperclip size={15} />
                {archivosSeleccionados.length > 0 ? `${archivosSeleccionados.length} archivo(s) nuevo(s)` : "Elegir archivos .dxf (podés elegir varios)"}
                <input
                  type="file"
                  accept=".dxf"
                  multiple
                  className="hidden"
                  onChange={(e) => setArchivosSeleccionados(Array.from(e.target.files || []))}
                />
              </label>
              {editingId && archivosActuales.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {archivosActuales.map((a, idx) => (
                    <li key={`a${idx}`} className="flex items-center justify-between bg-[#F2EEE3] rounded-sm px-2.5 py-1.5 text-xs text-[#4A463D]">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{a.name}</a>
                      <button type="button" onClick={() => setArchivosActuales((prev) => prev.filter((_, i) => i !== idx))} className="text-[#C7522A] hover:text-red ml-2 shrink-0" title="Quitar archivo">✕</button>
                    </li>
                  ))}
                </ul>
              )}
              {archivosSeleccionados.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {archivosSeleccionados.map((f, idx) => (
                    <li key={`s${idx}`} className="flex items-center justify-between bg-[#F7F4EC] rounded-sm px-2.5 py-1.5 text-xs text-[#4A463D]">
                      <span className="truncate pr-2">{f.name}</span>
                      <button type="button" onClick={() => setArchivosSeleccionados((prev) => prev.filter((_, i) => i !== idx))} className="text-[#C7522A] hover:text-red shrink-0" title="Quitar">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          )}

          <label className="flex items-center gap-2 text-sm text-ink mb-4 mt-1 cursor-pointer">
            <input type="checkbox" checked={form.confirmado} onChange={(e) => setForm({ ...form, confirmado: e.target.checked })} />
            Confirmado (el corte ya se hizo y los datos están completos)
          </label>
          {!form.confirmado && (
            <p className="text-xs text-[#B25A1E] -mt-3 mb-4">
              Va a quedar como <b>pendiente</b> hasta que se destilde esta casilla — útil si todavía falta que el operador corte y complete m²/duración.
            </p>
          )}

          <button type="submit" disabled={enviando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            {enviando ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar trabajo"}
          </button>
        </form>

        <div className="w-full">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="font-display text-xl font-semibold text-ink">Historial de trabajos</h2>
            <div className="flex gap-3 flex-wrap">
              <div className="flex gap-1">
                {["Todos", "Pendientes", "Confirmados"].map((e) => (
                  <button
                    key={e}
                    onClick={() => setFiltroEstado(e)}
                    className="px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors"
                    style={{
                      backgroundColor: filtroEstado === e ? "#4A4B4D" : "white",
                      color: filtroEstado === e ? "white" : "#4A463D",
                      borderColor: filtroEstado === e ? "transparent" : "#D8D2C4",
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
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
          </div>

          {/* Móvil: tarjetas */}
          <div className="sm:hidden space-y-3">
            {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
            {!loading &&
              trabajosFiltrados.map((t) => (
                <div key={t.id} className="bg-white border border-line rounded-sm p-4">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {t.numero != null && (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-ink text-paper">{nro(t.numero)}</span>
                    )}
                    <span
                      className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm"
                      style={{ backgroundColor: t.tipo === "Corte Láser" ? "#EAF0F5" : "#FBEFE6", color: t.tipo === "Corte Láser" ? "#2E6F9E" : "#B25A1E" }}
                    >
                      {t.tipo}
                    </span>
                    <span
                      className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm"
                      style={{ backgroundColor: t.confirmado ? "#EAF0E4" : "#FBEFE6", color: t.confirmado ? "#3D5A2E" : "#B25A1E" }}
                    >
                      {t.confirmado ? "Confirmado" : "Pendiente"}
                    </span>
                  </div>
                  <div className="font-medium leading-snug">{t.cliente || "Sin cliente"}</div>
                  {t.descripcion && <p className="text-sm text-[#4A463D] mt-0.5">{t.descripcion}</p>}
                  {t.fabricacion_id && (
                    <p className="text-xs text-[#3B5166] mt-1">
                      Obra: <span className="font-medium">{obraPorId[t.fabricacion_id]?.nombre || "—"}</span>
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm mt-2.5 pt-2.5 border-t border-[#EFEBE0]">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Cantidad</span>
                      <span className="font-mono">{t.cantidad ?? "—"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Duración</span>
                      <span className="font-mono">
                        {t.tipo === "Corte Láser"
                          ? (t.duracion_minutos != null ? `${t.duracion_minutos} min` : "—")
                          : (t.duracion_horas != null ? `${t.duracion_horas} h` : "—")}
                      </span>
                    </div>
                    {t.metros_cuadrados != null && (
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">m²</span>
                        <span className="font-mono">{Number(t.metros_cuadrados).toFixed(3)} m²</span>
                      </div>
                    )}
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Fecha</span>
                      <span className="font-mono text-[#6B6558]">{new Date(t.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditar(t)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                        <Pencil size={15} /> Editar
                      </button>
                      <button onClick={() => imprimirTarjeta(t)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                        <Printer size={15} /> Tarjeta
                      </button>
                    </div>
                    {(Array.isArray(t.archivo_dxf) ? t.archivo_dxf : t.archivo_dxf ? [t.archivo_dxf] : []).map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#3B5166] hover:underline shrink-0">
                        <FileText size={14} /> DXF {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            {!loading && trabajosFiltrados.length === 0 && <p className="text-center text-sm text-[#8A8578] py-8">Sin trabajos para este filtro</p>}
          </div>

          <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[1080px]">
              <thead>
                <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Obra</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Cant.</th>
                  <th className="px-4 py-3 font-medium">Duración</th>
                  <th className="px-4 py-3 font-medium">m²</th>
                  <th className="px-4 py-3 font-medium">Archivo</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
                {!loading && trabajosFiltrados.map((t, idx) => (
                  <tr key={t.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== trabajosFiltrados.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{t.numero != null ? nro(t.numero) : "—"}</td>
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
                    <td className="px-4 py-3">
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm whitespace-nowrap"
                        style={{ backgroundColor: t.confirmado ? "#EAF0E4" : "#FBEFE6", color: t.confirmado ? "#3D5A2E" : "#B25A1E" }}
                      >
                        {t.confirmado ? "Confirmado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{t.cliente || "—"}</td>
                    <td className="px-4 py-3 text-[#3B5166] whitespace-nowrap">
                      {t.fabricacion_id ? (obraPorId[t.fabricacion_id]?.nombre || "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#4A463D]">{t.descripcion || "—"}</td>
                    <td className="px-4 py-3 font-mono">{t.cantidad ?? "—"}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      {t.tipo === "Corte Láser"
                        ? (t.duracion_minutos != null ? `${t.duracion_minutos} min` : "—")
                        : (t.duracion_horas != null ? `${t.duracion_horas} h` : "—")}
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{t.metros_cuadrados != null ? `${Number(t.metros_cuadrados).toFixed(3)} m²` : "—"}</td>
                    <td className="px-4 py-3">
                      {(Array.isArray(t.archivo_dxf) ? t.archivo_dxf : t.archivo_dxf ? [t.archivo_dxf] : []).length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {(Array.isArray(t.archivo_dxf) ? t.archivo_dxf : [t.archivo_dxf]).map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#3B5166] hover:underline">
                              <FileText size={13} /> DXF {i + 1}
                            </a>
                          ))}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => abrirEditar(t)} className="text-[#4A4B4D] hover:opacity-70" title="Editar / Completar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => imprimirTarjeta(t)} className="text-[#4A4B4D] hover:opacity-70" title="Descargar tarjeta PDF">
                          <Printer size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && trabajosFiltrados.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-[#8A8578]">Sin trabajos para este filtro</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {tarjeta && (
        <div className="print-card hidden">
          <div className="pc-header">
            <div className="pc-empresa">Simonetti Montajes Industriales</div>
            <div className="pc-tipo">{tarjeta.tipo}</div>
          </div>
          <table className="pc-tabla">
            <tbody>
              <tr><td className="pc-label">N°</td><td>{tarjeta.numero != null ? nro(tarjeta.numero) : "—"}</td></tr>
              <tr><td className="pc-label">Fecha</td><td>{new Date(tarjeta.fecha).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</td></tr>
              <tr><td className="pc-label">Estado</td><td>{tarjeta.confirmado ? "Confirmado" : "Pendiente"}</td></tr>
              <tr><td className="pc-label">Cliente</td><td>{tarjeta.cliente || "—"}</td></tr>
              <tr><td className="pc-label">Obra</td><td>{tarjeta.fabricacion_id ? (obraPorId[tarjeta.fabricacion_id]?.nombre || "—") : "—"}</td></tr>
              <tr><td className="pc-label">Descripción</td><td>{tarjeta.descripcion || "—"}</td></tr>
              <tr><td className="pc-label">Cantidad</td><td>{tarjeta.cantidad ?? "—"}</td></tr>
              <tr>
                <td className="pc-label">Duración</td>
                <td>
                  {tarjeta.tipo === "Corte Láser"
                    ? (tarjeta.duracion_minutos != null ? `${tarjeta.duracion_minutos} min` : "—")
                    : (tarjeta.duracion_horas != null ? `${tarjeta.duracion_horas} h` : "—")}
                </td>
              </tr>
              {tarjeta.tipo === "Corte Láser" && (
                <>
                  <tr><td className="pc-label">Largo</td><td>{tarjeta.largo_mm != null ? `${tarjeta.largo_mm} mm` : "—"}</td></tr>
                  <tr><td className="pc-label">Ancho</td><td>{tarjeta.ancho_mm != null ? `${tarjeta.ancho_mm} mm` : "—"}</td></tr>
                  <tr><td className="pc-label">Área total</td><td>{tarjeta.metros_cuadrados != null ? `${Number(tarjeta.metros_cuadrados).toFixed(3)} m²` : "—"}</td></tr>
                </>
              )}
              <tr><td className="pc-label">Material</td><td>{tarjeta.material || "—"}</td></tr>
              <tr><td className="pc-label">Registrado por</td><td>{tarjeta.usuario_email || "—"}</td></tr>
            </tbody>
          </table>
          <div className="pc-footer">Powered by Aresa</div>
        </div>
      )}
    </>
  );
}

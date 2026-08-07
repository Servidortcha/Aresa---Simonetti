"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Hammer, Download, Paperclip, X, FileText, ClipboardList, Plus, Trash2 } from "lucide-react";

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
  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [verDetalle, setVerDetalle] = useState(null);
  const [trabajos, setTrabajos] = useState([]);
  const [itemsPorTrabajo, setItemsPorTrabajo] = useState({});
  const [nuevoTrabajoRef, setNuevoTrabajoRef] = useState("");
  const [nuevoExterno, setNuevoExterno] = useState({ descripcion: "", cantidad: "", duracion: "" });
  const [agregando, setAgregando] = useState(false);

  async function cargar() {
    setLoading(true);
    const [{ data, error }, { data: trab, error: errTrab }, { data: items, error: errItems }] = await Promise.all([
      supabase.from("taller_trabajos").select("*").order("fecha", { ascending: false }),
      supabase.from("trabajos").select("id, tipo, cliente, descripcion, cantidad, duracion_minutos, duracion_horas, material, confirmado").order("fecha", { ascending: false }),
      supabase.from("taller_trabajo_items").select("id, taller_trabajo_id, tipo, trabajo_ref, descripcion, cantidad, duracion_horas"),
    ]);
    if (error) setError(error.message);
    else setRegistros(data || []);
    if (errTrab) setError(errTrab.message);
    else setTrabajos(trab || []);
    const mapa = {};
    if (errItems) setError(errItems.message);
    else {
      (items || []).forEach((fila) => {
        const ref = fila.tipo === "trabajo" ? (trab || []).find((x) => x.id === fila.trabajo_ref) : null;
        (mapa[fila.taller_trabajo_id] = mapa[fila.taller_trabajo_id] || []).push({
          id: fila.id,
          tipo: fila.tipo,
          trabajo_ref: fila.trabajo_ref,
          descripcion: fila.descripcion,
          cantidad: fila.cantidad,
          duracion_horas: fila.duracion_horas,
          refNombre: ref ? `${ref.tipo} — ${ref.descripcion || "sin descripción"}${ref.cliente ? ` (${ref.cliente})` : ""}` : null,
          refTipo: ref?.tipo || null,
          refCliente: ref?.cliente || null,
        });
      });
      setItemsPorTrabajo(mapa);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && rol !== "admin") router.replace("/ingreso-egreso");
  }, [rol, router]);

  function agregarArchivos(e) {
    const nuevos = Array.from(e.target.files || []);
    setArchivosSeleccionados((prev) => [...prev, ...nuevos]);
    e.target.value = "";
  }

  function quitarArchivo(idx) {
    setArchivosSeleccionados((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e) {
    e.preventDefault();
    if (subiendo) return;
    setError(null);
    setSubiendo(true);

    // 1. Subir cada archivo seleccionado a Supabase Storage
    const archivosSubidos = [];
    for (const file of archivosSeleccionados) {
      const nombreSeguro = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
        .replace(/[^a-zA-Z0-9._-]/g, "_"); // reemplaza cualquier otro caracter raro
      const path = `${Date.now()}-${nombreSeguro}`;
      const { error: uploadError } = await supabase.storage.from("taller-archivos").upload(path, file);
      if (uploadError) {
        setError(`Error al subir ${file.name}: ${uploadError.message}`);
        setSubiendo(false);
        return;
      }
      const { data: pub } = supabase.storage.from("taller-archivos").getPublicUrl(path);
      archivosSubidos.push({ name: file.name, url: pub.publicUrl });
    }

    // 2. Registrar el trabajo con los archivos ya subidos
    const { error } = await supabase.from("taller_trabajos").insert({
      cliente: form.cliente || null,
      cantidad: form.cantidad ? Number(form.cantidad) : null,
      duracion_horas: form.duracion_horas ? Number(form.duracion_horas) : null,
      cantidad_personas: form.cantidad_personas ? Number(form.cantidad_personas) : null,
      descripcion_materiales: form.descripcion_materiales || null,
      archivos: archivosSubidos.length > 0 ? archivosSubidos : null,
      usuario_email: session?.user?.email || null,
    });
    setSubiendo(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setArchivosSeleccionados([]);
    setConfirmacion("Registro guardado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  async function anexarTrabajo(e) {
    e.preventDefault();
    if (!nuevoTrabajoRef) {
      setError("Elegí un trabajo para anexar.");
      return;
    }
    const yaExiste = (itemsPorTrabajo[verDetalle.id] || []).some((i) => i.tipo === "trabajo" && i.trabajo_ref === Number(nuevoTrabajoRef));
    if (yaExiste) {
      setError("Ese trabajo ya está anexado.");
      return;
    }
    setAgregando(true);
    const { error: err } = await supabase.from("taller_trabajo_items").insert({
      taller_trabajo_id: verDetalle.id,
      tipo: "trabajo",
      trabajo_ref: Number(nuevoTrabajoRef),
    });
    setAgregando(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNuevoTrabajoRef("");
    setConfirmacion("Trabajo anexado");
    setTimeout(() => setConfirmacion(null), 2500);
    cargar();
  }

  async function anexarExterno(e) {
    e.preventDefault();
    if (!nuevoExterno.descripcion.trim()) {
      setError("Poné la descripción del ítem externo.");
      return;
    }
    setAgregando(true);
    const { error: err } = await supabase.from("taller_trabajo_items").insert({
      taller_trabajo_id: verDetalle.id,
      tipo: "externo",
      descripcion: nuevoExterno.descripcion.trim(),
      cantidad: nuevoExterno.cantidad ? Number(nuevoExterno.cantidad) : null,
      duracion_horas: nuevoExterno.duracion ? Number(nuevoExterno.duracion) : null,
    });
    setAgregando(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNuevoExterno({ descripcion: "", cantidad: "", duracion: "" });
    setConfirmacion("Ítem externo agregado");
    setTimeout(() => setConfirmacion(null), 2500);
    cargar();
  }

  async function quitarItem(itemId) {
    setAgregando(true);
    const { error: err } = await supabase.from("taller_trabajo_items").delete().eq("id", itemId);
    setAgregando(false);
    if (err) {
      setError(err.message);
      return;
    }
    setConfirmacion("Ítem quitado");
    setTimeout(() => setConfirmacion(null), 2500);
    cargar();
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = registros.map((r) => ({
      Fecha: new Date(r.fecha).toLocaleString("es-MX"),
      Cliente: r.cliente || "",
      Cantidad: r.cantidad ?? "",
      "Duración (horas)": r.duracion_horas ?? "",
      Personas: r.cantidad_personas ?? "",
      "Materiales usados": r.descripcion_materiales || "",
      "Trabajos anexados": (itemsPorTrabajo[r.id] || []).map((i) => (i.tipo === "trabajo" ? i.refNombre : `${i.descripcion}${i.cantidad ? ` (x${i.cantidad})` : ""}`)).join("; "),
      Archivos: (r.archivos || []).map((a) => a.name).join(", "),
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
              <input type="number" step="0.5" className={inputCls} value={form.duracion_horas} onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })} />
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

          <Field label="Archivos adjuntos (podés agregar más de uno)">
            <label className="flex items-center gap-2 border border-dashed border-line rounded-sm px-3 py-2.5 text-sm text-[#6B6558] cursor-pointer hover:bg-[#F2EEE3] transition-colors">
              <Paperclip size={15} />
              Elegir archivos
              <input type="file" multiple className="hidden" onChange={agregarArchivos} />
            </label>
            {archivosSeleccionados.length > 0 && (
              <ul className="mt-2 space-y-1">
                {archivosSeleccionados.map((f, idx) => (
                  <li key={idx} className="flex items-center justify-between bg-[#F2EEE3] rounded-sm px-2.5 py-1.5 text-xs text-[#4A463D]">
                    <span className="truncate pr-2">{f.name}</span>
                    <button type="button" onClick={() => quitarArchivo(idx)} className="text-[#8A8578] hover:text-red flex-shrink-0">
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <button type="submit" disabled={subiendo} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            {subiendo ? "Subiendo..." : "Registrar"}
          </button>
        </form>

        <div className="w-full">
          <h2 className="font-display text-xl font-semibold text-ink mb-3">Historial de Taller</h2>
          {/* Móvil: tarjetas */}
          <div className="sm:hidden space-y-3">
            {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
            {!loading &&
              registros.map((r) => (
                <div key={r.id} className="bg-white border border-line rounded-sm p-4">
                  <div className="font-medium leading-snug">{r.cliente || "Sin cliente"}</div>
                  <div className="text-xs text-[#6B6558] font-mono mt-0.5">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm mt-2.5 pt-2.5 border-t border-[#EFEBE0]">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Cantidad</span>
                      <span className="font-mono">{r.cantidad ?? "—"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Duración</span>
                      <span className="font-mono">{r.duracion_horas != null ? `${r.duracion_horas} h` : "—"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Personas</span>
                      <span className="font-mono">{r.cantidad_personas ?? "—"}</span>
                    </div>
                  </div>
                  <button onClick={() => setVerDetalle(r)} className="flex items-center justify-between w-full mt-3 pt-3 border-t border-[#EFEBE0] text-sm">
                    <span className="flex items-center gap-1.5 text-[#3B5166] font-medium">
                      <Paperclip size={14} /> Ver detalle
                    </span>
                    <span className="text-xs text-[#8A8578]">{(r.archivos || []).length} archivo{(r.archivos || []).length !== 1 ? "s" : ""} · {(itemsPorTrabajo[r.id] || []).length} trabajo{(itemsPorTrabajo[r.id] || []).length !== 1 ? "s" : ""}</span>
                  </button>
                </div>
              ))}
            {!loading && registros.length === 0 && <p className="text-center text-sm text-[#8A8578] py-8">Aún no hay registros de Taller</p>}
          </div>

          <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[840px]">
              <thead>
                <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Cant.</th>
                  <th className="px-4 py-3 font-medium">Duración</th>
                  <th className="px-4 py-3 font-medium">Personas</th>
                  <th className="px-4 py-3 font-medium">Materiales</th>
                  <th className="px-4 py-3 font-medium">Trabajos</th>
                  <th className="px-4 py-3 font-medium">Archivos</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
                {!loading && registros.map((r, idx) => (
                  <tr key={r.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== registros.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
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
                    <td className="px-4 py-3">
                      {(itemsPorTrabajo[r.id] || []).length > 0 ? (
                        <button onClick={() => setVerDetalle(r)} className="inline-flex items-center gap-1 text-xs text-[#3B5166] hover:underline">
                          <ClipboardList size={13} /> {(itemsPorTrabajo[r.id] || []).length}
                        </button>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.archivos && r.archivos.length > 0 ? (
                        <button onClick={() => setVerDetalle(r)} className="inline-flex items-center gap-1 text-xs text-[#3B5166] hover:underline">
                          <Paperclip size={13} /> {r.archivos.length}
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {!loading && registros.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#8A8578]">Aún no hay registros de Taller</td></tr>
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
            {verDetalle.descripcion_materiales && (
              <p className="text-sm text-[#4A463D] whitespace-pre-wrap mb-4">{verDetalle.descripcion_materiales}</p>
            )}
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wide text-[#6B6558] mb-2">Trabajos anexados ({itemsPorTrabajo[verDetalle.id]?.length || 0})</p>
              {(!itemsPorTrabajo[verDetalle.id] || itemsPorTrabajo[verDetalle.id].length === 0) && (
                <p className="text-xs text-[#8A8578] mb-2">Sin trabajos anexados.</p>
              )}
              <ul className="space-y-1.5 mb-3">
                {(itemsPorTrabajo[verDetalle.id] || []).map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 bg-[#F7F4EC] rounded-sm px-3 py-2 text-sm">
                    <div className="min-w-0">
                      {it.tipo === "trabajo" ? (
                        <>
                          <div className="flex items-center gap-1.5 font-medium text-[#4A463D]">
                            <ClipboardList size={13} className="shrink-0 text-[#8A8578]" />
                            <span className="truncate">{it.refNombre || "Trabajo"}</span>
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-[#8A8578]">
                            {it.refTipo || ""}{it.refCliente ? ` · ${it.refCliente}` : ""}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium text-[#4A463D]">{it.descripcion}</div>
                          <div className="text-[10px] uppercase tracking-wide text-[#8A8578]">
                            Externo{it.cantidad ? ` · Cant: ${it.cantidad}` : ""}{it.duracion_horas ? ` · ${it.duracion_horas} h` : ""}
                          </div>
                        </>
                      )}
                    </div>
                    <button onClick={() => quitarItem(it.id)} disabled={agregando} className="text-[#C7522A] hover:text-red p-1 shrink-0" title="Quitar">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={anexarTrabajo} className="flex items-end gap-2 mb-3">
                <label className="block flex-1 min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Anexar trabajo (corte / tornería)</span>
                  <select className={inputCls} value={nuevoTrabajoRef} onChange={(e) => setNuevoTrabajoRef(e.target.value)}>
                    <option value="">— Elegir —</option>
                    {trabajos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.tipo} · {t.descripcion || "sin descripción"}{t.cliente ? ` · ${t.cliente}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={agregando} className="inline-flex items-center gap-1 bg-ink text-paper px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60 shrink-0">
                  <Plus size={15} /> {agregando ? "…" : "Anexar"}
                </button>
              </form>

              <form onSubmit={anexarExterno} className="pt-3 border-t border-[#EFEBE0]">
                <div className="flex items-end gap-2">
                  <label className="block flex-1 min-w-0">
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Ítem externo</span>
                    <input className={inputCls} value={nuevoExterno.descripcion} onChange={(e) => setNuevoExterno({ ...nuevoExterno, descripcion: e.target.value })} placeholder="Ej. Soldadura tercerizada" />
                  </label>
                  <label className="block w-20 shrink-0">
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Cant.</span>
                    <input type="number" step="0.01" min="0" className={inputCls} value={nuevoExterno.cantidad} onChange={(e) => setNuevoExterno({ ...nuevoExterno, cantidad: e.target.value })} />
                  </label>
                  <label className="block w-20 shrink-0">
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Horas</span>
                    <input type="number" step="0.5" min="0" className={inputCls} value={nuevoExterno.duracion} onChange={(e) => setNuevoExterno({ ...nuevoExterno, duracion: e.target.value })} />
                  </label>
                  <button type="submit" disabled={agregando} className="inline-flex items-center gap-1 bg-white border border-line text-ink px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] disabled:opacity-60 shrink-0">
                    <Plus size={15} /> {agregando ? "…" : "Agregar"}
                  </button>
                </div>
              </form>
            </div>
            {verDetalle.archivos && verDetalle.archivos.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6B6558] mb-2">Archivos adjuntos</p>
                <ul className="space-y-1.5">
                  {verDetalle.archivos.map((a, idx) => (
                    <li key={idx}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#3B5166] hover:underline">
                        <FileText size={14} /> {a.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

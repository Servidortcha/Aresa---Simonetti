"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { ClipboardList, Plus, X, Pencil, Trash2, Paperclip, FileText } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";
const textareaCls = inputCls + " resize-y min-h-[90px]";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatFecha(fecha) {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function PartesDiariosPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const esAdmin = rol === "admin";

  const [frentes, setFrentes] = useState([]);
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [frenteId, setFrenteId] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [tareas, setTareas] = useState("");
  const [novedades, setNovedades] = useState("");
  const [numeroParte, setNumeroParte] = useState("");
  const [horas, setHoras] = useState([]);
  const [personasPorFrente, setPersonasPorFrente] = useState({});
  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [archivosActuales, setArchivosActuales] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [filtroFrente, setFiltroFrente] = useState("todos");

  useEffect(() => {
    if (rol && rol !== "admin" && rol !== "encargado") router.replace("/ingreso-egreso");
  }, [rol, router]);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frentesVisibles = useMemo(
    () => (esAdmin ? frentes : frentes.filter((f) => f.encargado_user_id === session?.user?.id)),
    [frentes, esAdmin, session]
  );

  async function cargar() {
    setLoading(true);
    const [{ data: f, error: ef }, { data: p, error: ep }, { data: fp, error: efp }] = await Promise.all([
      supabase.from("frentes_trabajo").select("id, nombre, encargado_user_id").order("nombre"),
      supabase
        .from("partes_diarios")
        .select("*")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("frente_personas").select("frente_id, nombre"),
    ]);
    if (ef) setError("Error al cargar frentes: " + ef.message);
    else setFrentes(f || []);
    if (ep) setError("Error al cargar partes: " + ep.message);
    else {
      const visibles = (f || []).filter((x) => esAdmin || x.encargado_user_id === session?.user?.id);
      const ids = new Set(visibles.map((x) => x.id));
      setPartes((p || []).filter((x) => ids.has(x.frente_id)));
    }
    if (efp) setError("Error al cargar personas: " + efp.message);
    else {
      const map = {};
      (fp || []).forEach((x) => {
        if (!map[x.frente_id]) map[x.frente_id] = [];
        map[x.frente_id].push(x.nombre);
      });
      setPersonasPorFrente(map);
    }
    setLoading(false);
  }

  const partesFiltradas = useMemo(
    () => (filtroFrente === "todos" ? partes : partes.filter((p) => p.frente_id === filtroFrente)),
    [partes, filtroFrente]
  );

  const nombreFrente = useMemo(() => {
    const map = {};
    frentes.forEach((f) => (map[f.id] = f.nombre));
    return map;
  }, [frentes]);

  const esBunge = useMemo(
    () => (nombreFrente[frenteId] || "").trim().toLowerCase() === "bunge tancacha",
    [nombreFrente, frenteId]
  );

  function horasIniciales(frenteIdSel) {
    return (personasPorFrente[frenteIdSel] || []).map((nombre) => ({ nombre, horas: "" }));
  }

  function abrirNuevo() {
    if (frentesVisibles.length === 0) {
      setError(esAdmin ? "No hay frentes cargados. Creá uno en Organigrama." : "Tu frente todavía no está configurado. Avisá al administrador.");
      return;
    }
    setEditing(null);
    setFrenteId(frentesVisibles[0].id);
    setFecha(todayISO());
    setTareas("");
    setNovedades("");
    setNumeroParte("");
    setHoras(horasIniciales(frentesVisibles[0].id));
    setArchivosSeleccionados([]);
    setArchivosActuales([]);
    setShowForm(true);
  }

  function abrirEditar(parte) {
    setEditing(parte);
    setFrenteId(parte.frente_id);
    setFecha(parte.fecha);
    setTareas(parte.tareas || "");
    setNovedades(parte.novedades || "");
    setNumeroParte(parte.numero_parte_bunge || "");
    setHoras(
      Array.isArray(parte.horas_por_persona) && parte.horas_por_persona.length > 0
        ? parte.horas_por_persona.map((h) => ({ nombre: h.nombre || "", horas: String(h.horas ?? "") }))
        : horasIniciales(parte.frente_id)
    );
    setArchivosSeleccionados([]);
    setArchivosActuales(parte.archivos || []);
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (enviando) return;
    setError(null);

    if (!frenteId) {
      setError("Elegí el frente de trabajo.");
      return;
    }

    setEnviando(true);

    const archivosSubidos = [...archivosActuales];
    for (const file of archivosSeleccionados) {
      const nombreSeguro = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${frenteId}/${Date.now()}-${nombreSeguro}`;
      const { error: uploadError } = await supabase.storage.from("partes-diarios").upload(path, file);
      if (uploadError) {
        setError("Error al subir " + file.name + ": " + uploadError.message);
        setEnviando(false);
        return;
      }
      const { data: pub } = supabase.storage.from("partes-diarios").getPublicUrl(path);
      archivosSubidos.push({ name: file.name, url: pub.publicUrl, type: file.type || "" });
    }

    const payload = {
      frente_id: frenteId,
      fecha,
      tareas: tareas.trim() || null,
      novedades: novedades.trim() || null,
      archivos: archivosSubidos.length ? archivosSubidos : null,
    };

    if (esBunge) {
      payload.numero_parte_bunge = numeroParte.trim() || null;
      const horasOk = horas
        .filter((h) => h.nombre.trim() || String(h.horas).trim())
        .map((h) => ({ nombre: h.nombre.trim() || "Sin nombre", horas: Number(h.horas) || 0 }));
      payload.horas_por_persona = horasOk.length ? horasOk : null;
    } else {
      payload.numero_parte_bunge = null;
      payload.horas_por_persona = null;
    }

    let error;
    if (editing) {
      ({ error } = await supabase.from("partes_diarios").update(payload).eq("id", editing.id));
    } else {
      payload.usuario_email = session?.user?.email || null;
      ({ error } = await supabase.from("partes_diarios").insert(payload));
    }

    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    setConfirmacion(editing ? "Parte actualizado" : "Parte guardado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  async function borrar(parte) {
    const { error } = await supabase.from("partes_diarios").delete().eq("id", parte.id);
    if (error) {
      setError(error.message);
      return;
    }
    setConfirmarBorrar(null);
    setConfirmacion("Parte eliminado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  function puedeEditar(parte) {
    return esAdmin || parte.usuario_email === session?.user?.email;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} color="#F4791E" />
          <div>
            <h1 className="font-display text-3xl font-semibold">Partes diarios</h1>
            <p className="text-sm text-[#6B6558] mt-0.5">{esAdmin ? "Todos los frentes" : "Tu frente"}</p>
          </div>
          <span className="ml-1 text-[10px] font-mono bg-[#EAF0F5] text-[#2E6F9E] px-1.5 py-0.5 rounded-sm">v7</span>
        </div>
        <button onClick={abrirNuevo} className="flex items-center gap-1.5 bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] transition-colors">
          <Plus size={16} /> Nuevo parte
        </button>
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}
      {confirmacion && <p className="text-sm text-green mb-4">{confirmacion}</p>}

      {esAdmin && frentes.length > 0 && (
        <div className="mb-4">
          <select
            value={filtroFrente}
            onChange={(e) => setFiltroFrente(e.target.value)}
            className="bg-white border border-line rounded-sm px-3 py-2 text-sm text-ink"
          >
            <option value="todos">Todos los frentes</option>
            {frentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
        {!loading &&
          partesFiltradas.map((p) => (
            <div key={p.id} className="bg-white border border-line rounded-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#EAF0F5] text-[#2E6F9E]">
                    {nombreFrente[p.frente_id] || "Frente"}
                  </span>
                  <span className="font-mono text-xs text-[#6B6558]">{formatFecha(p.fecha)}</span>
                </div>
                {puedeEditar(p) && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => abrirEditar(p)} className="p-2 border border-line rounded-sm text-[#4A4B4D]" title="Editar parte">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setConfirmarBorrar(p)} className="p-2 border border-line rounded-sm text-red" title="Eliminar parte">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {(p.numero_parte_bunge || (p.horas_por_persona && p.horas_por_persona.length > 0)) && (
                <div className="bg-[#EAF0F5] border border-[#C9DCE8] rounded-sm px-3 py-2 mb-2">
                  {p.numero_parte_bunge && (
                    <div className="text-[10px] uppercase tracking-wide text-[#2E6F9E] mb-1">
                      N° de parte Bunge: <span className="font-mono normal-case">{p.numero_parte_bunge}</span>
                    </div>
                  )}
                  {p.horas_por_persona && p.horas_por_persona.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {p.horas_por_persona.map((h, i) => (
                        <div key={i} className="flex justify-between text-sm text-[#3B5166]">
                          <span className="truncate pr-2">{h.nombre}</span>
                          <span className="font-mono shrink-0">{h.horas} h</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {p.tareas && (
                <div className="text-sm mb-2">
                  <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-0.5">Tareas realizadas</span>
                  <p className="text-[#4A463D] whitespace-pre-wrap">{p.tareas}</p>
                </div>
              )}

              {p.novedades && (
                <div className="bg-[#FBEFE6] border border-[#EFD9C4] rounded-sm px-3 py-2 mb-2">
                  <span className="block text-[10px] uppercase tracking-wide text-[#B25A1E] mb-0.5">Novedades</span>
                  <p className="text-sm text-[#8A4A16] whitespace-pre-wrap">{p.novedades}</p>
                </div>
              )}

              {p.archivos && p.archivos.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {p.archivos.map((a, i) =>
                    a.type?.startsWith("image/") ? (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} className="h-20 w-20 object-cover rounded-sm border border-line" />
                      </a>
                    ) : (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#3B5166] hover:underline">
                        <FileText size={14} /> {a.name}
                      </a>
                    )
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-[#EFEBE0] text-xs text-[#8A8578]">
                {p.usuario_email?.replace("@simonetti.local", "") || "—"}
              </div>
            </div>
          ))}
        {!loading && partesFiltradas.length === 0 && (
          <p className="text-center text-sm text-[#8A8578] py-8">Aún no hay partes diarios cargados.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-sm border border-line shadow-2xl my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-xl font-semibold">{editing ? "Editar parte diario" : "Nuevo parte diario"}</h3>
              <button onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Frente de trabajo">
                  <select
                    className={inputCls}
                    value={frenteId}
                    onChange={(e) => {
                      setFrenteId(e.target.value);
                      setNumeroParte("");
                      setHoras(horasIniciales(e.target.value));
                    }}
                    disabled={!esAdmin && frentesVisibles.length <= 1}
                  >
                    {frentesVisibles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fecha">
                  <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                </Field>
              </div>

              {esBunge && (
                <>
                  <Field label="N° de parte diario de Bunge">
                    <input className={inputCls} value={numeroParte} onChange={(e) => setNumeroParte(e.target.value)} placeholder="Ej. 4521" />
                  </Field>

                  <Field label="Horas por persona del sector">
                    <div className="space-y-2">
                      {horas.length === 0 && (
                        <p className="text-xs text-[#8A8578]">No hay personas cargadas en el organigrama para este frente. Agregalas abajo.</p>
                      )}
                      {horas.map((h, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            className={inputCls}
                            list="personal-sector"
                            value={h.nombre}
                            onChange={(e) => setHoras((prev) => prev.map((x, i) => (i === idx ? { ...x, nombre: e.target.value } : x)))}
                            placeholder="Elegí o escribí el nombre"
                          />
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            className={inputCls + " shrink-0"}
                            style={{ width: "4.5rem", appearance: "textfield", WebkitAppearance: "none" }}
                            value={h.horas}
                            onChange={(e) => setHoras((prev) => prev.map((x, i) => (i === idx ? { ...x, horas: e.target.value } : x)))}
                            placeholder="hs"
                          />
                          <button
                            type="button"
                            onClick={() => setHoras((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-[#8A8578] hover:text-red p-1 shrink-0"
                            title="Quitar persona"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <datalist id="personal-sector">
                        {(personasPorFrente[frenteId] || []).map((n, i) => (
                          <option key={i} value={n} />
                        ))}
                      </datalist>
                      <div className="text-[10px] text-[#A79A78] break-all">
                        DEBUG personas={JSON.stringify(personasPorFrente[frenteId])}
                      </div>
                      <div className="text-[10px] text-[#A79A78] break-all">
                        DEBUG horas={JSON.stringify(horas)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setHoras((prev) => [...prev, { nombre: "", horas: "" }])}
                        className="flex items-center gap-1 text-sm text-[#3B5166] hover:underline"
                      >
                        <Plus size={14} /> Agregar persona
                      </button>
                    </div>
                  </Field>
                </>
              )}

              <Field label="Tareas realizadas">
                <textarea className={textareaCls} value={tareas} onChange={(e) => setTareas(e.target.value)} placeholder="Detallá qué se hizo en la jornada..." />
              </Field>

              <Field label="Novedades">
                <textarea className={textareaCls} value={novedades} onChange={(e) => setNovedades(e.target.value)} placeholder="Incidentes, faltas de material, clima, pendientes..." />
              </Field>

              <Field label="Fotos / archivos (opcional)">
                <label className="flex items-center gap-2 border border-dashed border-line rounded-sm px-3 py-2.5 text-sm text-[#6B6558] cursor-pointer hover:bg-[#F2EEE3] transition-colors">
                  <Paperclip size={15} />
                  {archivosSeleccionados.length > 0 ? `${archivosSeleccionados.length} archivo(s) nuevo(s)` : "Elegir fotos o archivos"}
                  <input type="file" multiple accept="image/*,.pdf,.dxf,.dwg" className="hidden" onChange={(e) => setArchivosSeleccionados(Array.from(e.target.files || []))} />
                </label>
                {archivosActuales.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {archivosActuales.map((a, idx) => (
                      <li key={idx} className="flex items-center justify-between bg-[#F2EEE3] rounded-sm px-2.5 py-1.5 text-xs text-[#4A463D]">
                        <span className="truncate pr-2">{a.name}</span>
                        <button
                          type="button"
                          onClick={() => setArchivosActuales((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-[#8A8578] hover:text-red flex-shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>

              <button type="submit" disabled={enviando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {enviando ? "Guardando..." : editing ? "Guardar cambios" : "Guardar parte"}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmarBorrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5">
            <h3 className="font-display text-xl font-semibold mb-2">¿Eliminar parte?</h3>
            <p className="text-sm text-[#6B6558] mb-5">
              El parte del {confirmarBorrar.fecha} de <span className="font-medium text-ink">{nombreFrente[confirmarBorrar.frente_id]}</span> se va a eliminar
              definitivamente.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarBorrar(null)} className="flex-1 py-2 rounded-sm text-sm font-medium border border-line hover:bg-[#F2EEE3]">
                Cancelar
              </button>
              <button onClick={() => borrar(confirmarBorrar)} className="flex-1 py-2 rounded-sm text-sm font-medium bg-red text-white hover:opacity-90">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

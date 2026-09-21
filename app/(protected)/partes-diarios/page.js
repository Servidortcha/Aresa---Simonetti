"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { ClipboardList, Plus, X, Pencil, Trash2, Paperclip, FileText, Printer, ShieldCheck, ChevronDown } from "lucide-react";

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
  const esSupervision = rol === "supervision";
  const soloLectura = esSupervision;

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
  const [progreso, setProgreso] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [filtroFrente, setFiltroFrente] = useState("todos");
  const [imprimirParte, setImprimirParte] = useState(null);
  const [imprimirConImagenes, setImprimirConImagenes] = useState(true);
  const [accesos, setAccesos] = useState([]);
  const [accesoEmail, setAccesoEmail] = useState("");
  const [accesoFrente, setAccesoFrente] = useState("");
  const [guardandoAcceso, setGuardandoAcceso] = useState(false);
  const [mostrarAccesos, setMostrarAccesos] = useState(false);

  useEffect(() => {
    if (rol && rol !== "admin" && rol !== "encargado" && rol !== "supervision") router.replace("/ingreso-egreso");
  }, [rol, router]);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frentesVisibles = useMemo(
    () => (esAdmin || esSupervision ? frentes : frentes.filter((f) => f.encargado_user_id === session?.user?.id)),
    [frentes, esAdmin, esSupervision, session]
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
      const visibles = (f || []).filter((x) => esAdmin || esSupervision || x.encargado_user_id === session?.user?.id);
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

  async function comprimirSiEsImagen(file) {
    if (!file.type.startsWith("image/") || file.size < 600 * 1024) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 1920;
      let { width, height } = bitmap;
      if (width <= maxDim && height <= maxDim) return file;
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, 0.72));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
    } catch {
      return file;
    }
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
    setProgreso(archivosSeleccionados.length > 0 ? `Preparando ${archivosSeleccionados.length} archivo(s)...` : "");

    if (archivosSeleccionados.length + archivosActuales.length > 30) {
      setError("Máximo 30 archivos por parte. Quitá algunos e intentá de nuevo.");
      setEnviando(false);
      setProgreso("");
      return;
    }
    const archivosSubidos = [...archivosActuales];
    try {
      for (let idx = 0; idx < archivosSeleccionados.length; idx++) {
        let file = archivosSeleccionados[idx];
        if (file.type.startsWith("image/") && file.size > 600 * 1024) {
          setProgreso(`Comprimiendo ${idx + 1}/${archivosSeleccionados.length}: ${file.name}`);
          file = await comprimirSiEsImagen(file);
        }
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`${file.name} supera 15 MB incluso comprimida. Achicala o subí menos archivos.`);
        }
        setProgreso(`Subiendo ${idx + 1}/${archivosSeleccionados.length}: ${file.name}`);
        const nombreSeguro = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${frenteId}/${Date.now()}-${idx}-${nombreSeguro}`;
        const { error: uploadError } = await supabase.storage.from("partes-diarios").upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) {
          throw new Error(`Error al subir ${file.name}: ${uploadError.message}`);
        }
        const { data: pub } = supabase.storage.from("partes-diarios").getPublicUrl(path);
        archivosSubidos.push({ name: file.name, url: pub.publicUrl, type: file.type || "" });
      }
    } catch (err) {
      setError(err.message || String(err));
      setEnviando(false);
      setProgreso("");
      return;
    }
    setProgreso("Guardando parte...");

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
    setProgreso("");
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
    if (soloLectura) return false;
    return esAdmin || parte.usuario_email === session?.user?.email;
  }

  async function cargarAccesos() {
    const { data, error } = await supabase.rpc("lista_supervision_accesos");
    if (!error) setAccesos(data || []);
  }

  useEffect(() => {
    if (rol === "admin") cargarAccesos();
  }, [rol]);

  async function asignarAcceso(e) {
    e.preventDefault();
    setError(null);
    if (!accesoEmail.trim() || !accesoFrente) {
      setError("Escribí el correo del supervisor y elegí el frente.");
      return;
    }
    setGuardandoAcceso(true);
    const { data, error } = await supabase.rpc("asignar_frente_supervision", {
      p_email: accesoEmail.trim(),
      p_frente_id: accesoFrente,
    });
    setGuardandoAcceso(false);
    const r = data?.[0];
    if (error || !r?.ok) {
      setError(error?.message || r?.mensaje || "No se pudo otorgar el acceso.");
      return;
    }
    setAccesoEmail("");
    setAccesoFrente("");
    setConfirmacion("Acceso otorgado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargarAccesos();
  }

  async function quitarAcceso(userId, frenteId) {
    setError(null);
    const { data, error } = await supabase.rpc("quitar_frente_supervision", {
      p_user_id: userId,
      p_frente_id: frenteId,
    });
    const r = data?.[0];
    if (error || !r?.ok) {
      setError(error?.message || r?.mensaje || "No se pudo quitar el acceso.");
      return;
    }
    setConfirmacion("Acceso quitado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargarAccesos();
  }

  const accesosPorEmail = useMemo(() => {
    const map = {};
    accesos.forEach((a) => {
      (map[a.email] = map[a.email] || []).push(a);
    });
    return map;
  }, [accesos]);

  function imprimir(parte) {
    setImprimirParte(parte);
    setImprimirConImagenes(true);
    const tituloOriginal = document.title;
    document.title = `Parte-${parte.fecha}-${(nombreFrente[parte.frente_id] || "frente").replace(/\s+/g, "-")}`;
    function restaurar() {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurar);
    }
    window.addEventListener("afterprint", restaurar);
    setTimeout(() => window.print(), 100);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} color="#F4791E" />
          <div>
            <h1 className="font-display text-3xl font-semibold">Partes diarios</h1>
            <p className="text-sm text-[#6B6558] mt-0.5">{esAdmin ? "Todos los frentes" : esSupervision ? "Frentes asignados" : "Tu frente"}</p>
          </div>
        </div>
        {!soloLectura && (
          <button onClick={abrirNuevo} className="flex items-center gap-1.5 bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] transition-colors">
            <Plus size={16} /> Nuevo parte
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}
      {confirmacion && <p className="text-sm text-green mb-4">{confirmacion}</p>}

      {(esAdmin || esSupervision) && frentes.length > 0 && (
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

      {esAdmin && (
        <div className="bg-white border border-line rounded-sm mb-4">
          <button
            onClick={() => setMostrarAccesos((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <ShieldCheck size={15} color="#F4791E" /> Accesos de supervisión ({accesos.length})
            </span>
            <ChevronDown size={15} className={`text-[#8A8578] transition-transform ${mostrarAccesos ? "rotate-180" : ""}`} />
          </button>
          {mostrarAccesos && (
            <div className="px-4 pb-4 pt-1 border-t border-[#EFEBE0]">
              <p className="text-xs text-[#6B6558] my-2">Elegí qué frentes puede ver cada supervisor (solo lectura e impresión).</p>
              <form onSubmit={asignarAcceso} className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  className={inputCls + " flex-1"}
                  value={accesoEmail}
                  onChange={(e) => setAccesoEmail(e.target.value)}
                  placeholder="Correo del supervisor"
                />
                <select className={inputCls + " sm:w-52"} value={accesoFrente} onChange={(e) => setAccesoFrente(e.target.value)}>
                  <option value="">— Frente —</option>
                  {frentes.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
                <button type="submit" disabled={guardandoAcceso} className="bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60 shrink-0">
                  {guardandoAcceso ? "Guardando..." : "Otorgar"}
                </button>
              </form>
              {Object.keys(accesosPorEmail).length === 0 && (
                <p className="text-xs text-[#8A8578]">Todavía no hay accesos otorgados.</p>
              )}
              {Object.entries(accesosPorEmail).map(([email, lista]) => (
                <div key={email} className="flex items-start justify-between gap-2 py-2 border-t border-[#EFEBE0] first:border-t-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{email}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {lista.map((a) => (
                        <span key={a.frente_id} className="inline-flex items-center gap-1 text-xs bg-[#F7F4EC] border border-[#EFEBE0] rounded-sm px-2 py-0.5">
                          {a.frente_nombre}
                          <button onClick={() => quitarAcceso(a.user_id, a.frente_id)} className="text-[#C7522A] hover:text-red" title="Quitar acceso">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => imprimir(p)} className="p-2 border border-line rounded-sm text-[#4A4B4D]" title="Imprimir parte">
                    <Printer size={14} />
                  </button>
                  {puedeEditar(p) && (
                    <>
                      <button onClick={() => abrirEditar(p)} className="p-2 border border-line rounded-sm text-[#4A4B4D]" title="Editar parte">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setConfirmarBorrar(p)} className="p-2 border border-line rounded-sm text-red" title="Eliminar parte">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
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
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name} className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} loading="lazy" className="h-20 w-20 object-cover rounded-sm border border-line bg-[#F7F4EC]" onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; const f = t.nextElementSibling; if (f) f.style.display = 'flex'; }} />
                        <span style={{display: 'none'}} className="h-20 w-20 items-center justify-center rounded-sm border border-line bg-[#F7F4EC] text-[10px] text-[#8A8578] text-center p-1 leading-tight">{a.name}</span>
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

              {enviando && progreso && <p className="text-xs text-[#6B6558] text-center mt-2">{progreso}</p>}
              <button type="submit" disabled={enviando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {enviando ? (progreso || "Guardando...") : editing ? "Guardar cambios" : "Guardar parte"}
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

      {imprimirParte && (
        <div className="print-card hidden">
          <style>{`@media print { .pc-no-print { display: none !important; } }`}</style>
          <div className="pc-header">
            <div className="pc-empresa">Simonetti Montajes Industriales</div>
            <div className="pc-tipo">Parte diario — {nombreFrente[imprimirParte.frente_id] || "Frente"}</div>
          </div>
          <div className="pc-no-print" style={{marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer'}}>
              <input type="checkbox" checked={imprimirConImagenes} onChange={(e) => setImprimirConImagenes(e.target.checked)} />
              Incluir imágenes
            </label>
            <div style={{marginLeft: 'auto', display: 'flex', gap: '8px'}}>
              <button onClick={() => window.print()} style={{padding: '6px 12px', background: '#1C1F1C', color: 'white', borderRadius: '4px', fontSize: '12px', border: 'none', cursor: 'pointer'}}>Imprimir</button>
              <button onClick={() => setImprimirParte(null)} style={{padding: '6px 12px', border: '1px solid #D8D2C4', borderRadius: '4px', fontSize: '12px', background: 'white', cursor: 'pointer'}}>Cerrar</button>
            </div>
          </div>
          <table className="pc-tabla">
            <tbody>
              <tr><td className="pc-label">Frente</td><td>{nombreFrente[imprimirParte.frente_id] || "—"}</td></tr>
              <tr><td className="pc-label">Fecha</td><td>{formatFecha(imprimirParte.fecha)}</td></tr>
              {imprimirParte.numero_parte_bunge && <tr><td className="pc-label">N° Bunge</td><td>{imprimirParte.numero_parte_bunge}</td></tr>}
              <tr><td className="pc-label">Tareas</td><td style={{whiteSpace: 'pre-wrap'}}>{imprimirParte.tareas || "—"}</td></tr>
              {imprimirParte.novedades && <tr><td className="pc-label">Novedades</td><td style={{whiteSpace: 'pre-wrap'}}>{imprimirParte.novedades}</td></tr>}
              {imprimirParte.horas_por_persona && imprimirParte.horas_por_persona.length > 0 && (
                <tr><td className="pc-label">Horas</td><td>
                  {imprimirParte.horas_por_persona.map((h, i) => (
                    <div key={i} style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: i < imprimirParte.horas_por_persona.length -1 ? '1px solid #E4DFD3' : 'none', padding: '2px 0'}}>
                      <span>{h.nombre}</span><span>{h.horas} h</span>
                    </div>
                  ))}
                </td></tr>
              )}
              {imprimirConImagenes && imprimirParte.archivos && imprimirParte.archivos.length > 0 && (
                <tr><td className="pc-label">Imágenes</td><td>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                    {imprimirParte.archivos.filter(a => a.type?.startsWith("image/")).map((a, i) => (
                      <img key={i} src={a.url} alt={a.name} style={{width: '110px', height: '80px', objectFit: 'cover', border: '1px solid #E4DFD3', borderRadius: '4px'}} />
                    ))}
                  </div>
                  {imprimirParte.archivos.filter(a => !a.type?.startsWith("image/")).length > 0 && (
                    <div style={{marginTop: '8px', fontSize: '12px'}}>
                      {imprimirParte.archivos.filter(a => !a.type?.startsWith("image/")).map((a, i) => (
                        <div key={i}>{a.name}</div>
                      ))}
                    </div>
                  )}
                </td></tr>
              )}
              <tr><td className="pc-label">Registrado por</td><td>{imprimirParte.usuario_email || "—"}</td></tr>
            </tbody>
          </table>
          <div className="pc-footer">Powered by Aresa</div>
        </div>
      )}
    </>
  );
}

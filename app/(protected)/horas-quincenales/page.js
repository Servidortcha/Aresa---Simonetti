"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import {
  Clock,
  Plus,
  X,
  Pencil,
  Trash2,
  Printer,
  Loader2,
  Sparkles,
  ImagePlus,
  Users,
} from "lucide-react";
import { DocPrint, DocGrid, DocTabla, DocFila, DocNota, DocFirmas } from "../../../components/DocPrint";

const inputCls =
  "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";
const textareaCls = inputCls + " resize-y min-h-[70px]";

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

function restarDias(iso, dias) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - dias);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtHoras(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function parseHoras(valor) {
  const s = String(valor ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
}

function totalDe(filas) {
  return Math.round(
    (Array.isArray(filas) ? filas : []).reduce((acc, f) => acc + (Number(f.horas) || 0), 0) * 100
  ) / 100;
}

function nombreSeguro(nombre) {
  return String(nombre || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-80);
}

export default function HorasQuincenalesPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const esGestion = rol === "admin" || rol === "subadmin";
  const esSupervision = rol === "supervision";
  const soloLectura = esSupervision;

  const [frentes, setFrentes] = useState([]);
  const [personasPorFrente, setPersonasPorFrente] = useState({});
  const [cargas, setCargas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [frenteId, setFrenteId] = useState("");
  const [desde, setDesde] = useState(restarDias(todayISO(), 13));
  const [hasta, setHasta] = useState(todayISO());
  const [fechaEntrega, setFechaEntrega] = useState(todayISO());
  const [observaciones, setObservaciones] = useState("");
  const [filas, setFilas] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [archivoNuevo, setArchivoNuevo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState("");

  const [iaDisponible, setIaDisponible] = useState(null);
  const [iaLeyendo, setIaLeyendo] = useState(false);
  const [iaMensaje, setIaMensaje] = useState("");
  const [iaError, setIaError] = useState(false);

  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [filtroFrente, setFiltroFrente] = useState("Todos");
  const [imprimirCarga, setImprimirCarga] = useState(null);

  const archivoInputRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    if (rol && !["admin", "subadmin", "encargado", "supervision"].includes(rol)) {
      router.replace("/ingreso-egreso");
    }
  }, [rol, router]);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (soloLectura) return;
    let activo = true;
    fetch("/api/ai/horas")
      .then((r) => r.json())
      .then((d) => {
        if (activo) setIaDisponible(Boolean(d?.disponible));
      })
      .catch(() => {
        if (activo) setIaDisponible(false);
      });
    return () => {
      activo = false;
    };
  }, [soloLectura]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  async function cargar() {
    setLoading(true);
    const [
      { data: frentesData, error: eFrentes },
      { data: cargasData, error: eCargas },
      { data: personasData },
    ] = await Promise.all([
      supabase.from("frentes_trabajo").select("id, nombre, encargado_user_id").order("nombre"),
      supabase.from("horas_quincenales").select("*").order("desde", { ascending: false }),
      supabase.from("frente_personas").select("frente_id, nombre"),
    ]);

    const err = eFrentes || eCargas;
    if (err) {
      setError(
        /does not exist|no existe/i.test(err.message || "")
          ? "Falta aplicar la migración 0042_horas_quincenales.sql en Supabase."
          : err.message
      );
      setLoading(false);
      return;
    }

    setFrentes(frentesData || []);
    setCargas(cargasData || []);

    const map = {};
    (personasData || []).forEach((p) => {
      (map[p.frente_id] = map[p.frente_id] || []).push(p.nombre);
    });
    setPersonasPorFrente(map);
    setLoading(false);
  }

  const frentesVisibles = useMemo(
    () =>
      esGestion || esSupervision
        ? frentes
        : frentes.filter((f) => f.encargado_user_id === session?.user?.id),
    [frentes, esGestion, esSupervision, session]
  );

  const nombreFrente = useMemo(() => {
    const map = {};
    frentes.forEach((f) => {
      map[f.id] = f.nombre;
    });
    return map;
  }, [frentes]);

  const cargasFiltradas = useMemo(
    () =>
      filtroFrente === "Todos"
        ? cargas
        : cargas.filter((c) => c.frente_id === filtroFrente),
    [cargas, filtroFrente]
  );

  const totalFormulario = totalDe(
    filas.map((f) => ({ horas: parseHoras(f.horas) }))
  );

  function limpiarArchivo() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
    setArchivoNuevo(null);
    setArchivo(null);
    setIaMensaje("");
    setIaError(false);
  }

  function abrirNuevo() {
    if (frentesVisibles.length === 0) {
      setError(
        esGestion
          ? "No hay frentes cargados. Creá uno en Organigrama."
          : "Tu frente todavía no está configurado. Avisá al administrador."
      );
      return;
    }
    const fid = frentesVisibles[0].id;
    setEditing(null);
    setFrenteId(fid);
    setDesde(restarDias(todayISO(), 13));
    setHasta(todayISO());
    setFechaEntrega(todayISO());
    setObservaciones("");
    setFilas((personasPorFrente[fid] || []).map((nombre) => ({ nombre, horas: "" })));
    limpiarArchivo();
    setShowForm(true);
  }

  function abrirEditar(carga) {
    setEditing(carga);
    setFrenteId(carga.frente_id || frentesVisibles[0]?.id || "");
    setDesde(carga.desde || restarDias(todayISO(), 13));
    setHasta(carga.hasta || todayISO());
    setFechaEntrega(carga.fecha_entrega || todayISO());
    setObservaciones(carga.observaciones || "");
    setFilas(
      (Array.isArray(carga.detalle) ? carga.detalle : []).map((p) => ({
        nombre: p.nombre || "",
        horas: p.horas != null ? String(p.horas).replace(".", ",") : "",
      }))
    );
    limpiarArchivo();
    if (carga.archivo?.url) {
      setArchivo(carga.archivo);
      setPreviewUrl(carga.archivo.url);
    }
    setShowForm(true);
  }

  function cerrarFormulario() {
    limpiarArchivo();
    setShowForm(false);
  }

  function actualizarFila(idx, campo, valor) {
    setFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
  }

  function agregarFila() {
    setFilas((prev) => [...prev, { nombre: "", horas: "" }]);
  }

  function quitarFila(idx) {
    setFilas((prev) => prev.filter((_, i) => i !== idx));
  }

  function cargarPersonal() {
    const delFrente = personasPorFrente[frenteId] || [];
    setFilas((prev) => {
      const existentes = new Set(prev.map((f) => f.nombre.trim().toLowerCase()).filter(Boolean));
      const nuevas = delFrente
        .filter((n) => !existentes.has(String(n).trim().toLowerCase()))
        .map((nombre) => ({ nombre, horas: "" }));
      return [...prev, ...nuevas];
    });
  }

  async function leerHoras(file) {
    setIaLeyendo(true);
    setIaError(false);
    setIaMensaje("Leyendo la planilla con IA...");
    try {
      const {
        data: { session: sesionActual },
      } = await supabase.auth.getSession();
      if (!sesionActual?.access_token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");

      const fd = new FormData();
      fd.append("archivo", file);

      const res = await fetch("/api/ai/horas", {
        method: "POST",
        headers: { Authorization: `Bearer ${sesionActual.access_token}` },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo leer la planilla.");

      const personas = json?.datos?.personas || [];
      if (!personas.length) {
        setIaError(true);
        setIaMensaje(
          "No se detectaron personas en la imagen. Probá con una foto más nítida o cargá las horas a mano."
        );
        return;
      }

      setFilas(
        personas.map((p) => ({
          nombre: p.nombre || "",
          horas: p.horas != null ? String(p.horas).replace(".", ",") : "",
        }))
      );
      setIaMensaje(
        `Se detectaron ${personas.length} persona(s). Revisá los nombres y las horas antes de guardar.`
      );
    } catch (err) {
      setIaError(true);
      setIaMensaje("No se pudo leer automáticamente: " + err.message);
    } finally {
      setIaLeyendo(false);
    }
  }

  function onFoto(e) {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    if (!file) return;

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setIaMensaje("");
    setIaError(false);

    if (file.size > 4 * 1024 * 1024) {
      setIaError(true);
      setIaMensaje(
        `La imagen pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el límite es 4 MB. Sacá la foto con menos resolución.`
      );
      return;
    }

    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreviewUrl(url);
    setArchivoNuevo(file);

    if (iaDisponible !== false) leerHoras(file);
  }

  async function guardar(e) {
    e.preventDefault();
    setError(null);

    if (!frenteId) {
      setError("Elegí el frente de trabajo.");
      return;
    }
    if (!desde || !hasta) {
      setError("Completá el período de la quincena.");
      return;
    }
    if (hasta < desde) {
      setError("La fecha final no puede ser anterior a la inicial.");
      return;
    }

    const limpias = filas
      .map((f) => ({ nombre: String(f.nombre || "").trim(), horas: parseHoras(f.horas) }))
      .filter((f) => f.nombre);

    if (limpias.length === 0) {
      setError("Agregá al menos una persona con sus horas.");
      return;
    }

    setEnviando(true);
    try {
      let archivoFinal = archivo;

      if (archivoNuevo) {
        setProgreso("Subiendo la foto...");
        const path = `${frenteId}/${Date.now()}-${nombreSeguro(archivoNuevo.name || "planilla.jpg")}`;
        const { error: upErr } = await supabase.storage
          .from("horas-quincenales")
          .upload(path, archivoNuevo, { cacheControl: "3600", upsert: false });
        if (upErr) throw new Error("Error al subir la foto: " + upErr.message);
        const { data: pub } = supabase.storage.from("horas-quincenales").getPublicUrl(path);
        archivoFinal = { name: archivoNuevo.name || "planilla", url: pub.publicUrl, type: archivoNuevo.type || "" };
      }

      setProgreso("Guardando la quincena...");

      const payload = {
        frente_id: frenteId,
        desde,
        hasta,
        fecha_entrega: fechaEntrega || null,
        detalle: limpias,
        total_horas: totalDe(limpias),
        observaciones: observaciones.trim() || null,
        archivo: archivoFinal || null,
        usuario_email: session?.user?.email || null,
      };

      const { error: err } = editing
        ? await supabase.from("horas_quincenales").update(payload).eq("id", editing.id)
        : await supabase.from("horas_quincenales").insert(payload);

      if (err) throw err;

      setShowForm(false);
      limpiarArchivo();
      setConfirmacion(editing ? "Quincena actualizada" : "Quincena guardada");
      setTimeout(() => setConfirmacion(null), 3000);
      cargar();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setEnviando(false);
      setProgreso("");
    }
  }

  async function borrar() {
    if (!confirmarBorrar) return;
    const { error: err } = await supabase.from("horas_quincenales").delete().eq("id", confirmarBorrar.id);
    setConfirmarBorrar(null);
    if (err) {
      setError(err.message);
      return;
    }
    setConfirmacion("Quincena eliminada");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  function imprimir(carga) {
    setImprimirCarga(carga);
    const tituloOriginal = document.title;
    document.title = `Horas ${carga.desde} al ${carga.hasta}`;
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
          <Clock size={20} color="#F4791E" />
          <div>
            <h1 className="font-display text-3xl font-semibold">Horas quincenales</h1>
            <p className="text-sm text-[#6B6558] mt-0.5">
              {esGestion ? "Todos los frentes" : esSupervision ? "Frentes asignados" : "Tu frente"}
            </p>
          </div>
        </div>
        {!soloLectura && (
          <button
            onClick={abrirNuevo}
            className="flex items-center gap-1.5 bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] transition-colors"
          >
            <Plus size={16} /> Nueva quincena
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}
      {confirmacion && <p className="text-sm text-green mb-4">{confirmacion}</p>}

      {(esGestion || esSupervision) && frentes.length > 0 && (
        <div className="mb-4">
          <select
            value={filtroFrente}
            onChange={(e) => setFiltroFrente(e.target.value)}
            className={inputCls + " max-w-xs"}
          >
            <option value="Todos">Todos los frentes</option>
            {frentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#8A8578]">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cargasFiltradas.map((c) => {
            const detalle = Array.isArray(c.detalle) ? c.detalle : [];
            const total = Number(c.total_horas) || totalDe(detalle);
            return (
              <div key={c.id} className="bg-card border border-line rounded-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold truncate">
                      {nombreFrente[c.frente_id] || "Sin frente"}
                    </h3>
                    <p className="text-xs text-[#6B6558]">
                      {formatFecha(c.desde)} al {formatFecha(c.hasta)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block font-display text-2xl font-semibold leading-none">{fmtHoras(total)}</span>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mt-0.5">horas</span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-[#4A463D] space-y-0.5">
                  <p>{detalle.length} persona(s)</p>
                  {c.fecha_entrega && (
                    <p className="text-xs text-[#8A8578]">Entregado: {formatFecha(c.fecha_entrega)}</p>
                  )}
                  {c.observaciones && (
                    <p className="text-xs text-[#8A8578] whitespace-pre-wrap">{c.observaciones}</p>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-[#EFEBE0] flex items-center gap-3 flex-wrap text-sm">
                  <button onClick={() => imprimir(c)} className="flex items-center gap-1 text-[#3B5166] hover:underline">
                    <Printer size={14} /> Imprimir
                  </button>
                  {!soloLectura && (
                    <button onClick={() => abrirEditar(c)} className="flex items-center gap-1 text-[#3B5166] hover:underline">
                      <Pencil size={14} /> Editar
                    </button>
                  )}
                  {!soloLectura && (
                    <button onClick={() => setConfirmarBorrar(c)} className="flex items-center gap-1 text-[#8A8578] hover:text-red">
                      <Trash2 size={14} /> Borrar
                    </button>
                  )}
                  {c.archivo?.url && (
                    <a
                      href={c.archivo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#8A8578] hover:underline ml-auto"
                    >
                      Ver planilla
                    </a>
                  )}
                </div>

                <div className="pt-2 text-xs text-[#8A8578]">
                  {c.usuario_email?.replace("@simonetti.local", "") || "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && cargasFiltradas.length === 0 && (
        <p className="text-center text-sm text-[#8A8578] py-8">
          Aún no hay quincenas cargadas.
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-sm border border-line shadow-2xl my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-xl font-semibold">
                {editing ? "Editar quincena" : "Nueva quincena"}
              </h3>
              <button onClick={cerrarFormulario}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardar} className="p-5">
              <Field label="Frente de trabajo">
                <select
                  className={inputCls}
                  value={frenteId}
                  onChange={(e) => setFrenteId(e.target.value)}
                  disabled={!esGestion && frentesVisibles.length <= 1}
                >
                  {frentesVisibles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Desde">
                  <input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} required />
                </Field>
                <Field label="Hasta">
                  <input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} required />
                </Field>
              </div>

              <Field label="Fecha de entrega al jefe">
                <input
                  type="date"
                  className={inputCls}
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                />
              </Field>

              <div className="border border-line rounded-sm bg-[#F9F7F1] px-3 py-3 mb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#6B6558]">
                    <Sparkles size={13} color="#F4791E" /> Foto de la planilla
                  </span>
                  <button
                    type="button"
                    onClick={() => archivoInputRef.current?.click()}
                    disabled={iaLeyendo}
                    className="flex items-center gap-1.5 border border-line bg-white px-3 py-1.5 rounded-sm text-sm font-medium text-ink hover:bg-[#F2EEE3] disabled:opacity-60"
                  >
                    <ImagePlus size={15} />
                    {archivoNuevo || archivo ? "Cambiar imagen" : "Subir / sacar foto"}
                  </button>
                  <input
                    ref={archivoInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={onFoto}
                  />
                </div>

                <p className="text-[11px] text-[#8A8578] mt-1.5">
                  Sacá una foto de la planilla de horas y la IA completa la lista. Después revisás y confirmás.
                </p>

                {iaDisponible === false && (
                  <p className="text-xs text-[#8A8578] mt-1">
                    La lectura automática no está configurada. Podés cargar las horas a mano.
                  </p>
                )}

                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Planilla de horas"
                    className="mt-2 max-h-40 w-auto rounded-sm border border-line"
                  />
                )}

                {iaLeyendo && (
                  <p className="flex items-center gap-1.5 text-xs text-[#2E6F9E] mt-2">
                    <Loader2 size={13} className="animate-spin" /> Leyendo la planilla...
                  </p>
                )}

                {iaMensaje && (
                  <p className={`text-xs mt-2 ${iaError ? "text-red" : "text-[#2E6F9E]"}`}>{iaMensaje}</p>
                )}
              </div>

              <Field label={`Personas y horas — total ${fmtHoras(totalFormulario)} h`}>
                <div className="space-y-2">
                  {filas.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        value={f.nombre}
                        onChange={(e) => actualizarFila(idx, "nombre", e.target.value)}
                        placeholder="Apellido, Nombre"
                        list="personal-frente"
                      />
                      <input
                        className={inputCls + " shrink-0"}
                        style={{ width: "5.5rem", appearance: "textfield", WebkitAppearance: "none" }}
                        inputMode="decimal"
                        value={f.horas}
                        onChange={(e) => actualizarFila(idx, "horas", e.target.value)}
                        placeholder="hs"
                      />
                      <button
                        type="button"
                        onClick={() => quitarFila(idx)}
                        className="text-[#8A8578] hover:text-red p-1 shrink-0"
                        title="Quitar persona"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  <datalist id="personal-frente">
                    {(personasPorFrente[frenteId] || []).map((n, i) => (
                      <option key={i} value={n} />
                    ))}
                  </datalist>

                  <div className="flex items-center gap-3 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={agregarFila}
                      className="flex items-center gap-1 text-sm text-[#3B5166] hover:underline"
                    >
                      <Plus size={14} /> Agregar persona
                    </button>
                    <button
                      type="button"
                      onClick={cargarPersonal}
                      className="flex items-center gap-1 text-sm text-[#3B5166] hover:underline"
                    >
                      <Users size={14} /> Cargar personal del frente
                    </button>
                  </div>
                </div>
              </Field>

              <Field label="Observaciones (opcional)">
                <textarea
                  className={textareaCls}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej. incluye horas de lluvia del martes..."
                />
              </Field>

              {error && <p className="text-sm text-red mb-3">{error}</p>}
              {progreso && <p className="text-sm text-[#2E6F9E] mb-3">{progreso}</p>}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EFEBE0]">
                <button
                  type="button"
                  onClick={cerrarFormulario}
                  className="px-4 py-2 border border-line rounded-sm text-sm hover:bg-[#F2EEE3]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="px-4 py-2 bg-ink text-paper rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60"
                >
                  {enviando ? "Guardando..." : editing ? "Guardar cambios" : "Guardar quincena"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmarBorrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5">
            <h3 className="font-display text-lg font-semibold mb-2">¿Eliminar esta quincena?</h3>
            <p className="text-sm text-[#6B6558] mb-4">
              {nombreFrente[confirmarBorrar.frente_id] || "Sin frente"} — {formatFecha(confirmarBorrar.desde)} al{" "}
              {formatFecha(confirmarBorrar.hasta)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmarBorrar(null)}
                className="px-4 py-2 border border-line rounded-sm text-sm hover:bg-[#F2EEE3]"
              >
                Cancelar
              </button>
              <button
                onClick={borrar}
                className="px-4 py-2 bg-[#C7522A] text-white rounded-sm text-sm font-medium hover:bg-red"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {imprimirCarga && (
        <DocPrint titulo="Horas quincenales" numero={null}>
          <style>{`@media print { .hq-no-print { display: none !important; } }`}</style>
          <div
            className="hq-no-print"
            style={{ marginBottom: "12px", display: "flex", gap: "8px", alignItems: "center" }}
          >
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <button
                onClick={() => window.print()}
                style={{
                  padding: "6px 12px",
                  background: "#1C1F1C",
                  color: "white",
                  borderRadius: "4px",
                  fontSize: "12px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Imprimir
              </button>
              <button
                onClick={() => setImprimirCarga(null)}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #D8D2C4",
                  borderRadius: "4px",
                  fontSize: "12px",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          </div>

          <DocGrid
            datos={[
              { label: "Frente", valor: nombreFrente[imprimirCarga.frente_id] || "—" },
              {
                label: "Período",
                valor: `${formatFecha(imprimirCarga.desde)} al ${formatFecha(imprimirCarga.hasta)}`,
              },
              { label: "Entrega", valor: formatFecha(imprimirCarga.fecha_entrega) },
              { label: "Registrado por", valor: imprimirCarga.usuario_email || "—" },
            ]}
          />

          <DocTabla
            head={[{ label: "Persona" }, { label: "Horas", align: "right" }]}
            pie={
              <tfoot>
                <tr>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>Total</td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right" }}>
                    {fmtHoras(Number(imprimirCarga.total_horas) || totalDe(imprimirCarga.detalle))} h
                  </td>
                </tr>
              </tfoot>
            }
          >
            {(Array.isArray(imprimirCarga.detalle) ? imprimirCarga.detalle : []).map((p, i) => (
              <DocFila
                key={i}
                zebra={i % 2 === 1}
                celdas={[{ valor: p.nombre }, { valor: `${fmtHoras(p.horas)} h`, align: "right" }]}
              />
            ))}
          </DocTabla>

          <DocNota label="Observaciones" texto={imprimirCarga.observaciones} />
          <DocFirmas izq="Encargado" der="Recibido por" />
        </DocPrint>
      )}
    </>
  );
}

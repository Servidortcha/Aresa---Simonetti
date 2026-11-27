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

const MESES = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

let seqColumnas = 0;
function nuevaKey() {
  seqColumnas += 1;
  return "c" + seqColumnas;
}

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

function fmtMin(total) {
  const min = Math.max(0, Math.round(Number(total) || 0));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

// Acepta "11:50", "121:37", "11h50" o "11,5" (horas decimales) y devuelve minutos.
function aMinutos(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return Math.max(0, Math.round(valor * 60));
  }
  const s = String(valor ?? "").trim();
  if (!s) return 0;

  const hm = s.match(/^(\d{1,4})\s*[:hH]\s*(\d{1,2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);

  const dec = s.replace(",", ".").match(/^(\d{1,4}(?:\.\d{1,2})?)$/);
  if (dec) return Math.max(0, Math.round(Number(dec[1]) * 60));

  return 0;
}

function normalizarTexto(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "PERIODO 24-OCT AL 7-NOV" -> { desde: "2026-10-24", hasta: "2026-11-07" }
function parsearPeriodo(label) {
  const n = normalizarTexto(label);
  if (!n) return null;
  const m = n.match(/(\d{1,2})\s*([a-z]{3,})[a-z]*\s*(?:al|a|hasta)\s*(\d{1,2})\s*([a-z]{3,})/);
  if (!m) return null;

  const mes1 = MESES[m[2].slice(0, 3)];
  const mes2 = MESES[m[4].slice(0, 3)];
  if (!mes1 || !mes2) return null;

  const anio = new Date().getFullYear();
  const desde = `${anio}-${String(mes1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  const anioFin = mes2 < mes1 ? anio + 1 : anio;
  const hasta = `${anioFin}-${String(mes2).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;

  if (hasta < desde) return null;
  return { desde, hasta };
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
  const [migracionFaltante, setMigracionFaltante] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [desde, setDesde] = useState(restarDias(todayISO(), 13));
  const [hasta, setHasta] = useState(todayISO());
  const [fechaEntrega, setFechaEntrega] = useState(todayISO());
  const [observaciones, setObservaciones] = useState("");
  const [columnas, setColumnas] = useState([]);
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
      supabase.from("frentes_trabajo").select("id, nombre").order("nombre"),
      supabase.from("horas_quincenales").select("*").order("desde", { ascending: false }),
      supabase.from("frente_personas").select("frente_id, nombre"),
    ]);

    setFrentes(frentesData || []);

    const map = {};
    (personasData || []).forEach((p) => {
      (map[p.frente_id] = map[p.frente_id] || []).push(p.nombre);
    });
    setPersonasPorFrente(map);

    if (eCargas && /does not exist|no existe|schema cache/i.test(eCargas.message || "")) {
      setMigracionFaltante(true);
      setCargas([]);
      setError(null);
    } else if (eFrentes || eCargas) {
      setError((eFrentes || eCargas).message);
    } else {
      const lista = cargasData || [];
      // Si la tabla existe pero todavía no tiene las columnas nuevas,
      // avisamos que falta la migración 0043.
      setMigracionFaltante(lista.length > 0 && !("columnas" in lista[0]));
      setCargas(lista);
      setError(null);
    }

    setLoading(false);
  }

  const personasTodas = useMemo(() => {
    const set = new Set();
    Object.values(personasPorFrente).forEach((lista) => {
      (lista || []).forEach((n) => {
        if (n) set.add(n);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [personasPorFrente]);

  const totalGeneral = useMemo(
    () => filas.reduce((acc, f) => acc + totalFila(f, columnas), 0),
    [filas, columnas]
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
    if (migracionFaltante) {
      setError("Primero aplicá la migración 0043_horas_quincenales_columnas.sql en Supabase.");
      return;
    }
    const cols = frentes.length
      ? frentes.map((f) => ({ key: nuevaKey(), nombre: f.nombre }))
      : [{ key: nuevaKey(), nombre: "" }];

    setEditing(null);
    setDesde(restarDias(todayISO(), 13));
    setHasta(todayISO());
    setFechaEntrega(todayISO());
    setObservaciones("");
    setColumnas(cols);
    setFilas([]);
    limpiarArchivo();
    setShowForm(true);
  }

  function abrirEditar(carga) {
    const cols = (Array.isArray(carga.columnas) ? carga.columnas : []).map((nombre) => ({
      key: nuevaKey(),
      nombre: String(nombre || ""),
    }));

    const detalle = Array.isArray(carga.detalle) ? carga.detalle : [];
    const filasCarga = detalle.map((p) => {
      const valores = {};
      cols.forEach((c, i) => {
        const minutos = Array.isArray(p.minutos)
          ? p.minutos[i] || 0
          : Math.round((Number(p.horas) || 0) * 60);
        valores[c.key] = fmtMin(minutos);
      });
      return { nombre: p.nombre || "", valores };
    });

    setEditing(carga);
    setDesde(carga.desde || restarDias(todayISO(), 13));
    setHasta(carga.hasta || todayISO());
    setFechaEntrega(carga.fecha_entrega || todayISO());
    setObservaciones(carga.observaciones || "");
    setColumnas(cols.length ? cols : [{ key: nuevaKey(), nombre: "" }]);
    setFilas(filasCarga);
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

  function actualizarFila(idx, nombre) {
    setFilas((prev) => prev.map((f, i) => (i === idx ? { ...f, nombre } : f)));
  }

  function actualizarCelda(idx, key, valor) {
    setFilas((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, valores: { ...f.valores, [key]: valor } } : f))
    );
  }

  function normalizarCelda(idx, key) {
    setFilas((prev) =>
      prev.map((f, i) =>
        i === idx
          ? { ...f, valores: { ...f.valores, [key]: fmtMin(aMinutos(f.valores?.[key])) } }
          : f
      )
    );
  }

  function agregarFila() {
    setFilas((prev) => [...prev, { nombre: "", valores: {} }]);
  }

  function quitarFila(idx) {
    setFilas((prev) => prev.filter((_, i) => i !== idx));
  }

  function cargarPersonal() {
    setFilas((prev) => {
      const existentes = new Set(prev.map((f) => f.nombre.trim().toLowerCase()).filter(Boolean));
      const nuevas = personasTodas
        .filter((n) => !existentes.has(String(n).trim().toLowerCase()))
        .map((nombre) => ({ nombre, valores: {} }));
      return [...prev, ...nuevas];
    });
  }

  function renombrarColumna(key, nombre) {
    setColumnas((prev) => prev.map((c) => (c.key === key ? { ...c, nombre } : c)));
  }

  function agregarColumna() {
    setColumnas((prev) => [...prev, { key: nuevaKey(), nombre: "" }]);
  }

  function quitarColumna(key) {
    setColumnas((prev) => prev.filter((c) => c.key !== key));
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

      const cols = json?.datos?.columnas || [];
      const personas = json?.datos?.personas || [];

      if (!cols.length || !personas.length) {
        setIaError(true);
        setIaMensaje(
          "No se detectaron personas ni columnas en la imagen. Probá con una foto más nítida o cargá las horas a mano."
        );
        return;
      }

      const nuevasCols = cols.map((nombre) => ({ key: nuevaKey(), nombre: String(nombre) }));
      setColumnas(nuevasCols);
      setFilas(
        personas.map((p) => {
          const valores = {};
          nuevasCols.forEach((c, i) => {
            valores[c.key] = fmtMin(Array.isArray(p.minutos) ? p.minutos[i] || 0 : 0);
          });
          return { nombre: p.nombre || "", valores };
        })
      );

      const periodo = parsearPeriodo(json?.datos?.periodo);
      if (periodo) {
        setDesde(periodo.desde);
        setHasta(periodo.hasta);
      }

      setIaMensaje(
        `Se detectaron ${personas.length} persona(s) y ${cols.length} columna(s)${
          periodo ? ` del período ${formatFecha(periodo.desde)} al ${formatFecha(periodo.hasta)}` : ""
        }. Revisá los datos antes de guardar.`
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

    if (!desde || !hasta) {
      setError("Completá el período de la quincena.");
      return;
    }
    if (hasta < desde) {
      setError("La fecha final no puede ser anterior a la inicial.");
      return;
    }

    const colsLimpias = columnas
      .map((c) => ({ key: c.key, nombre: String(c.nombre || "").trim() }))
      .filter((c) => c.nombre);

    if (colsLimpias.length === 0) {
      setError("Agregá al menos una columna de horas (frente u obra).");
      return;
    }

    const filasLimpias = filas
      .map((f) => ({
        nombre: String(f.nombre || "").trim(),
        minutos: colsLimpias.map((c) => aMinutos(f.valores?.[c.key])),
      }))
      .filter((f) => f.nombre);

    if (filasLimpias.length === 0) {
      setError("Agregá al menos una persona con sus horas.");
      return;
    }

    const totalMin = filasLimpias.reduce(
      (acc, f) => acc + f.minutos.reduce((a, b) => a + b, 0),
      0
    );

    setEnviando(true);
    try {
      let archivoFinal = archivo;

      if (archivoNuevo) {
        setProgreso("Subiendo la imagen...");
        const path = `${session?.user?.id || "general"}/${Date.now()}-${nombreSeguro(
          archivoNuevo.name || "planilla.jpg"
        )}`;
        const { error: upErr } = await supabase.storage
          .from("horas-quincenales")
          .upload(path, archivoNuevo, { cacheControl: "3600", upsert: false });
        if (upErr) throw new Error("Error al subir la imagen: " + upErr.message);
        const { data: pub } = supabase.storage.from("horas-quincenales").getPublicUrl(path);
        archivoFinal = {
          name: archivoNuevo.name || "planilla",
          url: pub.publicUrl,
          type: archivoNuevo.type || "",
        };
      }

      setProgreso("Guardando la quincena...");

      const payload = {
        desde,
        hasta,
        fecha_entrega: fechaEntrega || null,
        columnas: colsLimpias.map((c) => c.nombre),
        detalle: filasLimpias,
        total_minutos: totalMin,
        total_horas: Math.round((totalMin / 60) * 100) / 100,
        observaciones: observaciones.trim() || null,
        archivo: archivoFinal || null,
        usuario_email: session?.user?.email || null,
        usuario_id: session?.user?.id || null,
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
      const mensaje = err.message || String(err);
      if (/could not find the '(usuario_id|columnas|total_minutos)' column|column .* does not exist/i.test(mensaje)) {
        setMigracionFaltante(true);
        setError("Falta aplicar la migración 0043_horas_quincenales_columnas.sql en Supabase.");
      } else {
        setError(mensaje);
      }
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
              Rendición de horas por frente, con el total a pasarle al jefe
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

      {migracionFaltante && (
        <div className="mb-4 border border-[#E0C9A0] bg-[#FBF3E2] rounded-sm px-4 py-3">
          <p className="text-sm font-medium text-[#8A4A16]">
            Falta actualizar la tabla de horas quincenales en la base de datos.
          </p>
          <p className="text-xs text-[#6B6558] mt-1">
            Abrí Supabase → SQL Editor, pegá el contenido de{" "}
            <code className="font-mono">supabase/migrations/0043_horas_quincenales_columnas.sql</code> y ejecutalo.
            Después recargá esta página.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}
      {confirmacion && <p className="text-sm text-green mb-4">{confirmacion}</p>}

      {loading ? (
        <p className="text-sm text-[#8A8578]">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cargas.map((c) => {
            const cols = Array.isArray(c.columnas) ? c.columnas : [];
            const detalle = Array.isArray(c.detalle) ? c.detalle : [];
            const totalMin = Number(c.total_minutos) || 0;
            return (
              <div key={c.id} className="bg-card border border-line rounded-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold">
                      {formatFecha(c.desde)} al {formatFecha(c.hasta)}
                    </h3>
                    <p className="text-xs text-[#6B6558]">{detalle.length} persona(s)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block font-display text-2xl font-semibold leading-none">
                      {fmtMin(totalMin)}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mt-0.5">
                      total computable
                    </span>
                  </div>
                </div>

                {cols.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {cols.map((nombre, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 bg-[#F2EEE3] border border-[#E4DFD3] rounded-sm px-2 py-0.5 text-[11px] text-[#4A463D]"
                      >
                        <span className="text-[#8A8578]">{nombre}</span>
                        <span className="font-medium">{fmtMin(totalColumna(detalle, i))}</span>
                      </span>
                    ))}
                  </div>
                )}

                {c.fecha_entrega && (
                  <p className="text-xs text-[#8A8578] mt-2">Entregado: {formatFecha(c.fecha_entrega)}</p>
                )}
                {c.observaciones && (
                  <p className="text-xs text-[#8A8578] mt-1 whitespace-pre-wrap">{c.observaciones}</p>
                )}

                <div className="mt-3 pt-3 border-t border-[#EFEBE0] flex items-center gap-3 flex-wrap text-sm">
                  <button onClick={() => imprimir(c)} className="flex items-center gap-1 text-[#3B5166] hover:underline">
                    <Printer size={14} /> Imprimir
                  </button>
                  {!soloLectura && (
                    <button
                      onClick={() => abrirEditar(c)}
                      className="flex items-center gap-1 text-[#3B5166] hover:underline"
                    >
                      <Pencil size={14} /> Editar
                    </button>
                  )}
                  {!soloLectura && (
                    <button
                      onClick={() => setConfirmarBorrar(c)}
                      className="flex items-center gap-1 text-[#8A8578] hover:text-red"
                    >
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

      {!loading && cargas.length === 0 && !migracionFaltante && (
        <p className="text-center text-sm text-[#8A8578] py-8">Aún no hay quincenas cargadas.</p>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-3xl rounded-sm border border-line shadow-2xl my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-xl font-semibold">
                {editing ? "Editar quincena" : "Nueva quincena"}
              </h3>
              <button onClick={cerrarFormulario}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardar} className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Desde">
                  <input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} required />
                </Field>
                <Field label="Hasta">
                  <input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} required />
                </Field>
                <Field label="Entrega al jefe">
                  <input
                    type="date"
                    className={inputCls}
                    value={fechaEntrega}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                  />
                </Field>
              </div>

              <div className="border border-line rounded-sm bg-[#F9F7F1] px-3 py-3 mb-4">
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
                  Subí la planilla que le pasás al jefe. La IA lee los nombres, las columnas por frente y las horas.
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
                    className="mt-2 max-h-44 w-auto rounded-sm border border-line"
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

              <div className="mb-4">
                <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">
                  Columnas (frentes u obras)
                </span>
                <div className="flex flex-wrap gap-2">
                  {columnas.map((c) => (
                    <div key={c.key} className="flex items-center gap-1 border border-line rounded-sm bg-white px-2 py-1">
                      <input
                        className="bg-transparent text-sm outline-none w-32"
                        value={c.nombre}
                        onChange={(e) => renombrarColumna(c.key, e.target.value)}
                        placeholder="Frente"
                      />
                      <button
                        type="button"
                        onClick={() => quitarColumna(c.key)}
                        className="text-[#8A8578] hover:text-red"
                        title="Quitar columna"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={agregarColumna}
                    className="flex items-center gap-1 text-sm text-[#3B5166] hover:underline px-1"
                  >
                    <Plus size={14} /> Agregar columna
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                  <span className="block text-xs uppercase tracking-wide text-[#6B6558]">
                    Personas y horas
                  </span>
                  <span className="text-xs text-[#6B6558]">
                    Total: <span className="font-semibold text-ink">{fmtMin(totalGeneral)}</span>
                  </span>
                </div>

                <div className="overflow-x-auto border border-line rounded-sm">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#F2EEE3]">
                        <th className="text-left px-2 py-1.5 font-medium text-[#6B6558] text-xs uppercase tracking-wide min-w-[150px]">
                          Nombre
                        </th>
                        {columnas.map((c) => (
                          <th
                            key={c.key}
                            className="text-center px-2 py-1.5 font-medium text-[#6B6558] text-xs uppercase tracking-wide min-w-[80px]"
                          >
                            {c.nombre || "—"}
                          </th>
                        ))}
                        <th className="text-right px-2 py-1.5 font-medium text-[#6B6558] text-xs uppercase tracking-wide min-w-[70px]">
                          Total
                        </th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, idx) => (
                        <tr key={idx} className="border-t border-[#EFEBE0]">
                          <td className="px-1 py-1">
                            <input
                              className="w-full bg-transparent px-1 py-1 text-sm outline-none"
                              value={f.nombre}
                              onChange={(e) => actualizarFila(idx, e.target.value)}
                              placeholder="Apellido, Nombre"
                              list="personal-horas"
                            />
                          </td>
                          {columnas.map((c) => (
                            <td key={c.key} className="px-1 py-1">
                              <input
                                className="w-full bg-transparent px-1 py-1 text-sm text-center outline-none"
                                value={f.valores?.[c.key] ?? ""}
                                onChange={(e) => actualizarCelda(idx, c.key, e.target.value)}
                                onBlur={() => normalizarCelda(idx, c.key)}
                                placeholder="0:00"
                                inputMode="numeric"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1 text-right font-medium whitespace-nowrap">
                            {fmtMin(totalFila(f, columnas))}
                          </td>
                          <td className="px-1 py-1">
                            <button
                              type="button"
                              onClick={() => quitarFila(idx)}
                              className="text-[#8A8578] hover:text-red p-1"
                              title="Quitar persona"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-[#D8D2C4] bg-[#F7F4EC]">
                        <td className="px-2 py-1.5 font-semibold">TOTAL</td>
                        {columnas.map((c) => (
                          <td key={c.key} className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                            {fmtMin(totalColumna(filas, c.key))}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                          {fmtMin(totalGeneral)}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>

                <datalist id="personal-horas">
                  {personasTodas.map((n, i) => (
                    <option key={i} value={n} />
                  ))}
                </datalist>

                <div className="flex items-center gap-3 flex-wrap pt-2">
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
                    <Users size={14} /> Cargar personal
                  </button>
                </div>

                <p className="text-[11px] text-[#8A8578] mt-1">
                  Las horas se cargan como H:MM (por ejemplo 11:50 son 11 horas y 50 minutos). También podés poner
                  48 y se toma como 48:00.
                </p>
              </div>

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
              {formatFecha(confirmarBorrar.desde)} al {formatFecha(confirmarBorrar.hasta)}
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
              {
                label: "Período",
                valor: `${formatFecha(imprimirCarga.desde)} al ${formatFecha(imprimirCarga.hasta)}`,
              },
              { label: "Entrega", valor: formatFecha(imprimirCarga.fecha_entrega) },
              { label: "Registrado por", valor: imprimirCarga.usuario_email || "—" },
            ]}
          />

          <DocTabla
            head={[
              { label: "Nombre" },
              ...(Array.isArray(imprimirCarga.columnas) ? imprimirCarga.columnas : []).map((nombre) => ({
                label: nombre,
                align: "right",
              })),
              { label: "Total", align: "right" },
            ]}
            pie={
              <tfoot>
                <tr>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>TOTAL</td>
                  {(Array.isArray(imprimirCarga.columnas) ? imprimirCarga.columnas : []).map((_, i) => (
                    <td key={i} style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right" }}>
                      {fmtMin(totalColumna(imprimirCarga.detalle, i))}
                    </td>
                  ))}
                  <td style={{ padding: "8px 10px", fontWeight: 700, textAlign: "right" }}>
                    {fmtMin(Number(imprimirCarga.total_minutos) || 0)}
                  </td>
                </tr>
              </tfoot>
            }
          >
            {(Array.isArray(imprimirCarga.detalle) ? imprimirCarga.detalle : []).map((p, i) => (
              <DocFila
                key={i}
                zebra={i % 2 === 1}
                celdas={[
                  { valor: p.nombre },
                  ...(Array.isArray(p.minutos) ? p.minutos : []).map((m) => ({
                    valor: fmtMin(m),
                    align: "right",
                  })),
                  {
                    valor: fmtMin(
                      (Array.isArray(p.minutos) ? p.minutos : []).reduce((a, b) => a + b, 0)
                    ),
                    align: "right",
                  },
                ]}
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

function totalFila(fila, columnas) {
  return (columnas || []).reduce((acc, c) => acc + aMinutos(fila?.valores?.[c.key]), 0);
}

function totalColumna(filas, keyOrIndex) {
  if (!Array.isArray(filas)) return 0;
  return filas.reduce((acc, f) => {
    if (typeof keyOrIndex === "number") {
      return acc + (Array.isArray(f.minutos) ? f.minutos[keyOrIndex] || 0 : 0);
    }
    return acc + aMinutos(f?.valores?.[keyOrIndex]);
  }, 0);
}

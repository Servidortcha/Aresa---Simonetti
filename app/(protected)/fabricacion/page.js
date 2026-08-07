"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Factory, Plus, CheckCircle2, Lock, Boxes, CalendarClock, Download, Pencil, Trash2, Save, X, AlertTriangle } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

const vacioAbrir = { nombre: "", cliente: "", descripcion: "" };

function formatearTiempo(f) {
  if (!f.fecha_cierre) return "—";
  const diff = new Date(f.fecha_cierre) - new Date(f.fecha_apertura);
  if (diff < 0) return "—";
  const minutos = Math.floor(diff / 60000);
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const mins = minutos % 60;
  if (dias > 0) return `${dias} día${dias !== 1 ? "s" : ""} ${horas} h ${mins} min`;
  if (horas > 0) return `${horas} h ${mins} min`;
  return `${mins} min`;
}

function FormAgregarInsumo({ fabricacionId, insumos, subiendo, onAgregar }) {
  const [insumoId, setInsumoId] = useState("");
  const [cantidad, setCantidad] = useState("");

  function enviar(e) {
    e.preventDefault();
    onAgregar(fabricacionId, insumoId, cantidad);
  }

  return (
    <form onSubmit={enviar} className="mt-3 pt-3 border-t border-[#EFEBE0]">
      <div className="flex items-end gap-2">
        <label className="block flex-1 min-w-0">
          <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Insumo</span>
          <select className={inputCls} value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>
            <option value="">— Elegir —</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.unidad || "u"}) — stock: {i.stock}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-24 shrink-0">
          <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Cant.</span>
          <input type="number" step="0.01" min="0" className={inputCls} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={subiendo}
          className="inline-flex items-center gap-1.5 bg-ink text-paper px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60 shrink-0"
        >
          <Plus size={15} /> {subiendo ? "..." : "Agregar"}
        </button>
      </div>
    </form>
  );
}

export default function FabricacionPage() {
  const { rol, session } = useAuth();
  const router = useRouter();

  const [fabricaciones, setFabricaciones] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [insumosPorFabricacion, setInsumosPorFabricacion] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [formAbrir, setFormAbrir] = useState(vacioAbrir);
  const [subiendo, setSubiendo] = useState(false);
  const [cerrando, setCerrando] = useState(null);
  const [editar, setEditar] = useState(null);
  const [formEditar, setFormEditar] = useState(vacioAbrir);
  const [insumosEdit, setInsumosEdit] = useState([]);
  const [nuevoEdit, setNuevoEdit] = useState({ insumo_id: "", cantidad: "" });
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  const abiertas = fabricaciones.filter((f) => f.estado === "abierta");
  const cerradas = fabricaciones.filter((f) => f.estado === "cerrada");

  async function cargar() {
    setLoading(true);
    const [{ data: fac, error: ef }, { data: ins, error: ei }, { data: fis, error: efi }] = await Promise.all([
      supabase.from("fabricaciones").select("*").order("fecha_apertura", { ascending: false }),
      supabase.from("insumos").select("id, nombre, unidad, stock, deposito").eq("activo", true).order("nombre"),
      supabase.from("fabricacion_insumos").select("id, fabricacion_id, insumo_id, cantidad, fecha"),
    ]);
    if (ef) setError(ef.message);
    else setFabricaciones(fac || []);
    if (ei) setError(ei.message);
    else setInsumos(ins || []);
    const mapa = {};
    if (!efi) {
      (fis || []).forEach((fila) => {
        const insumo = (ins || []).find((i) => i.id === fila.insumo_id);
        if (!insumo) return;
        (mapa[fila.fabricacion_id] = mapa[fila.fabricacion_id] || []).push({
          id: fila.id,
          nombre: insumo.nombre,
          unidad: insumo.unidad || "u",
          deposito: insumo.deposito || "",
          cantidad: fila.cantidad,
          fecha: fila.fecha,
        });
      });
      setInsumosPorFabricacion(mapa);
    } else {
      setError(efi.message);
    }
    setLoading(false);
    return mapa;
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && rol !== "admin") router.replace("/ingreso-egreso");
  }, [rol, router]);

  function mostrarMensaje(texto) {
    setConfirmacion(texto);
    setTimeout(() => setConfirmacion(null), 3500);
  }

  async function abrir(e) {
    e.preventDefault();
    if (subiendo) return;
    setError(null);
    if (!formAbrir.nombre.trim()) {
      setError("Poné un nombre para la fabricación.");
      return;
    }
    setSubiendo(true);
    const { error: err } = await supabase.from("fabricaciones").insert({
      nombre: formAbrir.nombre.trim(),
      cliente: formAbrir.cliente.trim() || null,
      descripcion: formAbrir.descripcion.trim() || null,
      usuario_email: session?.user?.email || null,
    });
    setSubiendo(false);
    if (err) {
      setError(err.message);
      return;
    }
    setFormAbrir(vacioAbrir);
    mostrarMensaje("Fabricación abierta");
    cargar();
  }

  async function agregarInsumo(fabricacionId, insumoId, cantidad) {
    setError(null);
    if (!insumoId) {
      setError("Elegí un insumo.");
      return;
    }
    const cant = Number(cantidad);
    if (!cant || cant <= 0) {
      setError("La cantidad tiene que ser un número mayor a 0.");
      return;
    }
    const insumo = insumos.find((i) => i.id === Number(insumoId));
    if (insumo && cant > insumo.stock) {
      setError(`No hay suficiente stock: quedan ${insumo.stock} ${insumo.unidad} de ${insumo.nombre}.`);
      return;
    }
    setSubiendo(true);
    const { data, error: err } = await supabase.rpc("registrar_movimiento_insumo", {
      p_insumo_id: Number(insumoId),
      p_tipo: "salida",
      p_cantidad: cant,
      p_producto_texto: null,
      p_nota: null,
      p_usuario_email: session?.user?.email || null,
      p_fabricacion_id: Number(fabricacionId),
    });
    setSubiendo(false);
    const resultado = data?.[0];
    if (err || !resultado?.ok) {
      setError(err?.message || resultado?.mensaje || "No se pudo registrar.");
      return;
    }
    mostrarMensaje(resultado.mensaje);
    cargar();
  }

  async function cerrar(fabricacionId) {
    setError(null);
    setCerrando(fabricacionId);
    const { data, error: err } = await supabase.rpc("cerrar_fabricacion", { p_fabricacion_id: Number(fabricacionId) });
    setCerrando(null);
    const resultado = data?.[0];
    if (err || !resultado?.ok) {
      setError(err?.message || resultado?.mensaje || "No se pudo cerrar.");
      return;
    }
    mostrarMensaje("Fabricación cerrada");
    cargar();
  }

  function abrirEditar(f) {
    setEditar(f);
    setFormEditar({ nombre: f.nombre || "", cliente: f.cliente || "", descripcion: f.descripcion || "" });
    setInsumosEdit(insumosPorFabricacion[f.id] || []);
    setNuevoEdit({ insumo_id: "", cantidad: "" });
    setError(null);
  }

  async function guardarMetadatos(e) {
    e.preventDefault();
    if (guardando) return;
    setError(null);
    if (!formEditar.nombre.trim()) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    setGuardando(true);
    const { error: err } = await supabase
      .from("fabricaciones")
      .update({ nombre: formEditar.nombre.trim(), cliente: formEditar.cliente.trim() || null, descripcion: formEditar.descripcion.trim() || null })
      .eq("id", editar.id);
    setGuardando(false);
    if (err) {
      setError(err.message);
      return;
    }
    mostrarMensaje("Obra modificada");
    await cargar();
    setEditar({ ...editar, nombre: formEditar.nombre.trim(), cliente: formEditar.cliente.trim() || null, descripcion: formEditar.descripcion.trim() || null });
  }

  async function aplicarCantidad(filaId, cantidad) {
    setError(null);
    const cant = Number(cantidad);
    if (!cant || cant <= 0) {
      setError("La cantidad tiene que ser un número mayor a 0.");
      return;
    }
    setGuardando(true);
    const { data, error: err } = await supabase.rpc("actualizar_insumo_fabricacion", {
      p_fabricacion_id: editar.id,
      p_fila_id: filaId,
      p_insumo_id: null,
      p_cantidad: cant,
      p_usuario_email: session?.user?.email || null,
    });
    setGuardando(false);
    const resultado = data?.[0];
    if (err || !resultado?.ok) {
      setError(err?.message || resultado?.mensaje || "No se pudo actualizar.");
      return;
    }
    const mapa = await cargar();
    setInsumosEdit(mapa[editar.id] || []);
    mostrarMensaje("Cantidad actualizada");
  }

  async function quitarInsumo(filaId) {
    setError(null);
    setGuardando(true);
    const { data, error: err } = await supabase.rpc("eliminar_insumo_fabricacion", {
      p_fila_id: filaId,
      p_usuario_email: session?.user?.email || null,
    });
    setGuardando(false);
    const resultado = data?.[0];
    if (err || !resultado?.ok) {
      setError(err?.message || resultado?.mensaje || "No se pudo quitar el insumo.");
      return;
    }
    const mapa = await cargar();
    setInsumosEdit(mapa[editar.id] || []);
    mostrarMensaje("Insumo quitado y stock devuelto");
  }

  async function agregarInsumoEdit(e) {
    e.preventDefault();
    setError(null);
    if (!nuevoEdit.insumo_id) {
      setError("Elegí un insumo.");
      return;
    }
    const cant = Number(nuevoEdit.cantidad);
    if (!cant || cant <= 0) {
      setError("La cantidad tiene que ser un número mayor a 0.");
      return;
    }
    setGuardando(true);
    const { data, error: err } = await supabase.rpc("actualizar_insumo_fabricacion", {
      p_fabricacion_id: editar.id,
      p_fila_id: null,
      p_insumo_id: Number(nuevoEdit.insumo_id),
      p_cantidad: cant,
      p_usuario_email: session?.user?.email || null,
    });
    setGuardando(false);
    const resultado = data?.[0];
    if (err || !resultado?.ok) {
      setError(err?.message || resultado?.mensaje || "No se pudo agregar.");
      return;
    }
    const mapa = await cargar();
    setInsumosEdit(mapa[editar.id] || []);
    setNuevoEdit({ insumo_id: "", cantidad: "" });
    mostrarMensaje("Insumo agregado");
  }

  async function eliminarObra() {
    setError(null);
    const f = confirmarEliminar;
    setGuardando(true);
    const { data, error: err } = await supabase.rpc("eliminar_fabricacion", {
      p_fabricacion_id: f.id,
      p_usuario_email: session?.user?.email || null,
    });
    setGuardando(false);
    const resultado = data?.[0];
    if (err || !resultado?.ok) {
      setError(err?.message || resultado?.mensaje || "No se pudo eliminar.");
      return;
    }
    setConfirmarEliminar(null);
    setEditar(null);
    mostrarMensaje("Obra eliminada y stock devuelto");
    cargar();
  }

  async function exportarResumen(f) {
    const XLSX = await import("xlsx");
    const insumosF = insumosPorFabricacion[f.id] || [];
    const total = insumosF.reduce((acc, x) => acc + x.cantidad, 0);
    const filasResumen = [
      ["FABRICACIÓN", f.nombre],
      ["Cliente", f.cliente || ""],
      ["Descripción", f.descripcion || ""],
      ["Fecha apertura", new Date(f.fecha_apertura).toLocaleString("es-MX")],
      ["Fecha cierre", f.fecha_cierre ? new Date(f.fecha_cierre).toLocaleString("es-MX") : ""],
      ["Tiempo", formatearTiempo(f)],
      ["Insumos distintos", insumosF.length],
      ["Total unidades usadas", total],
    ];
    const filasInsumos = insumosF.map((i) => [i.nombre, i.unidad, i.cantidad]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasResumen), "Resumen");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["Insumo", "Unidad", "Cantidad"], ...filasInsumos]), "Insumos");
    const nombreArchivo = `fabricacion-${f.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "obra"}.xlsx`;
    XLSX.writeFile(libro, nombreArchivo);
  }

  if (rol && rol !== "admin") return null;

  function Tarjeta({ f }) {
    const insumosF = insumosPorFabricacion[f.id] || [];
    const total = insumosF.reduce((acc, x) => acc + x.cantidad, 0);
    return (
      <div className="bg-white border border-line rounded-sm p-4 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium leading-snug">{f.nombre}</div>
            {f.cliente && <div className="text-xs text-[#6B6558] mt-0.5">{f.cliente}</div>}
            <div className="text-xs text-[#8A8578] font-mono mt-1">
              {new Date(f.fecha_apertura).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
            </div>
          </div>
          {f.estado === "cerrada" ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#6B6558] bg-[#EFEBE0] px-2 py-1 rounded-sm shrink-0">
              <Lock size={11} /> Cerrada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#3D5A2E] bg-[#EAF0E4] px-2 py-1 rounded-sm shrink-0">
              <Boxes size={11} /> Abierta
            </span>
          )}
        </div>

        {f.descripcion && <p className="text-sm text-[#4A463D] mt-2 whitespace-pre-wrap">{f.descripcion}</p>}

        {insumosF.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#EFEBE0]">
            <p className="text-[10px] uppercase tracking-wide text-[#8A8578] mb-1.5">Insumos usados</p>
            <ul className="space-y-1">
              {insumosF.map((ins) => (
                <li key={ins.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-[#4A463D] min-w-0 truncate">
                    <Boxes size={13} className="shrink-0 text-[#8A8578]" />
                    <span className="truncate">{ins.nombre}</span>
                  </span>
                  <span className="font-mono whitespace-nowrap">
                    {ins.cantidad} {ins.unidad}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[#8A8578] mt-1.5">Total: {total} unidad{(insumosF.length !== 1) ? "es" : ""} · {insumosF.length} insumo{(insumosF.length !== 1) ? "s" : ""}</p>
          </div>
        )}

        {f.estado === "abierta" && (
          <>
            <FormAgregarInsumo fabricacionId={f.id} insumos={insumos} subiendo={subiendo} onAgregar={agregarInsumo} />
            <button
              onClick={() => cerrar(f.id)}
              disabled={cerrando === f.id}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 border border-[#C7522A] text-[#C7522A] px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#C7522A] hover:text-white transition-colors disabled:opacity-60"
            >
              <CheckCircle2 size={15} /> {cerrando === f.id ? "Cerrando..." : "Finalizar fabricación"}
            </button>
          </>
        )}

        {f.estado === "cerrada" && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-[#8A8578] mt-3">
              <CalendarClock size={13} /> Tiempo: <span className="font-medium text-[#4A463D]">{formatearTiempo(f)}</span>
              <span className="mx-1 text-[#D8D2C4]">·</span>
              Cerrada el {new Date(f.fecha_cierre).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#EFEBE0]">
              <button
                onClick={() => exportarResumen(f)}
                className="inline-flex items-center justify-center gap-1.5 bg-ink text-paper px-2 py-2 rounded-sm text-xs font-medium hover:bg-[#333731]"
              >
                <Download size={14} /> Resumen
              </button>
              <button
                onClick={() => abrirEditar(f)}
                className="inline-flex items-center justify-center gap-1.5 bg-white border border-line text-ink px-2 py-2 rounded-sm text-xs font-medium hover:bg-[#F2EEE3]"
              >
                <Pencil size={14} /> Editar
              </button>
              <button
                onClick={() => setConfirmarEliminar(f)}
                className="inline-flex items-center justify-center gap-1.5 bg-white border border-[#E4C7BC] text-[#C7522A] px-2 py-2 rounded-sm text-xs font-medium hover:bg-[#FBF0EB]"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <Factory size={20} color="#F4791E" />
        <h1 className="font-display text-3xl font-semibold">Fabricación</h1>
      </div>

      {confirmacion && (
        <div className="flex items-center gap-2 bg-[#EAF0E4] border border-[#B9CBA9] text-[#3D5A2E] text-sm px-4 py-3 rounded-sm mb-5 max-w-2xl">
          <CheckCircle2 size={16} /> {confirmacion}
        </div>
      )}
      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      <div className="flex flex-col gap-6">
        <form onSubmit={abrir} className="bg-white border border-line rounded-sm p-4 sm:p-6 w-full max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Nombre de la fabricación / obra">
              <input className={inputCls} value={formAbrir.nombre} onChange={(e) => setFormAbrir({ ...formAbrir, nombre: e.target.value })} placeholder="Ej. Estructura tanque Bunge" />
            </Field>
            <Field label="Cliente">
              <input className={inputCls} value={formAbrir.cliente} onChange={(e) => setFormAbrir({ ...formAbrir, cliente: e.target.value })} placeholder="Opcional" />
            </Field>
          </div>
          <Field label="Descripción (opcional)">
            <textarea className={inputCls + " resize-y min-h-[80px]"} value={formAbrir.descripcion} onChange={(e) => setFormAbrir({ ...formAbrir, descripcion: e.target.value })} placeholder="Detalle de lo que se va a fabricar..." />
          </Field>
          <button type="submit" disabled={subiendo} className="w-full mt-1 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            {subiendo ? "Guardando..." : "Abrir fabricación"}
          </button>
        </form>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink mb-3">Abiertas ({abiertas.length})</h2>
          {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
          {!loading && abiertas.length === 0 && (
            <p className="text-center text-sm text-[#8A8578] py-8">No hay fabricaciones abiertas. Abrí una para empezar a cargar insumos.</p>
          )}
          {!loading && abiertas.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {abiertas.map((f) => <Tarjeta key={f.id} f={f} />)}
            </div>
          )}
        </div>

        {!loading && cerradas.length > 0 && (
          <div>
            <h2 className="font-display text-xl font-semibold text-ink mb-3">Cerradas ({cerradas.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cerradas.map((f) => <Tarjeta key={f.id} f={f} />)}
            </div>
          </div>
        )}
      </div>

      {editar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditar(null)}>
          <div className="bg-card w-full max-w-lg rounded-sm border border-line shadow-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-semibold">Editar obra</h3>
              <button onClick={() => setEditar(null)} className="text-[#8A8578] hover:text-ink" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardarMetadatos}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                <Field label="Nombre de la fabricación / obra">
                  <input className={inputCls} value={formEditar.nombre} onChange={(e) => setFormEditar({ ...formEditar, nombre: e.target.value })} />
                </Field>
                <Field label="Cliente">
                  <input className={inputCls} value={formEditar.cliente} onChange={(e) => setFormEditar({ ...formEditar, cliente: e.target.value })} />
                </Field>
              </div>
              <Field label="Descripción">
                <textarea className={inputCls + " resize-y min-h-[70px]"} value={formEditar.descripcion} onChange={(e) => setFormEditar({ ...formEditar, descripcion: e.target.value })} />
              </Field>
              <button type="submit" disabled={guardando} className="w-full bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {guardando ? "Guardando..." : "Guardar datos de la obra"}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-[#EFEBE0]">
              <p className="text-xs uppercase tracking-wide text-[#6B6558] mb-2">Insumos (al cambiar cantidad se ajusta el stock)</p>
              {insumosEdit.length === 0 && <p className="text-xs text-[#8A8578] mb-3">Esta obra no tiene insumos cargados.</p>}
              <ul className="space-y-2 mb-3">
                {insumosEdit.map((ins) => (
                  <li key={ins.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-[#4A463D] truncate">{ins.nombre} <span className="text-[#8A8578]">({ins.unidad})</span></span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputCls + " w-24 shrink-0 text-center"}
                      defaultValue={ins.cantidad}
                      onBlur={(e) => Number(e.target.value) !== Number(ins.cantidad) && aplicarCantidad(ins.id, e.target.value)}
                    />
                    <button
                      onClick={() => quitarInsumo(ins.id)}
                      disabled={guardando}
                      className="text-[#C7522A] hover:text-red p-1 shrink-0"
                      title="Quitar insumo (devuelve el stock)"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={agregarInsumoEdit} className="flex items-end gap-2 pt-3 border-t border-[#EFEBE0]">
                <label className="block flex-1 min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Agregar insumo</span>
                  <select className={inputCls} value={nuevoEdit.insumo_id} onChange={(e) => setNuevoEdit({ ...nuevoEdit, insumo_id: e.target.value })}>
                    <option value="">— Elegir —</option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre} ({i.unidad || "u"}) — stock: {i.stock}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block w-20 shrink-0">
                  <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Cant.</span>
                  <input type="number" step="0.01" min="0" className={inputCls} value={nuevoEdit.cantidad} onChange={(e) => setNuevoEdit({ ...nuevoEdit, cantidad: e.target.value })} />
                </label>
                <button type="submit" disabled={guardando} className="inline-flex items-center gap-1 bg-ink text-paper px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60 shrink-0">
                  <Save size={14} /> {guardando ? "..." : "Agregar"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmarEliminar(null)}>
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-[#C7522A] mb-2">
              <AlertTriangle size={18} />
              <h3 className="font-display text-lg font-semibold text-ink">Eliminar obra</h3>
            </div>
            <p className="text-sm text-[#4A463D] mb-1">
              Vas a eliminar <strong>{confirmarEliminar.nombre}</strong>.
            </p>
            <p className="text-xs text-[#8A8578] mb-4">Se devolverán al stock todos los insumos que tenía cargados.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarEliminar(null)} disabled={guardando} className="flex-1 bg-white border border-line text-ink py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3]">
                Cancelar
              </button>
              <button onClick={eliminarObra} disabled={guardando} className="flex-1 bg-[#C7522A] text-white py-2 rounded-sm text-sm font-medium hover:bg-[#A94420] disabled:opacity-60">
                {guardando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

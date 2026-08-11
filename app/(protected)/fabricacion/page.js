"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Factory, Plus, CheckCircle2, Lock, Boxes, CalendarClock, Download, Pencil, Trash2, Save, X, AlertTriangle, ClipboardList, Wrench, Receipt } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function pesos(n) {
  const v = Number(n || 0);
  return "$ " + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

const vacioAbrir = { nombre: "", cliente: "", descripcion: "" };

const HORAS_POR_DIA = 11;

function diffMs(apertura, cierre) {
  const fin = cierre ? new Date(cierre).getTime() : Date.now();
  return fin - new Date(apertura).getTime();
}

function formatearTiempo(apertura, cierre) {
  const ms = diffMs(apertura, cierre);
  if (ms < 0) return "—";
  const minutos = Math.floor(ms / 60000);
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const mins = minutos % 60;
  if (dias > 0) return `${dias} día${dias !== 1 ? "s" : ""} ${horas} h ${mins} min`;
  if (horas > 0) return `${horas} h ${mins} min`;
  return `${mins} min`;
}

function formatearHorasHombre(apertura, cierre) {
  const ms = diffMs(apertura, cierre);
  if (ms < 0) return "—";
  const horas = (ms / 3600000) * (HORAS_POR_DIA / 24);
  const horasEnteras = Math.floor(horas);
  const minutos = Math.round((horas - horasEnteras) * 60);
  if (horasEnteras === 0) return `${minutos} min`;
  if (minutos === 0) return `${horasEnteras} h`;
  return `${horasEnteras} h ${minutos} min`;
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

function FormAgregarEstimado({ fabricacionId, insumos, subiendo, onAgregar }) {
  const [insumoId, setInsumoId] = useState("");
  const [cantidad, setCantidad] = useState("");

  function enviar(e) {
    e.preventDefault();
    onAgregar(fabricacionId, insumoId, cantidad);
  }

  return (
    <form onSubmit={enviar} className="flex items-end gap-2">
      <label className="block flex-1 min-w-0">
        <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Agregar al estimado</span>
        <select className={inputCls} value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>
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
        <input type="number" step="0.01" min="0" className={inputCls} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      </label>
      <button
        type="submit"
        disabled={subiendo}
        className="inline-flex items-center gap-1 bg-white border border-line text-ink px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] disabled:opacity-60 shrink-0"
      >
        <ClipboardList size={14} /> {subiendo ? "..." : "Agregar"}
      </button>
    </form>
  );
}

export default function FabricacionPage() {
  const { rol, session } = useAuth();
  const router = useRouter();

  const [fabricaciones, setFabricaciones] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [insumosPorFabricacion, setInsumosPorFabricacion] = useState({});
  const [estimadosPorFabricacion, setEstimadosPorFabricacion] = useState({});
  const [trabajosPorFab, setTrabajosPorFab] = useState({});
  const [articulosPorFab, setArticulosPorFab] = useState({});
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
  const [nuevoArticulo, setNuevoArticulo] = useState({ descripcion: "", cantidad: "", valor_unitario: "" });
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [, setAhora] = useState(Date.now());

  const abiertas = fabricaciones.filter((f) => f.estado === "abierta");
  const cerradas = fabricaciones.filter((f) => f.estado === "cerrada");

  async function cargar() {
    setLoading(true);
    const [{ data: fac, error: ef }, { data: ins, error: ei }, { data: fis, error: efi }, { data: est, error: eest }, { data: tra, error: et }, { data: art, error: ea }] = await Promise.all([
      supabase.from("fabricaciones").select("*").order("fecha_apertura", { ascending: false }),
      supabase.from("insumos").select("id, nombre, unidad, stock, deposito").eq("activo", true).order("nombre"),
      supabase.from("fabricacion_insumos").select("id, fabricacion_id, insumo_id, cantidad, fecha"),
      supabase.from("fabricacion_estimados").select("id, fabricacion_id, insumo_id, cantidad"),
      supabase.from("trabajos").select("id, tipo, cliente, descripcion, duracion_minutos, duracion_horas, confirmado, fabricacion_id, fecha"),
      supabase.from("fabricacion_articulos_externos").select("*"),
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
          insumo_id: fila.insumo_id,
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
    const estMap = {};
    if (!eest) {
      (est || []).forEach((fila) => {
        const insumo = (ins || []).find((i) => i.id === fila.insumo_id);
        if (!insumo) return;
        (estMap[fila.fabricacion_id] = estMap[fila.fabricacion_id] || []).push({
          id: fila.id,
          insumo_id: fila.insumo_id,
          nombre: insumo.nombre,
          unidad: insumo.unidad || "u",
          cantidad: fila.cantidad,
        });
      });
      setEstimadosPorFabricacion(estMap);
    } else {
      setError(eest.message);
    }
    const trabMap = {};
    if (!et) {
      (tra || []).forEach((t) => {
        if (t.fabricacion_id != null) (trabMap[t.fabricacion_id] = trabMap[t.fabricacion_id] || []).push(t);
      });
      setTrabajosPorFab(trabMap);
    } else {
      setError(et.message);
    }
    const artMap = {};
    if (!ea) {
      (art || []).forEach((a) => {
        (artMap[a.fabricacion_id] = artMap[a.fabricacion_id] || []).push(a);
      });
      setArticulosPorFab(artMap);
    } else {
      setError(ea.message);
    }
    setLoading(false);
    return mapa;
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
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

  async function agregarEstimado(fabricacionId, insumoId, cantidad) {
    setError(null);
    if (!insumoId) {
      setError("Elegí un insumo para el estimado.");
      return;
    }
    const cant = Number(cantidad);
    if (!cant || cant <= 0) {
      setError("La cantidad del estimado tiene que ser mayor a 0.");
      return;
    }
    const { error: err } = await supabase.from("fabricacion_estimados").insert({
      fabricacion_id: Number(fabricacionId),
      insumo_id: Number(insumoId),
      cantidad: cant,
      usuario_email: session?.user?.email || null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    mostrarMensaje("Estimado agregado");
    cargar();
  }

  async function cambiarEstimado(filaId, cantidad) {
    setError(null);
    const cant = Number(cantidad);
    if (!cant || cant <= 0) {
      setError("La cantidad del estimado tiene que ser mayor a 0.");
      return;
    }
    const { error: err } = await supabase.from("fabricacion_estimados").update({ cantidad: cant }).eq("id", filaId);
    if (err) {
      setError(err.message);
      return;
    }
    cargar();
  }

  async function quitarEstimado(filaId) {
    setError(null);
    const { error: err } = await supabase.from("fabricacion_estimados").delete().eq("id", filaId);
    if (err) {
      setError(err.message);
      return;
    }
    cargar();
  }

  async function agregarArticulo(fabricacionId, e) {
    e.preventDefault();
    setError(null);
    const descripcion = nuevoArticulo.descripcion.trim();
    if (!descripcion) {
      setError("Poné la descripción del artículo externo.");
      return;
    }
    const cantidad = Number(nuevoArticulo.cantidad);
    const valor = Number(nuevoArticulo.valor_unitario);
    if (!cantidad || cantidad <= 0) {
      setError("La cantidad tiene que ser mayor a 0.");
      return;
    }
    if (!valor || valor < 0) {
      setError("Poné un valor en pesos.");
      return;
    }
    setSubiendo(true);
    const { error: err } = await supabase.from("fabricacion_articulos_externos").insert({
      fabricacion_id: Number(fabricacionId),
      descripcion,
      cantidad,
      valor_unitario: valor,
      usuario_email: session?.user?.email || null,
    });
    setSubiendo(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNuevoArticulo({ descripcion: "", cantidad: "", valor_unitario: "" });
    mostrarMensaje("Artículo externo agregado");
    cargar();
  }

  async function quitarArticulo(id) {
    setError(null);
    const { error: err } = await supabase.from("fabricacion_articulos_externos").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    mostrarMensaje("Artículo externo quitado");
    cargar();
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

  async function exportarPDF(f) {
    setSubiendo(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const insumosF = insumosPorFabricacion[f.id] || [];
      const estimadosF = estimadosPorFabricacion[f.id] || [];
      const total = insumosF.reduce((acc, x) => acc + x.cantidad, 0);

      const usadosMap = {};
      insumosF.forEach((ins) => {
        usadosMap[ins.insumo_id] = (usadosMap[ins.insumo_id] || 0) + Number(ins.cantidad);
      });
      let avancePdf = null;
      if (estimadosF.length > 0) {
        let sumaUsado = 0;
        let sumaEst = 0;
        estimadosF.forEach((est) => {
          const eq = Number(est.cantidad);
          sumaUsado += Math.min(usadosMap[est.insumo_id] || 0, eq);
          sumaEst += eq;
        });
        avancePdf = sumaEst > 0 ? Math.round((sumaUsado / sumaEst) * 100) : 0;
      }

      const doc = new jsPDF();

      doc.setFillColor(244, 121, 30);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Resumen de Fabricación", 14, 12);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(f.nombre, 14, 20);

      doc.setTextColor(30, 30, 30);
      let y = 40;
      const linea = (label, valor) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(label, 14, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(valor ?? ""), 65, y);
        y += 6.5;
      };
      linea("Cliente:", f.cliente || "—");
      linea("Fecha apertura:", new Date(f.fecha_apertura).toLocaleString("es-MX"));
      linea("Fecha cierre:", f.fecha_cierre ? new Date(f.fecha_cierre).toLocaleString("es-MX") : "—");
      linea(`Hora hombre (${HORAS_POR_DIA} h/día):`, formatearHorasHombre(f.fecha_apertura, f.fecha_cierre));
      linea("Tiempo transcurrido:", formatearTiempo(f.fecha_apertura, f.fecha_cierre));
      linea("Total unidades usadas:", total);
      if (avancePdf !== null) linea("Avance de la obra:", avancePdf + "%");
      y += 2;

      if (f.descripcion) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Descripción:", 14, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        const lineasDesc = doc.splitTextToSize(f.descripcion, 180);
        doc.text(lineasDesc, 14, y);
        y += lineasDesc.length * 5 + 4;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(244, 121, 30);
      doc.text("Insumos usados", 14, y + 4);
      autoTable(doc, {
        startY: y + 8,
        head: [["Insumo", "Unidad", "Cantidad"]],
        body: insumosF.length
          ? insumosF.map((i) => [i.nombre, i.unidad, String(i.cantidad)])
          : [["Sin insumos cargados", "", ""]],
        styles: { fontSize: 9.5 },
        headStyles: { fillColor: [60, 60, 60] },
        theme: "striped",
        margin: { left: 14, right: 14 },
      });

      if (estimadosF.length > 0) {
        const ultimoY = doc.lastAutoTable.finalY + 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(244, 121, 30);
        doc.text("Estimado de insumos a usar", 14, ultimoY);
        autoTable(doc, {
          startY: ultimoY + 4,
          head: [["Insumo", "Unidad", "Estimado", "Usado", "Avance"]],
          body: estimadosF.map((i) => {
            const eq = Number(i.cantidad);
            const us = usadosMap[i.insumo_id] || 0;
            const pct = eq > 0 ? Math.min(100, Math.round((us / eq) * 100)) : us > 0 ? 100 : 0;
            return [i.nombre, i.unidad, String(i.cantidad), String(us), pct + "%"];
          }),
          styles: { fontSize: 9.5 },
          headStyles: { fillColor: [60, 60, 60] },
          theme: "striped",
          margin: { left: 14, right: 14 },
        });
      }

      const nombreArchivo = `fabricacion-${f.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "obra"}.pdf`;
      doc.save(nombreArchivo);
    } catch (err) {
      setError("Error al generar el PDF: " + err.message);
    } finally {
      setSubiendo(false);
    }
  }

  if (rol && rol !== "admin") return null;

  function Tarjeta({ f }) {
    const insumosF = insumosPorFabricacion[f.id] || [];
    const estimadosF = estimadosPorFabricacion[f.id] || [];
    const trabajosF = trabajosPorFab[f.id] || [];
    const articulosF = articulosPorFab[f.id] || [];
    const total = insumosF.reduce((acc, x) => acc + x.cantidad, 0);

    const usadosMap = {};
    insumosF.forEach((ins) => {
      usadosMap[ins.insumo_id] = (usadosMap[ins.insumo_id] || 0) + Number(ins.cantidad);
    });
    const usadoPorId = {};
    estimadosF.forEach((est) => {
      const estQty = Number(est.cantidad);
      const usado = usadosMap[est.insumo_id] || 0;
      const pct = estQty > 0 ? Math.min(100, Math.round((usado / estQty) * 100)) : usado > 0 ? 100 : 0;
      usadoPorId[est.id] = { usado, estQty, pct };
    });
    let avance = null;
    if (estimadosF.length > 0) {
      let sumaUsado = 0;
      let sumaEst = 0;
      estimadosF.forEach((est) => {
        const d = usadoPorId[est.id];
        sumaUsado += Math.min(d.usado, d.estQty);
        sumaEst += d.estQty;
      });
      avance = sumaEst > 0 ? Math.min(100, Math.round((sumaUsado / sumaEst) * 100)) : 0;
    }

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

        {avance !== null && (
          <div className="mt-3 pt-3 border-t border-[#EFEBE0]">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wide text-[#8A8578]">Avance de la obra</p>
              <span className="font-mono text-sm font-semibold text-green">{avance}%</span>
            </div>
            <div className="h-2 rounded-sm bg-[#EFEBE0] overflow-hidden">
              <div className="h-full bg-green transition-all" style={{ width: `${avance}%` }} />
            </div>
            <p className="text-[10px] text-[#B0AA9A] mt-1.5">Materiales usados vs estimado de la obra</p>
            {f.estado === "cerrada" && (
              <ul className="mt-2 space-y-1">
                {estimadosF.map((est) => {
                  const d = usadoPorId[est.id];
                  return (
                    <li key={est.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 text-[#4A463D] truncate">{est.nombre}</span>
                      <span className="font-mono text-[#6B6558] whitespace-nowrap">
                        {d.usado} / {d.estQty} {est.unidad}
                      </span>
                      <span className="font-mono w-8 text-right text-[#4A463D]">{d.pct}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

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

        {trabajosF.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#EFEBE0]">
            <p className="text-[10px] uppercase tracking-wide text-[#8A8578] mb-1.5">Trabajos asignados ({trabajosF.length})</p>
            <ul className="space-y-1">
              {trabajosF.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 text-[#4A463D] min-w-0 truncate">
                    <Wrench size={13} className="shrink-0 text-[#8A8578]" />
                    <span className="truncate">
                      {t.tipo}: {t.cliente || "Sin cliente"}
                      {t.descripcion ? ` · ${t.descripcion}` : ""}
                    </span>
                  </span>
                  <span className="text-xs font-mono text-[#6B6558] whitespace-nowrap shrink-0">
                    {t.tipo === "Corte Láser"
                      ? (t.duracion_minutos != null ? `${t.duracion_minutos} min` : "")
                      : (t.duracion_horas != null ? `${t.duracion_horas} h` : "")}
                    {!t.confirmado && <span className="ml-1 text-[#B25A1E] font-medium">Pendiente</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(articulosF.length > 0 || f.estado === "abierta") && (
          <div className="mt-3 pt-3 border-t border-[#EFEBE0]">
            <p className="text-[10px] uppercase tracking-wide text-[#8A8578] mb-1.5">Artículos externos (no-stock)</p>
            {articulosF.length === 0 && <p className="text-xs text-[#8A8578] mb-2">Sin artículos externos cargados.</p>}
            <ul className="space-y-1 mb-2">
              {articulosF.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 text-[#4A463D] min-w-0 truncate">
                    <Receipt size={13} className="shrink-0 text-[#8A8578]" />
                    <span className="truncate">
                      {a.descripcion} <span className="text-[#8A8578]">× {a.cantidad}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-mono">{pesos(Number(a.cantidad) * Number(a.valor_unitario))}</span>
                    <button onClick={() => quitarArticulo(a.id)} className="text-[#C7522A] hover:text-red p-0.5" title="Quitar artículo externo">
                      <Trash2 size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {f.estado === "abierta" && (
              <form onSubmit={(e) => agregarArticulo(f.id, e)} className="flex items-end gap-2">
                <label className="block flex-1 min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Descripción</span>
                  <input className={inputCls} value={nuevoArticulo.descripcion} onChange={(e) => setNuevoArticulo({ ...nuevoArticulo, descripcion: e.target.value })} placeholder="Ej. Plegado tercerizado" />
                </label>
                <label className="block w-16 shrink-0">
                  <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Cant.</span>
                  <input type="number" step="0.01" min="0" className={inputCls} value={nuevoArticulo.cantidad} onChange={(e) => setNuevoArticulo({ ...nuevoArticulo, cantidad: e.target.value })} placeholder="1" />
                </label>
                <label className="block w-28 shrink-0">
                  <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Valor ($)</span>
                  <input type="number" step="0.01" min="0" className={inputCls + " text-right font-mono"} value={nuevoArticulo.valor_unitario} onChange={(e) => setNuevoArticulo({ ...nuevoArticulo, valor_unitario: e.target.value })} placeholder="0" />
                </label>
                <button type="submit" disabled={subiendo} className="inline-flex items-center gap-1.5 bg-white border border-line text-ink px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] disabled:opacity-60 shrink-0">
                  <Plus size={14} /> {subiendo ? "..." : "Agregar"}
                </button>
              </form>
            )}
          </div>
        )}

        {f.estado === "abierta" && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-[#8A8578] mt-2">
              <CalendarClock size={13} /> Hora hombre: <span className="font-medium text-[#4A463D]">{formatearHorasHombre(f.fecha_apertura, null)}</span>
              <span className="text-[#B0AA9A]">({HORAS_POR_DIA} h/día)</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[#EFEBE0]">
              <p className="text-[10px] uppercase tracking-wide text-[#8A8578] mb-1.5">Estimado de insumos a usar</p>
              {estimadosF.length === 0 && <p className="text-xs text-[#8A8578] mb-2">Todavía no cargaste el estimado.</p>}
              <ul className="space-y-1.5 mb-2">
                {estimadosF.map((est) => {
                  const d = usadoPorId[est.id];
                  return (
                    <li key={est.id} className="flex items-center gap-2 text-sm">
                      <span className="flex items-center gap-1.5 text-[#4A463D] min-w-0 flex-1 truncate">
                        <ClipboardList size={13} className="shrink-0 text-[#8A8578]" />
                        <span className="truncate">{est.nombre}</span>
                      </span>
                      <span className="text-xs font-mono text-[#6B6558] whitespace-nowrap" title={`Usado ${d.usado} de ${d.estQty} ${est.unidad}`}>
                        usado {d.usado}/{d.estQty} ({d.pct}%)
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={est.cantidad}
                        onBlur={(e) => Number(e.target.value) !== Number(est.cantidad) && cambiarEstimado(est.id, e.target.value)}
                        className="w-20 text-center px-2 py-1 bg-white border border-line rounded-sm text-sm"
                      />
                      <button onClick={() => quitarEstimado(est.id)} className="text-[#C7522A] hover:text-red p-0.5 shrink-0" title="Quitar del estimado">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <FormAgregarEstimado fabricacionId={f.id} insumos={insumos} subiendo={subiendo} onAgregar={agregarEstimado} />
            </div>
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
            <div className="text-xs text-[#8A8578] mt-3 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <CalendarClock size={13} /> Tiempo: <span className="font-medium text-[#4A463D]">{formatearHorasHombre(f.fecha_apertura, f.fecha_cierre)}</span>
                <span className="text-[#B0AA9A]">(hora hombre · {HORAS_POR_DIA} h/día)</span>
              </div>
              <div className="flex items-center gap-1.5 pl-[22px]">
                Transcurrido {formatearTiempo(f.fecha_apertura, f.fecha_cierre)} · Cerrada el {new Date(f.fecha_cierre).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#EFEBE0]">
              <button
                onClick={() => exportarPDF(f)}
                disabled={subiendo}
                className="inline-flex items-center justify-center gap-1.5 bg-ink text-paper px-2 py-2 rounded-sm text-xs font-medium hover:bg-[#333731] disabled:opacity-60"
              >
                <Download size={14} /> {subiendo ? "..." : "PDF"}
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import {
  Wallet,
  Plus,
  X,
  Search,
  Download,
  FileText,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
  Loader2,
} from "lucide-react";

const BUCKET = "facturas-pagos";
const MEDIOS = ["Transferencia", "Cheque", "Efectivo", "Tarjeta", "Otro"];
const MAX_IA_BYTES = 4 * 1024 * 1024;

const ESTADOS = {
  pendiente: { label: "Pendiente", bg: "#FBEFE6", color: "#B25A1E" },
  parcial: { label: "Parcial", bg: "#EAF0F5", color: "#2E6F9E" },
  pagada: { label: "Pagada", bg: "#EAF0E4", color: "#3D5A2E" },
  vencida: { label: "Vencida", bg: "#F7E4E0", color: "#A43A24" },
};

const inputCls =
  "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function fechaHoy() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function money(valor, moneda = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda || "ARS",
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0);
}

function fechaCorta(fecha) {
  if (!fecha) return "—";
  const [y, m, d] = String(fecha).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function nombreUsuario(email) {
  return (email || "").replace("@simonetti.local", "") || "—";
}

function estadoDe(factura, pagado) {
  const saldo = Number(factura.importe) - pagado;
  if (saldo <= 0.005) return "pagada";
  if (pagado > 0.005) return "parcial";
  if (factura.vencimiento && String(factura.vencimiento).slice(0, 10) < fechaHoy()) return "vencida";
  return "pendiente";
}

function nombreArchivoSeguro(nombre) {
  return String(nombre || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-120);
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

function BadgeEstado({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.pendiente;
  return (
    <span
      className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm whitespace-nowrap"
      style={{ backgroundColor: e.bg, color: e.color }}
    >
      {e.label}
    </span>
  );
}

function TarjetaResumen({ label, valor, detalle, color }) {
  return (
    <div className="bg-white border border-line rounded-sm p-4">
      <p className="text-[10px] uppercase tracking-wide text-[#8A8578]">{label}</p>
      <p className="font-display text-xl font-semibold mt-1" style={{ color: color || "#1C1F1C" }}>
        {valor}
      </p>
      {detalle && <p className="text-xs text-[#8A8578] mt-0.5">{detalle}</p>}
    </div>
  );
}

function IaEstado({ disponible, leyendo, mensaje, error }) {
  if (disponible === false) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-[#8A8578] mt-2">
        <Sparkles size={13} className="shrink-0 mt-0.5" />
        Lectura automática no configurada. Podés completar los datos a mano.
      </p>
    );
  }
  if (!leyendo && !mensaje) return null;
  const color = error ? "#A43A24" : leyendo ? "#2E6F9E" : "#3D5A2E";
  return (
    <div
      className="flex items-start gap-2 text-xs rounded-sm px-3 py-2 mt-2"
      style={{
        backgroundColor: error ? "#F7E4E0" : leyendo ? "#EAF0F5" : "#EAF0E4",
        color,
      }}
    >
      {leyendo ? (
        <Loader2 size={14} className="shrink-0 mt-0.5 animate-spin" />
      ) : error ? (
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      ) : (
        <Sparkles size={14} className="shrink-0 mt-0.5" />
      )}
      <span>{mensaje}</span>
    </div>
  );
}

const emptyFactura = () => ({
  proveedor: "",
  numero: "",
  fecha: fechaHoy(),
  vencimiento: "",
  importe: "",
  moneda: "ARS",
  categoria: "",
  observaciones: "",
});

export default function PagosPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const puedeAcceder = rol === "admin" || rol === "subadmin" || rol === "compras";

  const [facturas, setFacturas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [abriendoPath, setAbriendoPath] = useState(null);

  const [iaDisponible, setIaDisponible] = useState(null);
  const [iaLeyendo, setIaLeyendo] = useState(false);
  const [iaMensaje, setIaMensaje] = useState(null);
  const [iaError, setIaError] = useState(false);
  const iaReqRef = useRef(0);

  const [query, setQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todas");
  const [mesFilter, setMesFilter] = useState("");

  const [showFactura, setShowFactura] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyFactura);
  const [archivoFactura, setArchivoFactura] = useState(null);
  const [guardandoFactura, setGuardandoFactura] = useState(false);

  const [showPago, setShowPago] = useState(false);
  const [pagoFacturaId, setPagoFacturaId] = useState(null);
  const [pagoForm, setPagoForm] = useState({
    fecha: fechaHoy(),
    importe: "",
    medio_pago: "Transferencia",
    referencia: "",
    observaciones: "",
  });
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [guardandoPago, setGuardandoPago] = useState(false);

  const [detalleId, setDetalleId] = useState(null);
  const [facturaAEliminar, setFacturaAEliminar] = useState(null);
  const [pagoAEliminar, setPagoAEliminar] = useState(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    const [{ data: fs, error: errF }, { data: ps, error: errP }] = await Promise.all([
      supabase.from("facturas_proveedor").select("*").order("fecha", { ascending: false }),
      supabase.from("pagos_factura").select("*").order("fecha", { ascending: false }),
    ]);

    if (errF || errP) {
      const msg = errF?.message || errP?.message || "No se pudieron cargar las facturas.";
      const faltaTabla =
        msg.toLowerCase().includes("does not exist") ||
        msg.toLowerCase().includes("no existe") ||
        msg.toLowerCase().includes("schema cache");
      setError(
        faltaTabla
          ? `${msg} — Ejecutá la migración supabase/migrations/0041_pagos_proveedores.sql en Supabase.`
          : msg
      );
    } else {
      setFacturas(fs || []);
      setPagos(ps || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && !puedeAcceder) router.replace("/ingreso-egreso");
  }, [rol, puedeAcceder, router]);

  useEffect(() => {
    let activo = true;
    fetch("/api/ai/extraer")
      .then((r) => r.json())
      .then((data) => {
        if (activo) setIaDisponible(Boolean(data?.disponible));
      })
      .catch(() => {
        if (activo) setIaDisponible(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  function mostrarMensaje(texto) {
    setConfirmacion(texto);
    setTimeout(() => setConfirmacion(null), 3500);
  }

  const pagosPorFactura = useMemo(() => {
    const mapa = {};
    pagos.forEach((p) => {
      (mapa[p.factura_id] = mapa[p.factura_id] || []).push(p);
    });
    return mapa;
  }, [pagos]);

  const filas = useMemo(
    () =>
      facturas.map((f) => {
        const pagosFactura = pagosPorFactura[f.id] || [];
        const pagado = Math.round(pagosFactura.reduce((s, p) => s + Number(p.importe), 0) * 100) / 100;
        const saldo = Math.round((Number(f.importe) - pagado) * 100) / 100;
        return { ...f, pagos: pagosFactura, pagado, saldo, estado: estadoDe(f, pagado) };
      }),
    [facturas, pagosPorFactura]
  );

  const filtradas = useMemo(
    () =>
      filas.filter((f) => {
        if (query) {
          const q = query.toLowerCase();
          const texto = [f.proveedor, f.numero, f.categoria, f.observaciones]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!texto.includes(q)) return false;
        }
        if (estadoFilter !== "todas" && f.estado !== estadoFilter) return false;
        if (mesFilter && String(f.fecha || "").slice(0, 7) !== mesFilter) return false;
        return true;
      }),
    [filas, query, estadoFilter, mesFilter]
  );

  const resumen = useMemo(() => {
    let facturado = 0;
    let pagado = 0;
    let vencidas = 0;
    filtradas.forEach((f) => {
      facturado += Number(f.importe);
      pagado += f.pagado;
      if (f.estado === "vencida") vencidas++;
    });
    return { facturado, pagado, saldo: facturado - pagado, vencidas };
  }, [filtradas]);

  const facturaEditando = useMemo(
    () => (editingId ? filas.find((f) => f.id === editingId) : null),
    [editingId, filas]
  );

  const pagoFactura = useMemo(
    () => (pagoFacturaId ? filas.find((f) => f.id === pagoFacturaId) : null),
    [pagoFacturaId, filas]
  );

  const facturasConSaldo = useMemo(
    () => filas.filter((f) => f.saldo > 0.005),
    [filas]
  );

  const detalle = useMemo(
    () => (detalleId ? filas.find((f) => f.id === detalleId) : null),
    [detalleId, filas]
  );

  const categoriasExistentes = useMemo(
    () => [...new Set(facturas.map((f) => f.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [facturas]
  );

  function limpiarIA() {
    iaReqRef.current += 1;
    setIaLeyendo(false);
    setIaMensaje(null);
    setIaError(false);
  }

  async function extraerDatosIA(file, tipo) {
    const {
      data: { session: sesionActual },
    } = await supabase.auth.getSession();
    if (!sesionActual?.access_token) throw new Error("Sesión no válida.");

    const fd = new FormData();
    fd.append("archivo", file);
    fd.append("tipo", tipo);

    const res = await fetch("/api/ai/extraer", {
      method: "POST",
      headers: { Authorization: `Bearer ${sesionActual.access_token}` },
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "No se pudo leer el archivo con IA.");
    return json.datos || {};
  }

  async function leerFactura(file) {
    const req = ++iaReqRef.current;
    setIaLeyendo(true);
    setIaError(false);
    setIaMensaje("Leyendo la factura con IA...");
    try {
      const datos = await extraerDatosIA(file, "factura");
      if (iaReqRef.current !== req) return;
      setForm((prev) => ({
        ...prev,
        proveedor: datos.proveedor || prev.proveedor,
        numero: datos.numero || prev.numero,
        fecha: datos.fecha || prev.fecha,
        vencimiento: datos.vencimiento || prev.vencimiento,
        importe: datos.importe != null ? String(datos.importe) : prev.importe,
        moneda: datos.moneda || prev.moneda,
        categoria: datos.categoria || prev.categoria,
        observaciones: datos.observaciones || prev.observaciones,
      }));
      const detectados = [
        datos.proveedor,
        datos.numero,
        datos.importe != null ? money(datos.importe, datos.moneda || "ARS") : null,
      ].filter(Boolean);
      setIaMensaje(
        detectados.length
          ? `Datos detectados: ${detectados.join(" · ")}. Revisalos antes de guardar.`
          : "No se detectaron datos claros. Completalos manualmente."
      );
      setIaError(false);
    } catch (err) {
      if (iaReqRef.current !== req) return;
      setIaError(true);
      setIaMensaje("No se pudo leer automáticamente: " + err.message);
    } finally {
      if (iaReqRef.current === req) setIaLeyendo(false);
    }
  }

  async function leerComprobante(file) {
    const req = ++iaReqRef.current;
    setIaLeyendo(true);
    setIaError(false);
    setIaMensaje("Leyendo el comprobante con IA...");
    try {
      const datos = await extraerDatosIA(file, "pago");
      if (iaReqRef.current !== req) return;
      setPagoForm((prev) => ({
        ...prev,
        fecha: datos.fecha || prev.fecha,
        importe: datos.importe != null ? String(datos.importe) : prev.importe,
        medio_pago: MEDIOS.includes(datos.medio_pago) ? datos.medio_pago : prev.medio_pago,
        referencia: datos.referencia || prev.referencia,
        observaciones: datos.observaciones || prev.observaciones,
      }));
      setIaMensaje(
        datos.importe != null
          ? `Pago detectado: ${money(datos.importe, pagoFactura?.moneda || "ARS")}. Revisalo antes de guardar.`
          : "No se detectó el importe. Completalo manualmente."
      );
      setIaError(false);
    } catch (err) {
      if (iaReqRef.current !== req) return;
      setIaError(true);
      setIaMensaje("No se pudo leer automáticamente: " + err.message);
    } finally {
      if (iaReqRef.current === req) setIaLeyendo(false);
    }
  }

  function onArchivoFactura(e) {
    const file = e.target.files?.[0] || null;
    setArchivoFactura(file);
    limpiarIA();
    if (!file) return;
    if (file.size > MAX_IA_BYTES) {
      setIaError(true);
      setIaMensaje("El archivo supera los 4 MB: se puede guardar, pero la lectura automática está limitada. Completá los datos a mano.");
      return;
    }
    if (iaDisponible !== false) leerFactura(file);
  }

  function onComprobante(e) {
    const file = e.target.files?.[0] || null;
    setComprobanteFile(file);
    limpiarIA();
    if (!file) return;
    if (file.size > MAX_IA_BYTES) {
      setIaError(true);
      setIaMensaje("El archivo supera los 4 MB: se puede guardar, pero la lectura automática está limitada. Completá los datos a mano.");
      return;
    }
    if (iaDisponible !== false) leerComprobante(file);
  }

  async function subirArchivo(file, carpeta) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("El archivo supera los 10 MB. Comprimilo o subí una versión más liviana.");
    }
    const path = `${carpeta}/${fechaHoy()}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${nombreArchivoSeguro(file.name)}`;
    const { error: errUpload } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (errUpload) throw errUpload;
    return { path, nombre: file.name };
  }

  async function abrirArchivo(path) {
    if (!path) return;
    setAbriendoPath(path);
    setError(null);
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    setAbriendoPath(null);
    if (err) {
      setError("No se pudo abrir el archivo: " + err.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function abrirNueva() {
    setEditingId(null);
    setForm(emptyFactura());
    setArchivoFactura(null);
    limpiarIA();
    setError(null);
    setShowFactura(true);
  }

  function abrirEditar(f) {
    setEditingId(f.id);
    setForm({
      proveedor: f.proveedor || "",
      numero: f.numero || "",
      fecha: String(f.fecha || fechaHoy()).slice(0, 10),
      vencimiento: f.vencimiento ? String(f.vencimiento).slice(0, 10) : "",
      importe: String(f.importe ?? ""),
      moneda: f.moneda || "ARS",
      categoria: f.categoria || "",
      observaciones: f.observaciones || "",
    });
    setArchivoFactura(null);
    limpiarIA();
    setError(null);
    setShowFactura(true);
  }

  function abrirDetalle(f) {
    setError(null);
    setDetalleId(f.id);
  }

  async function guardarFactura(e) {
    e.preventDefault();
    if (guardandoFactura) return;
    setError(null);

    if (!form.proveedor.trim()) {
      setError("Escribí el proveedor.");
      return;
    }
    if (!form.numero.trim()) {
      setError("Escribí el número de factura.");
      return;
    }
    const importe = Number(form.importe);
    if (!importe || importe <= 0) {
      setError("El importe tiene que ser mayor a 0.");
      return;
    }
    if (!editingId && !archivoFactura) {
      setError("Adjuntá el archivo de la factura.");
      return;
    }

    setGuardandoFactura(true);
    try {
      let archivo = null;
      if (archivoFactura) archivo = await subirArchivo(archivoFactura, "facturas");

      const payload = {
        proveedor: form.proveedor.trim(),
        numero: form.numero.trim(),
        fecha: form.fecha || fechaHoy(),
        vencimiento: form.vencimiento || null,
        importe,
        moneda: form.moneda,
        categoria: form.categoria.trim() || null,
        observaciones: form.observaciones.trim() || null,
      };
      if (archivo) {
        payload.archivo_path = archivo.path;
        payload.archivo_nombre = archivo.nombre;
      }

      let err;
      if (editingId) {
        ({ error: err } = await supabase.from("facturas_proveedor").update(payload).eq("id", editingId));
      } else {
        ({ error: err } = await supabase.from("facturas_proveedor").insert({
          ...payload,
          usuario_email: session?.user?.email || null,
        }));
      }
      if (err) throw err;

      setShowFactura(false);
      mostrarMensaje(editingId ? "Factura actualizada" : "Factura cargada");
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoFactura(false);
    }
  }

  function abrirPago(f) {
    setPagoFacturaId(f.id);
    setPagoForm({
      fecha: fechaHoy(),
      importe: f.saldo > 0 ? Number(f.saldo).toFixed(2) : "",
      medio_pago: "Transferencia",
      referencia: "",
      observaciones: "",
    });
    setComprobanteFile(null);
    limpiarIA();
    setError(null);
    setShowPago(true);
  }

  function seleccionarFacturaPago(f) {
    setPagoFacturaId(f.id);
    setPagoForm((prev) => ({
      ...prev,
      importe: prev.importe || (f.saldo > 0 ? Number(f.saldo).toFixed(2) : ""),
    }));
    setError(null);
  }

  function abrirNuevoPago() {
    setPagoFacturaId(null);
    setPagoForm({
      fecha: fechaHoy(),
      importe: "",
      medio_pago: "Transferencia",
      referencia: "",
      observaciones: "",
    });
    setComprobanteFile(null);
    limpiarIA();
    setError(null);
    setShowPago(true);
  }

  async function guardarPago(e) {
    e.preventDefault();
    if (guardandoPago) return;
    if (!pagoFactura) {
      setError("Elegí la factura a pagar.");
      return;
    }
    setError(null);

    const importe = Number(pagoForm.importe);
    if (!importe || importe <= 0) {
      setError("El importe del pago tiene que ser mayor a 0.");
      return;
    }
    if (importe > pagoFactura.saldo + 0.005) {
      setError(`El pago supera el saldo pendiente (${money(pagoFactura.saldo, pagoFactura.moneda)}).`);
      return;
    }
    if (!comprobanteFile) {
      setError("Adjuntá el comprobante del pago.");
      return;
    }

    setGuardandoPago(true);
    try {
      const archivo = await subirArchivo(comprobanteFile, "comprobantes");
      const { error: err } = await supabase.from("pagos_factura").insert({
        factura_id: pagoFactura.id,
        fecha: pagoForm.fecha || fechaHoy(),
        importe,
        medio_pago: pagoForm.medio_pago,
        referencia: pagoForm.referencia.trim() || null,
        observaciones: pagoForm.observaciones.trim() || null,
        comprobante_path: archivo.path,
        comprobante_nombre: archivo.nombre,
        usuario_email: session?.user?.email || null,
      });
      if (err) throw err;

      setShowPago(false);
      mostrarMensaje("Pago imputado y comprobante guardado");
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoPago(false);
    }
  }

  async function eliminarPago() {
    if (!pagoAEliminar) return;
    setError(null);
    const { error: err } = await supabase.from("pagos_factura").delete().eq("id", pagoAEliminar.id);
    if (err) {
      setError(err.message);
      setPagoAEliminar(null);
      return;
    }
    if (pagoAEliminar.comprobante_path) {
      await supabase.storage.from(BUCKET).remove([pagoAEliminar.comprobante_path]);
    }
    setPagoAEliminar(null);
    mostrarMensaje("Pago eliminado; la factura vuelve a mostrar saldo");
    cargar();
  }

  async function eliminarFactura() {
    if (!facturaAEliminar) return;
    setError(null);
    if ((pagosPorFactura[facturaAEliminar.id] || []).length > 0) {
      setError("No se puede eliminar una factura con pagos. Eliminá primero los pagos.");
      setFacturaAEliminar(null);
      return;
    }
    const { error: err } = await supabase.from("facturas_proveedor").delete().eq("id", facturaAEliminar.id);
    if (err) {
      setError(err.message);
      setFacturaAEliminar(null);
      return;
    }
    if (facturaAEliminar.archivo_path) {
      await supabase.storage.from(BUCKET).remove([facturaAEliminar.archivo_path]);
    }
    setFacturaAEliminar(null);
    mostrarMensaje("Factura eliminada");
    cargar();
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filasFacturas = filtradas.map((f) => ({
      Proveedor: f.proveedor,
      "N° factura": f.numero,
      Fecha: fechaCorta(f.fecha),
      Vencimiento: fechaCorta(f.vencimiento),
      Moneda: f.moneda,
      Importe: Number(f.importe),
      Pagado: f.pagado,
      Saldo: f.saldo,
      Estado: ESTADOS[f.estado]?.label || f.estado,
      Categoría: f.categoria || "",
      Observaciones: f.observaciones || "",
      Usuario: f.usuario_email || "",
    }));

    const filasPagos = filtradas.flatMap((f) =>
      f.pagos.map((p) => ({
        Proveedor: f.proveedor,
        "N° factura": f.numero,
        "Fecha pago": fechaCorta(p.fecha),
        Importe: Number(p.importe),
        "Medio de pago": p.medio_pago,
        Referencia: p.referencia || "",
        "Comprobante": p.comprobante_nombre || "",
        Observaciones: p.observaciones || "",
        Usuario: p.usuario_email || "",
      }))
    );

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filasFacturas), "Facturas");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filasPagos), "Pagos");
    XLSX.writeFile(libro, `pagos-proveedores-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rol && !puedeAcceder) return null;

  const hayFiltros = query || estadoFilter !== "todas" || mesFilter;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet size={20} color="#F4791E" />
          <div>
            <h1 className="font-display text-3xl font-semibold">Facturas y pagos</h1>
            <p className="text-sm text-[#6B6558] mt-0.5">Facturas de proveedores y pagos imputados con comprobante</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportarExcel}
            className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors"
          >
            <Download size={16} /> Exportar a Excel
          </button>
          <button
            onClick={abrirNuevoPago}
            className="flex items-center gap-1.5 bg-[#4B7355] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#3D5A2E] transition-colors"
          >
            <Receipt size={16} /> Cargar pago
          </button>
          <button
            onClick={abrirNueva}
            className="flex items-center gap-1.5 bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] transition-colors"
          >
            <Plus size={16} /> Nueva factura
          </button>
        </div>
      </div>

      {confirmacion && (
        <div className="flex items-center gap-2 bg-[#EAF0E4] border border-[#B9CBA9] text-[#3D5A2E] text-sm px-4 py-3 rounded-sm mb-5 max-w-2xl">
          <CheckCircle2 size={16} /> {confirmacion}
        </div>
      )}
      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <TarjetaResumen label="Facturado" valor={money(resumen.facturado)} detalle={`${filtradas.length} factura(s)`} />
        <TarjetaResumen label="Pagado" valor={money(resumen.pagado)} detalle="Imputado con comprobante" color="#3D5A2E" />
        <TarjetaResumen label="Saldo pendiente" valor={money(resumen.saldo)} detalle="Por pagar" color="#B25A1E" />
        <TarjetaResumen label="Vencidas" valor={String(resumen.vencidas)} detalle="Con saldo y fecha pasada" color="#A43A24" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-line rounded-sm px-3 py-2 w-full sm:max-w-xs">
          <Search size={15} color="#6B6558" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar proveedor, N°, categoría..."
            className="flex-1 text-sm outline-none"
          />
        </div>
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="bg-white border border-line rounded-sm px-3 py-2 text-sm text-ink"
        >
          <option value="todas">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="parcial">Parciales</option>
          <option value="pagada">Pagadas</option>
          <option value="vencida">Vencidas</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[#6B6558]">
          Mes
          <input
            type="month"
            value={mesFilter}
            onChange={(e) => setMesFilter(e.target.value)}
            className="bg-white border border-line rounded-sm px-2 py-2 text-sm text-ink"
          />
        </label>
        {hayFiltros && (
          <button
            onClick={() => {
              setQuery("");
              setEstadoFilter("todas");
              setMesFilter("");
            }}
            className="inline-flex items-center gap-1 text-sm text-[#3B5166] hover:underline"
          >
            <X size={14} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Móvil: tarjetas */}
      <div className="sm:hidden space-y-3">
        {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
        {!loading &&
          filtradas.map((f) => (
            <div key={f.id} className="bg-white border border-line rounded-sm p-4">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <BadgeEstado estado={f.estado} />
                <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#F2EEE3] text-[#6B6558]">{f.moneda}</span>
                <span className="font-mono text-xs text-[#6B6558] ml-auto">{fechaCorta(f.fecha)}</span>
              </div>
              <div className="font-medium leading-snug">{f.proveedor}</div>
              <p className="text-xs text-[#6B6558] mt-0.5">Factura {f.numero}{f.vencimiento ? ` · vence ${fechaCorta(f.vencimiento)}` : ""}</p>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                  <span className="block text-[10px] uppercase text-[#8A8578]">Importe</span>
                  <span className="font-mono">{money(f.importe, f.moneda)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#8A8578]">Pagado</span>
                  <span className="font-mono text-[#3D5A2E]">{money(f.pagado, f.moneda)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#8A8578]">Saldo</span>
                  <span className="font-mono text-[#B25A1E]">{money(f.saldo, f.moneda)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {f.saldo > 0.005 && (
                  <button onClick={() => abrirPago(f)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                    <Receipt size={15} /> Pagar
                  </button>
                )}
                <button onClick={() => abrirDetalle(f)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                  <Eye size={15} /> Ver
                </button>
                <button onClick={() => abrirEditar(f)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                  <Pencil size={15} /> Editar
                </button>
                <button onClick={() => setFacturaAEliminar(f)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-[#C7522A]">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        {!loading && filtradas.length === 0 && (
          <p className="text-center text-sm text-[#8A8578] py-8">{hayFiltros ? "No hay facturas que coincidan con los filtros" : "Aún no hay facturas cargadas"}</p>
        )}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[1050px]">
          <thead>
            <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">N° factura</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Vence</th>
              <th className="px-4 py-3 font-medium">Importe</th>
              <th className="px-4 py-3 font-medium">Pagado</th>
              <th className="px-4 py-3 font-medium">Saldo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
            {!loading && filtradas.map((f, idx) => (
              <tr key={f.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== filtradas.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{f.proveedor}</div>
                  {f.categoria && <div className="text-[11px] text-[#8A8578]">{f.categoria}</div>}
                </td>
                <td className="px-4 py-3 font-mono whitespace-nowrap">{f.numero}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap text-[#6B6558]">{fechaCorta(f.fecha)}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap text-[#6B6558]">{fechaCorta(f.vencimiento)}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap">{money(f.importe, f.moneda)}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap text-[#3D5A2E]">{money(f.pagado, f.moneda)}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap text-[#B25A1E]">{money(f.saldo, f.moneda)}</td>
                <td className="px-4 py-3"><BadgeEstado estado={f.estado} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    {f.saldo > 0.005 && (
                      <button onClick={() => abrirPago(f)} className="text-[#3D5A2E] hover:opacity-70" title="Imputar pago">
                        <Receipt size={15} />
                      </button>
                    )}
                    <button onClick={() => abrirDetalle(f)} className="text-[#4A4B4D] hover:opacity-70" title="Ver detalle y pagos">
                      <Eye size={15} />
                    </button>
                    <button onClick={() => abrirEditar(f)} className="text-[#4A4B4D] hover:opacity-70" title="Editar factura">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setFacturaAEliminar(f)} className="text-[#C7522A] hover:text-red" title="Eliminar factura">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtradas.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[#8A8578]">{hayFiltros ? "No hay facturas que coincidan con los filtros" : "Aún no hay facturas cargadas"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal alta/edición de factura */}
      {showFactura && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-xl rounded-sm border border-line shadow-2xl my-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-xl font-semibold">{editingId ? "Editar factura" : "Nueva factura"}</h3>
              <button onClick={() => setShowFactura(false)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <form onSubmit={guardarFactura} className="p-5">
              {error && <p className="text-sm text-red mb-3">Error: {error}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <Field label="Proveedor *">
                  <input className={inputCls} value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} placeholder="Ej. Ferretería El Tornillo" />
                </Field>
                <Field label="N° de factura *">
                  <input className={inputCls} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Ej. A-0001-00012345" />
                </Field>
                <Field label="Fecha de factura *">
                  <input type="date" className={inputCls} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                </Field>
                <Field label="Vencimiento">
                  <input type="date" className={inputCls} value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
                </Field>
                <Field label="Importe *">
                  <input
                    type="number"
                    step="0.01"
                    min={facturaEditando && facturaEditando.pagado > 0 ? facturaEditando.pagado : 0.01}
                    className={inputCls}
                    value={form.importe}
                    onChange={(e) => setForm({ ...form, importe: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Moneda">
                  <select className={inputCls} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </Field>
              </div>

              {facturaEditando && facturaEditando.pagado > 0 && (
                <p className="text-xs text-[#8A8578] mb-3">
                  Esta factura ya tiene pagos por {money(facturaEditando.pagado, facturaEditando.moneda)}. El importe no puede ser menor a ese valor.
                </p>
              )}

              <Field label="Categoría (opcional)">
                <input className={inputCls} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ej. Materiales, Herramientas, Servicios" list="categorias-facturas" />
                <datalist id="categorias-facturas">
                  {categoriasExistentes.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>

              <Field label="Observaciones (opcional)">
                <input className={inputCls} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Ej. Incluye flete" />
              </Field>

              <Field label={editingId ? "Archivo de factura (opcional si no lo cambiás)" : "Archivo de factura (PDF o imagen) *"}>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={onArchivoFactura}
                  className="block w-full text-sm text-[#4A463D] file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border file:border-line file:bg-[#F7F4EC] file:text-sm file:font-medium file:text-ink hover:file:bg-[#F2EEE3]"
                />
                {archivoFactura && <p className="text-xs text-[#6B6558] mt-1">Seleccionado: {archivoFactura.name}</p>}
                {editingId && facturaEditando?.archivo_path && !archivoFactura && (
                  <button
                    type="button"
                    onClick={() => abrirArchivo(facturaEditando.archivo_path)}
                    className="inline-flex items-center gap-1 text-xs text-[#2E6F9E] hover:underline mt-1"
                  >
                    <FileText size={13} /> {abriendoPath === facturaEditando.archivo_path ? "Abriendo..." : "Ver archivo actual"}
                  </button>
                )}
              </Field>
              <IaEstado disponible={iaDisponible} leyendo={iaLeyendo} mensaje={iaMensaje} error={iaError} />

              <button type="submit" disabled={guardandoFactura} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {guardandoFactura ? "Guardando..." : editingId ? "Guardar cambios" : "Cargar factura"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de pago */}
      {showPago && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-sm border border-line shadow-2xl my-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-xl font-semibold">Cargar pago</h3>
              <button onClick={() => setShowPago(false)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <form onSubmit={guardarPago} className="p-5">
              {error && <p className="text-sm text-red mb-3">Error: {error}</p>}

              <Field label="Factura a pagar *">
                <select
                  className={inputCls}
                  value={pagoFacturaId ?? ""}
                  onChange={(e) => {
                    const f = filas.find((x) => x.id === Number(e.target.value));
                    if (f) seleccionarFacturaPago(f);
                  }}
                >
                  <option value="">Elegí una factura con saldo pendiente</option>
                  {facturasConSaldo.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.proveedor} · {f.numero} · saldo {money(f.saldo, f.moneda)}
                    </option>
                  ))}
                </select>
              </Field>

              {!pagoFactura && (
                <p className="text-xs text-[#8A8578] mb-2">
                  {facturasConSaldo.length
                    ? "Elegí la factura y después cargá el importe y el comprobante."
                    : "No hay facturas con saldo pendiente. Cargá primero una factura."}
                </p>
              )}

              {pagoFactura && (
                <>
                  <div className="bg-[#F7F4EC] rounded-sm px-3 py-3 mb-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{pagoFactura.proveedor}</span>
                      <BadgeEstado estado={pagoFactura.estado} />
                    </div>
                    <div className="text-[#6B6558] mt-0.5">Factura {pagoFactura.numero}</div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase text-[#8A8578]">Importe</span>
                        <span className="font-mono">{money(pagoFactura.importe, pagoFactura.moneda)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-[#8A8578]">Pagado</span>
                        <span className="font-mono text-[#3D5A2E]">{money(pagoFactura.pagado, pagoFactura.moneda)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-[#8A8578]">Saldo</span>
                        <span className="font-mono text-[#B25A1E]">{money(pagoFactura.saldo, pagoFactura.moneda)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <Field label="Fecha de pago *">
                      <input type="date" className={inputCls} value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} />
                    </Field>
                    <Field label="Importe a imputar *">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={pagoFactura.saldo > 0 ? Number(pagoFactura.saldo).toFixed(2) : undefined}
                        className={inputCls}
                        value={pagoForm.importe}
                        onChange={(e) => setPagoForm({ ...pagoForm, importe: e.target.value })}
                      />
                    </Field>
                    <Field label="Medio de pago">
                      <select className={inputCls} value={pagoForm.medio_pago} onChange={(e) => setPagoForm({ ...pagoForm, medio_pago: e.target.value })}>
                        {MEDIOS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label="Referencia (opcional)">
                      <input className={inputCls} value={pagoForm.referencia} onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })} placeholder="Ej. N° transferencia / cheque" />
                    </Field>
                  </div>

                  <Field label="Observaciones (opcional)">
                    <input className={inputCls} value={pagoForm.observaciones} onChange={(e) => setPagoForm({ ...pagoForm, observaciones: e.target.value })} placeholder="Ej. Pago parcial acordado" />
                  </Field>

                  <Field label="Comprobante de pago (PDF o imagen) *">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={onComprobante}
                      className="block w-full text-sm text-[#4A463D] file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border file:border-line file:bg-[#F7F4EC] file:text-sm file:font-medium file:text-ink hover:file:bg-[#F2EEE3]"
                    />
                    {comprobanteFile && <p className="text-xs text-[#6B6558] mt-1">Seleccionado: {comprobanteFile.name}</p>}
                  </Field>
                  <IaEstado disponible={iaDisponible} leyendo={iaLeyendo} mensaje={iaMensaje} error={iaError} />

                  <button type="submit" disabled={guardandoPago} className="w-full mt-2 bg-[#4B7355] text-white py-2.5 rounded-sm text-sm font-medium hover:bg-[#3D5A2E] disabled:opacity-60">
                    {guardandoPago ? "Guardando..." : "Guardar pago y comprobante"}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-3xl rounded-sm border border-line shadow-2xl my-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold truncate">{detalle.proveedor}</h3>
                <p className="text-xs text-[#6B6558]">Factura {detalle.numero}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <BadgeEstado estado={detalle.estado} />
                <button onClick={() => setDetalleId(null)} aria-label="Cerrar"><X size={18} /></button>
              </div>
            </div>

            <div className="p-5">
              {error && <p className="text-sm text-red mb-3">Error: {error}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <span className="block text-[10px] uppercase text-[#8A8578]">Importe</span>
                  <span className="font-mono text-sm">{money(detalle.importe, detalle.moneda)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#8A8578]">Pagado</span>
                  <span className="font-mono text-sm text-[#3D5A2E]">{money(detalle.pagado, detalle.moneda)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#8A8578]">Saldo</span>
                  <span className="font-mono text-sm text-[#B25A1E]">{money(detalle.saldo, detalle.moneda)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#8A8578]">Vencimiento</span>
                  <span className="font-mono text-sm">{fechaCorta(detalle.vencimiento)}</span>
                </div>
              </div>

              <div className="text-xs text-[#6B6558] space-y-1 mb-4">
                <p>Fecha de factura: <span className="font-mono">{fechaCorta(detalle.fecha)}</span></p>
                {detalle.categoria && <p>Categoría: {detalle.categoria}</p>}
                {detalle.observaciones && <p>Observaciones: {detalle.observaciones}</p>}
                <p>Cargada por: {nombreUsuario(detalle.usuario_email)}</p>
                <button
                  type="button"
                  onClick={() => abrirArchivo(detalle.archivo_path)}
                  className="inline-flex items-center gap-1 text-[#2E6F9E] hover:underline pt-1"
                >
                  <FileText size={13} /> {abriendoPath === detalle.archivo_path ? "Abriendo..." : `Ver archivo de factura${detalle.archivo_nombre ? ` (${detalle.archivo_nombre})` : ""}`}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="font-display text-lg font-semibold">Pagos imputados</h4>
                {detalle.saldo > 0.005 && (
                  <button
                    onClick={() => {
                      const f = detalle;
                      setDetalleId(null);
                      abrirPago(f);
                    }}
                    className="inline-flex items-center gap-1.5 bg-ink text-paper px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#333731]"
                  >
                    <Receipt size={15} /> Imputar pago
                  </button>
                )}
              </div>

              {detalle.pagos.length === 0 && (
                <p className="text-sm text-[#8A8578] py-4">Todavía no hay pagos imputados a esta factura.</p>
              )}

              {detalle.pagos.length > 0 && (
                <div className="border border-line rounded-sm divide-y divide-[#EFEBE0]">
                  {detalle.pagos.map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm">{money(p.importe, detalle.moneda)}</span>
                          <span className="text-[10px] uppercase tracking-wide text-[#8A8578]">{p.medio_pago}</span>
                          <span className="font-mono text-xs text-[#6B6558]">{fechaCorta(p.fecha)}</span>
                        </div>
                        {p.referencia && <p className="text-xs text-[#6B6558] mt-0.5">Ref.: {p.referencia}</p>}
                        {p.observaciones && <p className="text-xs text-[#8A8578] mt-0.5">{p.observaciones}</p>}
                        <p className="text-[10px] text-[#8A8578] mt-0.5">Registrado por {nombreUsuario(p.usuario_email)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => abrirArchivo(p.comprobante_path)}
                          className="inline-flex items-center gap-1 text-xs text-[#2E6F9E] hover:underline"
                        >
                          <Eye size={13} /> {abriendoPath === p.comprobante_path ? "Abriendo..." : "Comprobante"}
                        </button>
                        <button onClick={() => setPagoAEliminar(p)} className="text-[#C7522A] hover:text-red" title="Eliminar pago">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación de factura */}
      {facturaAEliminar && (() => {
        const tienePagos = (pagosPorFactura[facturaAEliminar.id] || []).length > 0;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setFacturaAEliminar(null)}>
            <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display text-xl font-semibold mb-2">Eliminar factura</h3>
              {tienePagos ? (
                <>
                  <p className="text-sm text-[#4A463D] mb-4">
                    La factura <b>{facturaAEliminar.numero}</b> de <b>{facturaAEliminar.proveedor}</b> tiene pagos registrados.
                    <br />
                    <span className="text-xs text-[#8A8578]">Eliminá primero los pagos para poder borrar la factura.</span>
                  </p>
                  <div className="flex justify-end">
                    <button onClick={() => setFacturaAEliminar(null)} className="px-4 py-2 border border-line rounded-sm text-sm text-ink hover:bg-[#F2EEE3]">Cerrar</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#4A463D] mb-4">
                    ¿Eliminar la factura <b>{facturaAEliminar.numero}</b> de <b>{facturaAEliminar.proveedor}</b>? También se borra su archivo adjunto.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setFacturaAEliminar(null)} className="px-4 py-2 border border-line rounded-sm text-sm text-ink hover:bg-[#F2EEE3]">Cancelar</button>
                    <button onClick={eliminarFactura} className="px-4 py-2 bg-[#C7522A] text-white rounded-sm text-sm font-medium hover:bg-red">Eliminar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Confirmar eliminación de pago */}
      {pagoAEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setPagoAEliminar(null)}>
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold mb-2">Eliminar pago</h3>
            <p className="text-sm text-[#4A463D] mb-4">
              ¿Eliminar el pago de <b>{money(pagoAEliminar.importe, filas.find((f) => f.id === pagoAEliminar.factura_id)?.moneda)}</b> del {fechaCorta(pagoAEliminar.fecha)}?
              <br />
              <span className="text-xs text-[#8A8578]">La factura vuelve a mostrar el saldo pendiente. También se borra el comprobante.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPagoAEliminar(null)} className="px-4 py-2 border border-line rounded-sm text-sm text-ink hover:bg-[#F2EEE3]">Cancelar</button>
              <button onClick={eliminarPago} className="px-4 py-2 bg-[#C7522A] text-white rounded-sm text-sm font-medium hover:bg-red">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso cuando faltan datos por configurar */}
      {!loading && facturas.length === 0 && !error && (
        <div className="flex items-start gap-2 bg-[#F7F4EC] border border-line text-[#6B6558] text-xs px-4 py-3 rounded-sm mt-4 max-w-2xl">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Cargá la primera factura con su archivo. Después, desde <b>Pagar</b>, imputá el pago y adjuntá el comprobante.
            Cada factura puede tener varios pagos hasta cubrir el importe total.
          </span>
        </div>
      )}
    </>
  );
}

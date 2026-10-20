"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { AlertTriangle, Search, Plus, X, Pencil, Trash2, Download, Printer, CheckCircle2 } from "lucide-react";
import { FotoInsumo, nombreSeguro } from "../../../components/FotoInsumo";
import { DocPrint, DocGrid, DocNota } from "../../../components/DocPrint";

const ROPA_CATS = ["Pantalon", "Camisa", "Buzo"];
const CATS = ["Químicos", "Empaques", "Metales", "Textiles", "Seguridad", "Insumos para Fabricación", ...ROPA_CATS];
const TALLES = {
  Pantalon: ["40", "42", "44", "46", "48", "50", "52", "54", "56"],
  Camisa: ["S", "M", "L", "XL", "XXL", "3XL"],
  Buzo: ["S", "M", "L", "XL", "XXL", "3XL"],
};
const UNITS = ["kg", "L", "unid", "m"];
const emptyForm = { nombre: "", categoria: "", unidad: UNITS[0], stock: "", minimo: "", talle: "" };

function StockGauge({ stock, minimo }) {
  const ratio = Math.min(stock / (minimo * 2 || 1), 1);
  const low = stock < minimo;
  const color = low ? "#C7522A" : ratio < 0.6 ? "#F4791E" : "#4B7355";
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
      </div>
      {low && <AlertTriangle size={13} color="#C7522A" />}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function Stock2Page() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const soloLectura = false;
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [query, setQuery] = useState("");
  const [nombreFilter, setNombreFilter] = useState("todos");
  const [catFilter, setCatFilter] = useState("Todas");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [enviando, setEnviando] = useState(false);
  const [archiving, setArchiving] = useState(null);
  const [verArchivados, setVerArchivados] = useState(false);
  const [verRopa, setVerRopa] = useState("todas");
  const [entregas, setEntregas] = useState([]);
  const [entregasPorPersona, setEntregasPorPersona] = useState({});
  const [showEntrega, setShowEntrega] = useState(false);
  const [entregaForm, setEntregaForm] = useState({ destinatario: "", cantidad: "1", observaciones: "" });
  const [entregaInsumoId, setEntregaInsumoId] = useState(null);
  const [entregaGuardando, setEntregaGuardando] = useState(false);
  const [confirmarEntrega, setConfirmarEntrega] = useState(null);
  const [tarjetaEntrega, setTarjetaEntrega] = useState(null);
  const [filtroEntregas, setFiltroEntregas] = useState("");

  async function subirImagen(insumoId, file, nombre) {
    setError(null);
    const nombreBase = nombreSeguro(nombre);
    const path = `${insumoId}-${Date.now()}-${nombreBase}.jpg`;
    const { error: uploadError } = await supabase.storage.from("imagenes-insumos").upload(path, file, { contentType: "image/jpeg" });
    if (uploadError) {
      setError("Error al subir la foto: " + uploadError.message);
      return;
    }
    const { data: pub } = supabase.storage.from("imagenes-insumos").getPublicUrl(path);
    const { error: errUpd } = await supabase
      .from("insumos")
      .update({ imagen_url: pub.publicUrl, imagen_actualizado: new Date().toISOString() })
      .eq("id", insumoId);
    if (errUpd) {
      setError(errUpd.message);
      return;
    }
    loadInsumos();
  }

  async function quitarImagen(insumoId) {
    setError(null);
    const { error } = await supabase.from("insumos").update({ imagen_url: null }).eq("id", insumoId);
    if (error) {
      setError(error.message);
      return;
    }
    loadInsumos();
  }

  async function loadInsumos() {
    setLoading(true);
    const { data, error } = await supabase.from("insumos").select("*").eq("deposito", "Pañol").order("nombre");
    if (error) setError(error.message);
    else setInsumos(data);
    setLoading(false);
  }

  async function cargarEntregas() {
    const { data, error } = await supabase.from("ropa_entregas").select("*").order("fecha", { ascending: false });
    if (error) setError(error.message);
    else {
      setEntregas(data || []);
      const map = {};
      (data || []).forEach((r) => {
        const key = r.destinatario.toLowerCase();
        map[key] = map[key] || [];
        map[key].push(r);
      });
      setEntregasPorPersona(map);
    }
  }

  useEffect(() => {
    loadInsumos();
    cargarEntregas();
  }, []);

  useEffect(() => {
    if (rol && rol !== "admin" && rol !== "subadmin") router.replace("/ingreso-egreso");
  }, [rol, router]);

  const categorias = useMemo(() => ["Todas", ...new Set(insumos.map((i) => i.categoria).filter(Boolean))], [insumos]);
  const nombres = useMemo(() => [...new Set(insumos.map((i) => i.nombre).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [insumos]);

  const filtered = useMemo(
    () =>
      insumos
        .filter((i) => (verArchivados ? i.activo === false : i.activo !== false))
        .filter((i) => i.nombre.toLowerCase().includes(query.toLowerCase()) || (i.categoria || "").toLowerCase().includes(query.toLowerCase()) || (i.talle || "").toLowerCase().includes(query.toLowerCase()))
        .filter((i) => catFilter === "Todas" || i.categoria === catFilter)
        .filter((i) => nombreFilter === "todos" || i.nombre === nombreFilter)
        .filter((i) => (verRopa === "todas" ? true : verRopa === "ropa" ? i.es_ropa : !i.es_ropa)),
    [insumos, query, catFilter, verArchivados, nombreFilter, verRopa]
  );
  const lowCount = insumos.filter((i) => i.activo !== false && i.stock < i.minimo).length;

  const entregasFiltradas = useMemo(() => {
    if (!filtroEntregas) return entregas;
    const q = filtroEntregas.toLowerCase();
    return entregas.filter((r) => (r.destinatario || "").toLowerCase().includes(q));
  }, [entregas, filtroEntregas]);

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = filtered.map((i) => ({
      Insumo: i.nombre,
      Categoría: i.categoria,
      Talle: i.talle || "",
      Unidad: i.unidad,
      Stock: i.stock,
      "Stock mínimo": i.minimo,
      Estado: i.activo === false ? "Archivado" : "Activo",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Stock Pañol");
    XLSX.writeFile(libro, `stock-panol-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function openNuevo() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditar(i) {
    setEditingId(i.id);
    setForm({
      nombre: i.nombre,
      categoria: i.categoria || "",
      unidad: i.unidad,
      stock: String(i.stock),
      minimo: String(i.minimo),
      talle: i.talle || "",
    });
    setShowForm(true);
  }

  function esRopaCategoria(cat) {
    return ROPA_CATS.includes(cat);
  }

  function tallesDe(cat) {
    return TALLES[cat] || [];
  }

  function abrirEntrega(i) {
    setEntregaInsumoId(i.id);
    setEntregaForm({ destinatario: "", cantidad: "1", observaciones: "" });
    setError(null);
    setShowEntrega(true);
  }

  async function registrarEntrega(e) {
    e.preventDefault();
    if (entregaGuardando) return;
    setError(null);
    const ins = insumos.find((i) => i.id === entregaInsumoId);
    if (!ins) return;
    const cant = Number(entregaForm.cantidad);
    if (!entregaForm.destinatario.trim()) {
      setError("Escribí el nombre de la persona.");
      return;
    }
    if (!cant || cant <= 0) {
      setError("La cantidad tiene que ser mayor a 0.");
      return;
    }

    setEntregaGuardando(true);
    let error;

    const { data: mov, error: errMov } = await supabase.rpc("registrar_movimiento_insumo", {
      p_insumo_id: ins.id,
      p_tipo: "salida",
      p_cantidad: cant,
      p_producto_texto: null,
      p_nota: `Entrega de ropa a ${entregaForm.destinatario.trim()}`,
      p_usuario_email: session?.user?.email || null,
    });
    const rMov = mov?.[0];
    if (errMov || !rMov?.ok) {
      error = errMov || new Error(rMov?.mensaje || "No se pudo descontar el stock.");
    } else {
      const { error: errEnt } = await supabase.from("ropa_entregas").insert({
        insumo_id: ins.id,
        categoria: ins.categoria,
        talle: ins.talle,
        destinatario: entregaForm.destinatario.trim(),
        cantidad: cant,
        observaciones: entregaForm.observaciones.trim() || null,
        usuario_email: session?.user?.email || null,
      });
      error = errEnt;
    }

    setEntregaGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowEntrega(false);
    setEntregaForm({ destinatario: "", cantidad: "1", observaciones: "" });
    setConfirmacion("Entrega registrada y stock descontado");
    setTimeout(() => setConfirmacion(null), 3000);
    loadInsumos();
    cargarEntregas();
  }

  async function eliminarEntrega() {
    if (!confirmarEntrega) return;
    const { error } = await supabase.from("ropa_entregas").delete().eq("id", confirmarEntrega.id);
    if (error) {
      setError(error.message);
      setConfirmarEntrega(null);
      return;
    }
    setConfirmarEntrega(null);
    setConfirmacion("Entrega eliminada");
    setTimeout(() => setConfirmacion(null), 2500);
    cargarEntregas();
  }

  function imprimirEntrega(r) {
    setTarjetaEntrega(r);
    const tituloOriginal = document.title;
    document.title = `Ropa-${r.categoria}-${r.talle}-${(r.destinatario || "sin-nombre").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-")}`;
    function restaurar() {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurar);
    }
    window.addEventListener("afterprint", restaurar);
    setTimeout(() => window.print(), 100);
  }

  async function exportarEntregasExcel() {
    const XLSX = await import("xlsx");
    const filas = entregasFiltradas.map((r) => ({
      Fecha: new Date(r.fecha).toLocaleString("es-MX"),
      Categoría: r.categoria,
      Talle: r.talle,
      Persona: r.destinatario,
      Cantidad: r.cantidad,
      Observaciones: r.observaciones || "",
      Usuario: r.usuario_email || "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Entregas de ropa");
    XLSX.writeFile(libro, `ropa-entregas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function submitForm(e) {
    e.preventDefault();
    if (enviando) return;
    setError(null);

    if (!form.nombre.trim()) {
      setError("El nombre del insumo es obligatorio.");
      return;
    }
    if (!form.categoria) {
      setError("Elegí una categoría.");
      return;
    }

    setEnviando(true);
    const esRopa = esRopaCategoria(form.categoria);
    if (esRopa && !form.talle) {
      setError("Elegí el talle para la prenda.");
      return;
    }
    if (!esRopa && form.talle) {
      setError("El talle solo aplica a Pantalón, Camisa o Buzo.");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      unidad: form.unidad,
      stock: Number(form.stock) || 0,
      minimo: Number(form.minimo) || 0,
      deposito: "Pañol",
      talle: esRopa ? form.talle : null,
      es_ropa: esRopa,
    };

    let error;
    if (editingId) {
      const original = insumos.find((x) => x.id === editingId);
      const stockOriginal = Number(original?.stock) || 0;
      const stockNuevo = Number(form.stock) || 0;
      const datos = {
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        unidad: form.unidad,
        minimo: Number(form.minimo) || 0,
        talle: esRopa ? form.talle : null,
        es_ropa: esRopa,
      };
      if (stockNuevo === stockOriginal) {
        datos.stock = stockNuevo;
        ({ error } = await supabase.from("insumos").update(datos).eq("id", editingId));
      } else {
        const { data: ajuste, error: errAjuste } = await supabase.rpc("ajustar_stock_insumo", {
          p_insumo_id: editingId,
          p_stock_nuevo: stockNuevo,
          p_motivo: "Edición de stock (admin)",
          p_usuario_email: session?.user?.email || null,
        });
        const r = ajuste?.[0];
        if (errAjuste || !r?.ok) {
          error = errAjuste || new Error(r?.mensaje || "No se pudo ajustar el stock.");
        } else {
          ({ error } = await supabase.from("insumos").update(datos).eq("id", editingId));
        }
      }
    } else {
      const stockNuevo = Number(form.stock) || 0;
      const { data: nuevo, error: errInsert } = await supabase.from("insumos").insert(payload).select("id").single();
      error = errInsert;
      if (!error && stockNuevo > 0) {
        const { error: errEntrada } = await supabase.rpc("registrar_movimiento_insumo", {
          p_insumo_id: nuevo.id,
          p_tipo: "entrada",
          p_cantidad: stockNuevo,
          p_producto_texto: null,
          p_nota: "Stock inicial (alta de insumo)",
          p_usuario_email: session?.user?.email || null,
        });
        error = errEntrada;
      }
    }

    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    loadInsumos();
  }

  async function confirmarArchivar() {
    const { error } = await supabase.from("insumos").update({ activo: false }).eq("id", archiving.id);
    if (error) {
      setError(error.message);
      setArchiving(null);
      return;
    }
    setArchiving(null);
    loadInsumos();
  }

  async function reactivar(i) {
    const { error } = await supabase.from("insumos").update({ activo: true }).eq("id", i.id);
    if (error) {
      setError(error.message);
      return;
    }
    loadInsumos();
  }

  if (rol && rol !== "admin" && rol !== "subadmin" && rol !== "taller_stock") return null;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold">Insumos — Pañol</h1>
          {!loading && (lowCount > 0 ? (
            <p className="text-sm text-red flex items-center gap-1 mt-0.5"><AlertTriangle size={14} /> {lowCount} insumo{lowCount > 1 ? "s" : ""} por debajo del mínimo</p>
          ) : (
            <p className="text-sm text-[#6B6558] mt-0.5">Todo el stock está en niveles saludables</p>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportarEntregasExcel} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
            <Download size={16} /> Entregas a Excel
          </button>
          <button onClick={exportarExcel} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
            <Download size={16} /> Stock a Excel
          </button>
          {!soloLectura && (
            <button onClick={openNuevo} className="flex items-center gap-1.5 bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] transition-colors">
              <Plus size={16} /> Nuevo insumo
            </button>
          )}
        </div>
      </div>

      {confirmacion && (
        <div className="flex items-center gap-2 bg-[#EAF0E4] border border-[#B9CBA9] text-[#3D5A2E] text-sm px-4 py-3 rounded-sm mb-5 max-w-2xl">
          <CheckCircle2 size={16} /> {confirmacion}
        </div>
      )}
      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-line rounded-sm px-3 py-2 w-full sm:max-w-xs">
          <Search size={15} color="#6B6558" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar insumo o categoría" className="flex-1 text-sm outline-none" />
        </div>
        <select value={nombreFilter} onChange={(e) => setNombreFilter(e.target.value)} className="bg-white border border-line rounded-sm px-3 py-2 text-sm text-ink max-w-[220px]">
          <option value="todos">Todos los nombres</option>
          {nombres.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="bg-white border border-line rounded-sm px-3 py-2 text-sm text-ink">
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setVerArchivados((v) => !v)}
          className="text-sm px-3 py-2 rounded-sm border border-line"
          style={{ backgroundColor: verArchivados ? "#1C1F1C" : "white", color: verArchivados ? "white" : "#1C1F1C" }}
        >
          {verArchivados ? "Viendo archivados" : "Ver archivados"}
        </button>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[["todas", "Todo el pañol"], ["ropa", "Ropa de trabajo"], ["sin_ropa", "Sin ropa"]].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setVerRopa(val)}
            className="px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors"
            style={{
              backgroundColor: verRopa === val ? "#4A4B4D" : "white",
              color: verRopa === val ? "white" : "#4A463D",
              borderColor: verRopa === val ? "transparent" : "#D8D2C4",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Móvil: tarjetas */}
      <div className="sm:hidden space-y-3">
        {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
        {!loading &&
          filtered.map((i) => (
            <div key={i.id} className="bg-white border border-line rounded-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <FotoInsumo
                    insumoId={i.id}
                    nombre={i.nombre}
                    imagenUrl={i.imagen_url}
                    onImagen={subirImagen}
                    onQuitar={quitarImagen}
                    puedeEditar={!soloLectura}
                  />
                  <div className="min-w-0">
                    <div className="font-medium leading-snug">{i.nombre}</div>
                    <div className="text-xs text-[#6B6558] mt-0.5">
                      {i.categoria}
                      {i.talle ? ` · Talle ${i.talle}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {i.es_ropa && (
                    <button
                      onClick={() => abrirEntrega(i)}
                      className="px-3 py-2 border border-line rounded-sm text-xs font-medium text-ink"
                    >
                      Entregar
                    </button>
                  )}
                  {!soloLectura && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openEditar(i)} className="p-2.5 border border-line rounded-sm text-[#4A4B4D]" title="Editar" aria-label={`Editar ${i.nombre}`}>
                        <Pencil size={16} />
                      </button>
                      {verArchivados ? (
                        <button onClick={() => reactivar(i)} className="px-3 py-2.5 border border-line rounded-sm text-green text-xs font-medium">Reactivar</button>
                      ) : (
                        <button onClick={() => setArchiving(i)} className="p-2.5 border border-line rounded-sm text-red" title="Archivar" aria-label={`Archivar ${i.nombre}`}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 gap-3">
                <div className="font-mono text-base">
                  {i.stock} <span className="text-[#B0AA9A]">/ {i.minimo}</span> <span className="text-[#8A8578] text-xs">{i.unidad}</span>
                </div>
                <StockGauge stock={i.stock} minimo={i.minimo} />
              </div>
            </div>
          ))}
        {!loading && filtered.length === 0 && <p className="text-center text-sm text-[#8A8578] py-8">Sin resultados</p>}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
              <th className="px-4 py-3 font-medium">Insumo</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Talle</th>
              <th className="px-4 py-3 font-medium">Stock / Mínimo</th>
              <th className="px-4 py-3 font-medium">Nivel</th>
              {!soloLectura && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={soloLectura ? 5 : 6} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
            {!loading && filtered.map((i, idx) => (
              <tr key={i.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== filtered.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FotoInsumo
                      insumoId={i.id}
                      nombre={i.nombre}
                      imagenUrl={i.imagen_url}
                      onImagen={subirImagen}
                      onQuitar={quitarImagen}
                      puedeEditar={!soloLectura}
                    />
                    <span className="font-medium">{i.nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#4A463D]">{i.categoria}</td>
                <td className="px-4 py-3 font-mono">{i.talle || "—"}</td>
                <td className="px-4 py-3 font-mono">
                  {i.stock} <span className="text-[#B0AA9A]">/ {i.minimo}</span> <span className="text-[#8A8578] text-xs">{i.unidad}</span>
                </td>
                <td className="px-4 py-3"><StockGauge stock={i.stock} minimo={i.minimo} /></td>
                {!soloLectura && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {i.es_ropa && (
                        <button onClick={() => abrirEntrega(i)} className="text-xs font-medium text-[#2E6F9E] hover:underline" title="Registrar entrega">
                          Entregar
                        </button>
                      )}
                      <button onClick={() => openEditar(i)} className="text-[#4A4B4D] hover:opacity-70" title="Editar">
                        <Pencil size={15} />
                      </button>
                      {verArchivados ? (
                        <button onClick={() => reactivar(i)} className="text-green text-xs font-medium hover:underline">Reactivar</button>
                      ) : (
                        <button onClick={() => setArchiving(i)} className="text-red hover:opacity-70" title="Archivar">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={soloLectura ? 5 : 6} className="px-4 py-8 text-center text-sm text-[#8A8578]">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Entregas de ropa */}
      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold text-ink mb-1">Entregas de ropa</h2>
        <p className="text-xs text-[#6B6558] mb-3">
          Al entregar una prenda se descuenta del stock del pañol y queda registrado quién la recibió.
        </p>

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-line rounded-sm px-3 py-2 w-full sm:max-w-xs">
            <Search size={15} color="#6B6558" />
            <input value={filtroEntregas} onChange={(e) => setFiltroEntregas(e.target.value)} placeholder="Buscar persona" className="flex-1 text-sm outline-none" />
          </div>
        </div>

        <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Talle</th>
                <th className="px-4 py-3 font-medium">Persona</th>
                <th className="px-4 py-3 font-medium">Cant.</th>
                <th className="px-4 py-3 font-medium">Observaciones</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
              {!loading && entregasFiltradas.map((r, idx) => (
                <tr key={r.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== entregasFiltradas.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                  <td className="px-4 py-3 text-[#6B6558] font-mono whitespace-nowrap">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-4 py-3 text-[#4A463D]">{r.categoria}</td>
                  <td className="px-4 py-3 font-mono">{r.talle}</td>
                  <td className="px-4 py-3 text-[#4A463D]">{r.destinatario}</td>
                  <td className="px-4 py-3 font-mono">{r.cantidad}</td>
                  <td className="px-4 py-3 text-[#8A8578] max-w-[180px] truncate">{r.observaciones || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => imprimirEntrega(r)} className="text-[#4A4B4D] hover:opacity-70" title="Imprimir entrega">
                        <Printer size={15} />
                      </button>
                      <button onClick={() => setConfirmarEntrega(r)} className="text-[#C7522A] hover:text-red" title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && entregasFiltradas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Aún no hay entregas</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden space-y-3">
          {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
          {!loading && entregasFiltradas.map((r) => (
            <div key={r.id} className="bg-white border border-line rounded-sm p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#EAF0F5] text-[#2E6F9E]">{r.categoria}</span>
                <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#F2EEE3] text-[#6B6558]">Talle {r.talle}</span>
                <span className="font-mono text-xs text-[#6B6558] ml-auto">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <div className="font-medium leading-snug">{r.destinatario}</div>
              <p className="text-xs text-[#6B6558] mt-0.5">Cantidad: {r.cantidad}</p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => imprimirEntrega(r)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                  <Printer size={15} /> Imprimir
                </button>
                <button onClick={() => setConfirmarEntrega(r)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-[#C7522A]">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {!loading && entregasFiltradas.length === 0 && <p className="text-center text-sm text-[#8A8578] py-8">Aún no hay entregas</p>}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-sm border border-line shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-xl font-semibold">{editingId ? "Editar insumo" : "Nuevo insumo"}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitForm} className="p-5">
              <Field label="Nombre">
                <input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Categoría">
                  <select className={inputCls} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                    <option value="">— Seleccionar —</option>
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Unidad">
                  <select className={inputCls} value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="Stock">
                  <input type="number" className={inputCls} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </Field>
                <Field label="Stock mínimo">
                  <input type="number" className={inputCls} value={form.minimo} onChange={(e) => setForm({ ...form, minimo: e.target.value })} />
                </Field>
              </div>

              {esRopaCategoria(form.categoria) && (
                <Field label="Talle">
                  <div className="flex flex-wrap gap-1.5">
                    {tallesDe(form.categoria).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setForm({ ...form, talle: t })}
                        className="min-w-[42px] px-2 py-2 rounded-sm text-sm font-medium border transition-colors"
                        style={{
                          backgroundColor: form.talle === t ? "#F4791E" : "white",
                          color: form.talle === t ? "white" : "#1C1F1C",
                          borderColor: form.talle === t ? "transparent" : "#D8D2C4",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#8A8578] mt-1">
                    {form.categoria === "Pantalon" ? "Pantalones 40 a 56" : "Camisas y buzos S a 3XL"}
                  </p>
                </Field>
              )}

              <button type="submit" disabled={enviando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {enviando ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar insumo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showEntrega && (() => {
        const ins = insumos.find((i) => i.id === entregaInsumoId);
        if (!ins) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card w-full max-w-md rounded-sm border border-line shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h3 className="font-display text-xl font-semibold">Entregar prenda</h3>
                <button onClick={() => setShowEntrega(false)}><X size={18} /></button>
              </div>
              <form onSubmit={registrarEntrega} className="p-5">
                <div className="bg-[#F7F4EC] rounded-sm px-3 py-2 mb-4 text-sm">
                  <span className="font-medium">{ins.nombre}</span>
                  <span className="text-[#6B6558]"> · Talle {ins.talle} · stock {ins.stock} {ins.unidad}</span>
                </div>
                <Field label="Persona">
                  <input className={inputCls} value={entregaForm.destinatario} onChange={(e) => setEntregaForm({ ...entregaForm, destinatario: e.target.value })} placeholder="Nombre y apellido" list="nombres-entrega" />
                  <datalist id="nombres-entrega">
                    {Object.keys(entregasPorPersona).map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Cantidad">
                  <input type="number" step="1" min="1" className={inputCls + " max-w-[120px]"} value={entregaForm.cantidad} onChange={(e) => setEntregaForm({ ...entregaForm, cantidad: e.target.value })} />
                </Field>
                <Field label="Observaciones (opcional)">
                  <input className={inputCls} value={entregaForm.observaciones} onChange={(e) => setEntregaForm({ ...entregaForm, observaciones: e.target.value })} placeholder="Ej. Cambio por rotura" />
                </Field>
                <button type="submit" disabled={entregaGuardando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                  {entregaGuardando ? "Guardando..." : "Registrar entrega y descontar stock"}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {confirmarEntrega && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmarEntrega(null)}>
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold mb-2">Eliminar entrega</h3>
            <p className="text-sm text-[#4A463D] mb-4">
              ¿Eliminar la entrega de <b>{confirmarEntrega.categoria} talle {confirmarEntrega.talle}</b> a <b>{confirmarEntrega.destinatario}</b>?
              <br />
              <span className="text-xs text-[#8A8578]">El stock no se devuelve automáticamente.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmarEntrega(null)} className="px-4 py-2 border border-line rounded-sm text-sm text-ink hover:bg-[#F2EEE3]">Cancelar</button>
              <button onClick={eliminarEntrega} className="px-4 py-2 bg-[#C7522A] text-white rounded-sm text-sm font-medium hover:bg-red">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {tarjetaEntrega && (
        <DocPrint titulo="Entrega de ropa" numero={null}>
          <DocGrid
            datos={[
              { label: "Fecha", valor: new Date(tarjetaEntrega.fecha).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) },
              { label: "Registrado por", valor: tarjetaEntrega.usuario_email || "—" },
              { label: "Categoría", valor: tarjetaEntrega.categoria },
              { label: "Talle", valor: tarjetaEntrega.talle },
              { label: "Persona", valor: tarjetaEntrega.destinatario },
              { label: "Cantidad", valor: String(tarjetaEntrega.cantidad) },
            ]}
          />
          <DocNota label="Observaciones" texto={tarjetaEntrega.observaciones} />
          <div style={{ border: "1px solid #E4DFD3", borderRadius: 6, padding: "14px 16px", textAlign: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, color: "#1C1F1C" }}>
              {tarjetaEntrega.categoria} — Talle {tarjetaEntrega.talle}
            </div>
            <div style={{ fontSize: 15, marginTop: 2 }}>{tarjetaEntrega.destinatario}</div>
          </div>
          <div style={{ display: "flex", gap: 40, marginTop: 56, fontSize: 12, color: "#6B6558" }}>
            <div style={{ flex: 1, borderTop: "1px solid #1C1F1C", paddingTop: 6, textAlign: "center" }}>Firma quien entrega</div>
            <div style={{ flex: 1, borderTop: "1px solid #1C1F1C", paddingTop: 6, textAlign: "center" }}>Firma quien recibe</div>
          </div>
        </DocPrint>
      )}

      {archiving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5">
            <h3 className="font-display text-xl font-semibold mb-2">¿Archivar insumo?</h3>
            <p className="text-sm text-[#6B6558] mb-5">
              <span className="font-medium text-ink">{archiving.nombre}</span> dejará de aparecer en tu inventario activo, pero su historial de movimientos se conserva. Puedes reactivarlo cuando quieras desde "Ver archivados".
            </p>
            <div className="flex gap-2">
              <button onClick={() => setArchiving(null)} className="flex-1 py-2 rounded-sm text-sm font-medium border border-line hover:bg-[#F2EEE3]">Cancelar</button>
              <button onClick={confirmarArchivar} className="flex-1 py-2 rounded-sm text-sm font-medium bg-red text-white hover:opacity-90">Archivar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

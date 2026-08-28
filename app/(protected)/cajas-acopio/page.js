"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { AlertTriangle, Search, Plus, X, Pencil, Trash2, Download, Upload, ClipboardCheck, FileSpreadsheet, Wrench } from "lucide-react";

const CATS = ["Químicos", "Empaques", "Metales", "Textiles", "Seguridad", "Insumos para Fabricación", "Herramientas"];
const UNITS = ["kg", "L", "unid", "m"];
const emptyForm = { nombre: "", categoria: "", unidad: UNITS[0], stock: "", minimo: "" };

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

export default function StockPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const esAdmin = rol === "admin";
  const soloLectura = rol === "encargado";
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [nombreFilter, setNombreFilter] = useState("todos");
  const [catFilter, setCatFilter] = useState("Todas");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [enviando, setEnviando] = useState(false);
  const [archiving, setArchiving] = useState(null);
  const [verArchivados, setVerArchivados] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importando, setImportando] = useState(false);
  const [showControl, setShowControl] = useState(false);
  const [conteos, setConteos] = useState({});
  const [controlGuardando, setControlGuardando] = useState(false);
  const [herramientasPorCaja, setHerramientasPorCaja] = useState({});
  const [nuevoTool, setNuevoTool] = useState({});
  const [showControlHerr, setShowControlHerr] = useState(false);
  const [conteosHerr, setConteosHerr] = useState({});
  const [controlHerrGuardando, setControlHerrGuardando] = useState(false);

  async function loadInsumos() {
    setLoading(true);
    const { data, error } = await supabase.from("insumos").select("*").eq("deposito", "Gral. Villegas").order("nombre");
    if (error) setError(error.message);
    else setInsumos(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!rol) return;
    loadInsumos();
    cargarHerramientas();
  }, [rol]);

  useEffect(() => {
    if (rol && rol !== "admin" && rol !== "encargado") router.replace("/ingreso-egreso");
  }, [rol, router]);

  const categorias = useMemo(() => ["Todas", ...new Set(insumos.map((i) => i.categoria).filter(Boolean))], [insumos]);
  const nombres = useMemo(() => [...new Set(insumos.map((i) => i.nombre).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [insumos]);

  const filtered = useMemo(
    () =>
      insumos
        .filter((i) => (verArchivados ? i.activo === false : i.activo !== false))
        .filter((i) => i.nombre.toLowerCase().includes(query.toLowerCase()) || (i.categoria || "").toLowerCase().includes(query.toLowerCase()))
        .filter((i) => catFilter === "Todas" || i.categoria === catFilter)
        .filter((i) => nombreFilter === "todos" || i.nombre === nombreFilter),
    [insumos, query, catFilter, verArchivados, nombreFilter]
  );
  const lowCount = insumos.filter((i) => i.activo !== false && i.stock < i.minimo).length;

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = filtered.map((i) => ({
      Insumo: i.nombre,
      Categoría: i.categoria,
      Unidad: i.unidad,
      Stock: i.stock,
      "Stock mínimo": i.minimo,
      Estado: i.activo === false ? "Archivado" : "Activo",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Stock");
    XLSX.writeFile(libro, `cajas-acopio-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function openNuevo() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditar(i) {
    setEditingId(i.id);
    setForm({ nombre: i.nombre, categoria: i.categoria || "", unidad: i.unidad, stock: String(i.stock), minimo: String(i.minimo) });
    setShowForm(true);
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
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      unidad: form.unidad,
      stock: Number(form.stock) || 0,
      minimo: Number(form.minimo) || 0,
      deposito: "Gral. Villegas",
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

  async function cargarHerramientas() {
    const { data, error } = await supabase.from("caja_herramientas").select("*").order("herramienta");
    if (error) { setError(error.message); return; }
    const map = {};
    (data || []).forEach((r) => { (map[r.caja_id] = map[r.caja_id] || []).push(r); });
    setHerramientasPorCaja(map);
  }

  async function agregarHerramienta(cajaId) {
    const t = nuevoTool[cajaId] || {};
    if (!t.herramienta?.trim()) { setError("Escribí el nombre de la herramienta."); return; }
    const cant = Number(t.cantidad) || 0;
    if (!cant || cant <= 0) { setError("La cantidad tiene que ser mayor a 0."); return; }
    const { error } = await supabase.from("caja_herramientas").insert({
      caja_id: cajaId,
      herramienta: t.herramienta.trim(),
      cantidad: cant,
      unidad: t.unidad?.trim() || "unid",
    });
    if (error) { setError(error.message); return; }
    setNuevoTool((prev) => ({ ...prev, [cajaId]: { herramienta: "", cantidad: "", unidad: "unid" } }));
    cargarHerramientas();
  }

  async function quitarHerramienta(id) {
    const { error } = await supabase.from("caja_herramientas").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    cargarHerramientas();
  }

  function abrirControlHerr() {
    const m = {};
    Object.values(herramientasPorCaja).flat().forEach((h) => { m[h.id] = String(h.cantidad); });
    setConteosHerr(m);
    setShowControlHerr(true);
  }

  async function guardarControlHerr() {
    setControlHerrGuardando(true);
    setError(null);
    let ok = 0;
    const errores = [];
    for (const cajaId of Object.keys(herramientasPorCaja)) {
      for (const h of herramientasPorCaja[cajaId] || []) {
        const contadoStr = conteosHerr[h.id];
        if (contadoStr === "" || contadoStr == null) continue;
        const contado = Number(contadoStr);
        if (Number.isNaN(contado) || contado < 0) { errores.push(`${h.herramienta}: valor inválido`); continue; }
        const sistema = Number(h.cantidad);
        if (contado === sistema) continue;
        const dif = contado - sistema;
        const { error: errUpd } = await supabase.from("caja_herramientas").update({ cantidad: contado }).eq("id", h.id);
        if (errUpd) { errores.push(`${h.herramienta}: ${errUpd.message}`); continue; }
        const { error: errLog } = await supabase.from("caja_control_log").insert({
          caja_id: Number(cajaId),
          herramienta_id: h.id,
          herramienta: h.herramienta,
          cantidad_sistema: sistema,
          cantidad_contada: contado,
          diferencia: dif,
          usuario_email: session?.user?.email || null,
        });
        if (errLog) errores.push(`${h.herramienta} (log): ${errLog.message}`);
        else ok++;
      }
    }
    setControlHerrGuardando(false);
    if (errores.length > 0) setError(errores.join(" | "));
    if (ok > 0) {
      setShowControlHerr(false);
      cargarHerramientas();
    } else if (errores.length === 0) {
      setError("No hay diferencias para ajustar.");
    }
  }

  async function descargarPlantillaCajas() {
    const XLSX = await import("xlsx");
    const filas = [
      { Nombre: "Caja de herramientas 1 - Gral. Villegas", "Categoría": "Herramientas", Unidad: "unid", Stock: 1, "Stock mínimo": 1, Depósito: "Gral. Villegas" },
      { Nombre: "Caja de herramientas 2 - Gral. Villegas", "Categoría": "Herramientas", Unidad: "unid", Stock: 1, "Stock mínimo": 1, Depósito: "Gral. Villegas" },
    ];
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Cajas");
    XLSX.writeFile(libro, "plantilla-cajas-herramientas.xlsx");
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportPreview(null);
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const normalizar = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const filas = [];
    const errores = [];
    rows.forEach((r, idx) => {
      const nombre = r["Nombre"] ?? r["nombre"] ?? r["NOMBRE"] ?? r["Insumo"] ?? r["insumo"] ?? "";
      const categoria = r["Categoría"] ?? r["Categoria"] ?? r["categoria"] ?? "Herramientas";
      const unidad = r["Unidad"] ?? r["unidad"] ?? r["UNIDAD"] ?? "unid";
      const stock = r["Stock"] ?? r["stock"] ?? r["STOCK"] ?? 0;
      const minimo = r["Stock mínimo"] ?? r["Stock minimo"] ?? r["Minimo"] ?? r["minimo"] ?? 1;
      const deposito = r["Depósito"] ?? r["Deposito"] ?? r["deposito"] ?? "Gral. Villegas";
      if (!String(nombre).trim()) {
        errores.push(`Fila ${idx + 2}: falta el nombre`);
        return;
      }
      filas.push({
        nombre: String(nombre).trim(),
        categoria: String(categoria).trim() || "Herramientas",
        unidad: String(unidad).trim() || "unid",
        stock: Number(stock) || 0,
        minimo: Number(minimo) || 0,
        deposito: String(deposito).trim() || "Gral. Villegas",
      });
    });
    if (filas.length === 0 && errores.length === 0) errores.push("La planilla no tiene filas válidas.");
    setImportPreview({ filas, errores });
    e.target.value = "";
  }

  async function confirmarImport() {
    if (!importPreview || importPreview.filas.length === 0) return;
    setImportando(true);
    setError(null);
    let ok = 0;
    let errores = [];
    for (const f of importPreview.filas) {
      const { data: existente } = await supabase.from("insumos").select("id, stock").eq("nombre", f.nombre).eq("deposito", f.deposito).maybeSingle();
      if (existente) {
        const { error: errUpd } = await supabase.from("insumos").update({ categoria: f.categoria, unidad: f.unidad, minimo: f.minimo }).eq("id", existente.id);
        if (errUpd) { errores.push(`${f.nombre}: ${errUpd.message}`); continue; }
        const stockActual = Number(existente.stock) || 0;
        if (stockActual !== f.stock) {
          const { data: ajuste, error: errAjuste } = await supabase.rpc("ajustar_stock_insumo", {
            p_insumo_id: existente.id,
            p_stock_nuevo: f.stock,
            p_motivo: "Carga masiva desde Excel (cajas)",
            p_usuario_email: session?.user?.email || null,
          });
          const r = ajuste?.[0];
          if (errAjuste || !r?.ok) { errores.push(`${f.nombre}: ${errAjuste?.message || r?.mensaje}`); continue; }
        }
        ok++;
      } else {
        const { data: nuevo, error: errIns } = await supabase.from("insumos").insert({ nombre: f.nombre, categoria: f.categoria, unidad: f.unidad, stock: f.stock, minimo: f.minimo, deposito: f.deposito }).select("id").single();
        if (errIns) { errores.push(`${f.nombre}: ${errIns.message}`); continue; }
        if (f.stock > 0) {
          const { error: errMov } = await supabase.rpc("registrar_movimiento_insumo", {
            p_insumo_id: nuevo.id, p_tipo: "entrada", p_cantidad: f.stock, p_producto_texto: null, p_nota: "Stock inicial (carga masiva Excel)", p_usuario_email: session?.user?.email || null,
          });
          if (errMov) errores.push(`${f.nombre}: ${errMov.message}`);
        }
        ok++;
      }
    }
    setImportando(false);
    if (errores.length > 0) setError(errores.join(" | "));
    if (ok > 0) {
      setImportPreview(null);
      setShowImport(false);
      loadInsumos();
    }
  }

  function abrirControl() {
    const m = {};
    filtered.filter((i) => i.activo !== false).forEach((i) => { m[i.id] = String(i.stock); });
    setConteos(m);
    setShowControl(true);
  }

  async function guardarControl() {
    setControlGuardando(true);
    setError(null);
    let ok = 0;
    const errores = [];
    for (const i of filtered.filter((x) => x.activo !== false)) {
      const contado = conteos[i.id];
      if (contado === "" || contado == null) continue;
      const val = Number(contado);
      if (Number.isNaN(val) || val < 0) { errores.push(`${i.nombre}: valor inválido`); continue; }
      if (val === Number(i.stock)) continue;
      const { data, error: err } = await supabase.rpc("ajustar_stock_insumo", {
        p_insumo_id: i.id, p_stock_nuevo: val, p_motivo: "Control de stock (conteo físico)", p_usuario_email: session?.user?.email || null,
      });
      const r = data?.[0];
      if (err || !r?.ok) errores.push(`${i.nombre}: ${err?.message || r?.mensaje}`);
      else ok++;
    }
    setControlGuardando(false);
    if (errores.length > 0) setError(errores.join(" | "));
    if (ok > 0) {
      setShowControl(false);
      loadInsumos();
    } else if (errores.length === 0) {
      setError("No hay diferencias para ajustar.");
    }
  }

  if (rol && rol !== "admin" && rol !== "encargado") return null;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold">Cajas de Acopio — Gral. Villegas</h1>
          {!loading && (lowCount > 0 ? (
            <p className="text-sm text-red flex items-center gap-1 mt-0.5"><AlertTriangle size={14} /> {lowCount} insumo{lowCount > 1 ? "s" : ""} por debajo del mínimo</p>
          ) : (
            <p className="text-sm text-[#6B6558] mt-0.5">Todo el stock está en niveles saludables</p>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportarExcel} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
            <Download size={16} /> Exportar a Excel
          </button>
          <button onClick={abrirControlHerr} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
            <Wrench size={16} /> Control de herramientas
          </button>
          {!soloLectura && (
            <>
              <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
                <Upload size={16} /> Importar Excel
              </button>
              <button onClick={abrirControl} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
                <ClipboardCheck size={16} /> Control de stock
              </button>
              <button onClick={openNuevo} className="flex items-center gap-1.5 bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] transition-colors">
                <Plus size={16} /> Nuevo insumo
              </button>
            </>
          )}
        </div>
      </div>

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

      {/* Móvil: tarjetas */}
      <div className="sm:hidden space-y-3">
        {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
        {!loading &&
          filtered.map((i) => (
            <div key={i.id} className="bg-white border border-line rounded-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium leading-snug">{i.nombre}</div>
                  <div className="text-xs text-[#6B6558] mt-0.5">{i.categoria}</div>
                </div>
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
              <div className="flex items-center justify-between mt-3 gap-3">
                <div className="font-mono text-base">
                  {i.stock} <span className="text-[#B0AA9A]">/ {i.minimo}</span> <span className="text-[#8A8578] text-xs">{i.unidad}</span>
                </div>
                <StockGauge stock={i.stock} minimo={i.minimo} />
              </div>
              <div className="mt-3 pt-3 border-t border-[#EFEBE0]">
                <p className="text-[10px] uppercase tracking-wide text-[#8A8578] mb-1.5 flex items-center gap-1"><Wrench size={12} /> Herramientas en esta caja ({(herramientasPorCaja[i.id] || []).length})</p>
                {(herramientasPorCaja[i.id] || []).length > 0 ? (
                  <ul className="space-y-1 mb-2">
                    {(herramientasPorCaja[i.id] || []).map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 text-sm bg-[#F7F4EC] rounded-sm px-2.5 py-1.5">
                        <span className="truncate"><span className="font-mono text-[#6B6558]">{h.cantidad} {h.unidad}</span> <span className="text-[#8A8578]">·</span> {h.herramienta}</span>
                        {!soloLectura && (
                          <button onClick={() => quitarHerramienta(h.id)} className="text-[#C7522A] hover:text-red p-1 shrink-0" title="Quitar"><Trash2 size={13} /></button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#8A8578] mb-2">Sin herramientas cargadas.</p>
                )}
                {!soloLectura && (
                  <div className="flex items-end gap-2">
                    <label className="block flex-1 min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Herramienta</span>
                      <input className={inputCls + " !py-1.5"} value={nuevoTool[i.id]?.herramienta || ""} onChange={(e) => setNuevoTool((prev) => ({ ...prev, [i.id]: { ...prev[i.id], herramienta: e.target.value, unidad: prev[i.id]?.unidad || "unid", cantidad: prev[i.id]?.cantidad || "" } }))} placeholder="Ej. Martillo" />
                    </label>
                    <label className="block w-16 shrink-0">
                      <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Cant.</span>
                      <input type="number" step="1" min="1" className={inputCls + " !py-1.5 text-center"} value={nuevoTool[i.id]?.cantidad || ""} onChange={(e) => setNuevoTool((prev) => ({ ...prev, [i.id]: { ...prev[i.id], cantidad: e.target.value } }))} />
                    </label>
                    <button onClick={() => agregarHerramienta(i.id)} className="inline-flex items-center gap-1 bg-ink text-paper px-3 py-1.5 rounded-sm text-sm font-medium hover:bg-[#333731] shrink-0"><Plus size={14} /> Agregar</button>
                  </div>
                )}
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
              <th className="px-4 py-3 font-medium">Stock / Mínimo</th>
              <th className="px-4 py-3 font-medium">Nivel</th>
              {!soloLectura && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={soloLectura ? 4 : 5} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
            {!loading && filtered.map((i, idx) => (
              <React.Fragment key={i.id}>
                <tr className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} border-b border-[#EFEBE0]`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{i.nombre}</div>
                  </td>
                  <td className="px-4 py-3 text-[#4A463D]">{i.categoria}</td>
                  <td className="px-4 py-3 font-mono">
                    {i.stock} <span className="text-[#B0AA9A]">/ {i.minimo}</span> <span className="text-[#8A8578] text-xs">{i.unidad}</span>
                  </td>
                  <td className="px-4 py-3"><StockGauge stock={i.stock} minimo={i.minimo} /></td>
                  {!soloLectura && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
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
                <tr className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== filtered.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                  <td colSpan={soloLectura ? 4 : 5} className="px-4 py-3 bg-[#FDFBF5]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Wrench size={13} className="text-[#8A8578]" />
                      <span className="text-[10px] uppercase tracking-wide text-[#8A8578]">Herramientas en esta caja ({(herramientasPorCaja[i.id] || []).length})</span>
                    </div>
                    {(herramientasPorCaja[i.id] || []).length > 0 ? (
                      <ul className="space-y-1 mb-2">
                        {(herramientasPorCaja[i.id] || []).map((h) => (
                          <li key={h.id} className="flex items-center justify-between gap-2 text-sm bg-white border border-[#EFEBE0] rounded-sm px-2.5 py-1">
                            <span className="truncate"><span className="font-mono text-[#6B6558]">{h.cantidad} {h.unidad}</span> <span className="text-[#8A8578]">·</span> {h.herramienta}</span>
                            {!soloLectura && (
                              <button onClick={() => quitarHerramienta(h.id)} className="text-[#C7522A] hover:text-red p-1 shrink-0" title="Quitar"><Trash2 size={13} /></button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#8A8578] mb-2">Sin herramientas cargadas.</p>
                    )}
                    {!soloLectura && (
                      <div className="flex items-end gap-2">
                        <label className="block flex-1 min-w-0">
                          <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Herramienta</span>
                          <input className={inputCls + " !py-1.5"} value={nuevoTool[i.id]?.herramienta || ""} onChange={(e) => setNuevoTool((prev) => ({ ...prev, [i.id]: { ...prev[i.id], herramienta: e.target.value, unidad: prev[i.id]?.unidad || "unid", cantidad: prev[i.id]?.cantidad || "" } }))} placeholder="Ej. Martillo" />
                        </label>
                        <label className="block w-20 shrink-0">
                          <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Cant.</span>
                          <input type="number" step="1" min="1" className={inputCls + " !py-1.5 text-center"} value={nuevoTool[i.id]?.cantidad || ""} onChange={(e) => setNuevoTool((prev) => ({ ...prev, [i.id]: { ...prev[i.id], cantidad: e.target.value } }))} />
                        </label>
                        <button onClick={() => agregarHerramienta(i.id)} className="inline-flex items-center gap-1 bg-ink text-paper px-3 py-1.5 rounded-sm text-sm font-medium hover:bg-[#333731] shrink-0"><Plus size={14} /> Agregar</button>
                      </div>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={soloLectura ? 4 : 5} className="px-4 py-8 text-center text-sm text-[#8A8578]">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
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
              <button type="submit" disabled={enviando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {enviando ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar insumo"}
              </button>
            </form>
          </div>
        </div>
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

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-sm border border-line shadow-2xl my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-xl font-semibold flex items-center gap-2"><Upload size={18} /> Importar cajas desde Excel</h3>
              <button onClick={() => { setShowImport(false); setImportPreview(null); }}><X size={18} /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#6B6558] mb-3">Subí una planilla con las columnas <b>Nombre, Categoría, Unidad, Stock, Stock mínimo, Depósito</b>. Si la caja ya existe (mismo nombre y depósito) se actualiza.</p>
              <div className="flex gap-2 mb-4">
                <button onClick={descargarPlantillaCajas} className="inline-flex items-center gap-1.5 bg-white border border-line text-ink px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3]">
                  <FileSpreadsheet size={15} /> Descargar plantilla
                </button>
                <label className="inline-flex items-center gap-1.5 bg-ink text-paper px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] cursor-pointer">
                  <Upload size={15} /> Elegir archivo
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
                </label>
              </div>
              {importPreview && (
                <div className="border border-line rounded-sm p-3 bg-[#F7F4EC] mb-3">
                  <p className="text-sm font-medium">{importPreview.filas.length} fila{importPreview.filas.length !== 1 ? "s" : ""} lista{importPreview.filas.length !== 1 ? "s" : ""} para importar</p>
                  {importPreview.errores.length > 0 && (
                    <ul className="text-xs text-red mt-1 list-disc pl-4">
                      {importPreview.errores.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                  <div className="max-h-40 overflow-y-auto mt-2 text-xs">
                    <table className="w-full">
                      <thead><tr className="text-[#6B6558]"><th className="text-left">Nombre</th><th>Stock</th><th>Depósito</th></tr></thead>
                      <tbody>
                        {importPreview.filas.slice(0, 20).map((f, i) => (
                          <tr key={i}><td className="pr-2 truncate max-w-[180px]">{f.nombre}</td><td className="text-center">{f.stock}</td><td className="text-center">{f.deposito}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.filas.length > 20 && <p className="text-[#8A8578] mt-1">... y {importPreview.filas.length - 20} más</p>}
                  </div>
                </div>
              )}
              <button onClick={confirmarImport} disabled={!importPreview || importPreview.filas.length === 0 || importando} className="w-full bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {importando ? "Importando..." : `Confirmar importación (${importPreview?.filas.length || 0})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showControl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-sm border border-line shadow-2xl my-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
              <h3 className="font-display text-xl font-semibold flex items-center gap-2"><ClipboardCheck size={18} /> Control de stock — Gral. Villegas</h3>
              <button onClick={() => setShowControl(false)}><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-[#6B6558] mb-3">Contá el stock real en el depósito y cargá la cantidad contada. Al confirmar, las diferencias se ajustan y quedan registradas como <b>Ajuste</b> en Movimientos.</p>
              <div className="space-y-2">
                {filtered.filter((i) => i.activo !== false).map((i) => {
                  const contado = conteos[i.id];
                  const num = Number(contado);
                  const dif = !isNaN(num) && contado !== "" ? num - Number(i.stock) : 0;
                  const hayDif = contado !== "" && dif !== 0;
                  return (
                    <div key={i.id} className="flex items-center gap-2 border border-[#EFEBE0] rounded-sm px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{i.nombre}</div>
                        <div className="text-xs text-[#8A8578]">Sistema: {i.stock} {i.unidad}{hayDif && <span className={dif > 0 ? "text-[#4B7355]" : "text-[#C7522A]"}> → {dif > 0 ? `+${dif}` : dif}</span>}</div>
                      </div>
                      <input type="number" className={inputCls + " w-24 shrink-0 text-center"} value={contado} onChange={(e) => setConteos((prev) => ({ ...prev, [i.id]: e.target.value }))} placeholder={String(i.stock)} />
                    </div>
                  );
                })}
                {filtered.filter((i) => i.activo !== false).length === 0 && <p className="text-sm text-[#8A8578]">No hay insumos en este depósito para controlar.</p>}
              </div>
            </div>
            <div className="p-5 border-t border-line shrink-0">
              <button onClick={guardarControl} disabled={controlGuardando} className="w-full bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {controlGuardando ? "Guardando..." : "Confirmar control y ajustar diferencias"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showControlHerr && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-2xl rounded-sm border border-line shadow-2xl my-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
              <h3 className="font-display text-xl font-semibold flex items-center gap-2"><Wrench size={18} /> Control de herramientas — Gral. Villegas</h3>
              <button onClick={() => setShowControlHerr(false)}><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-[#6B6558] mb-3">Contá herramienta por herramienta en cada caja. Al confirmar, las diferencias se ajustan y quedan registradas.</p>
              {filtered.filter((i) => i.activo !== false).map((caja) => (
                <div key={caja.id} className="mb-5">
                  <h4 className="font-medium text-sm mb-2">{caja.nombre}</h4>
                  <div className="space-y-2">
                    {(herramientasPorCaja[caja.id] || []).map((h) => {
                      const contado = conteosHerr[h.id];
                      const num = Number(contado);
                      const dif = !isNaN(num) && contado !== "" ? num - Number(h.cantidad) : 0;
                      const hayDif = contado !== "" && dif !== 0;
                      return (
                        <div key={h.id} className="flex items-center gap-2 border border-[#EFEBE0] rounded-sm px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{h.herramienta} <span className="text-[#8A8578]">· {h.unidad}</span></div>
                            <div className="text-xs text-[#8A8578]">Sistema: {h.cantidad}{hayDif && <span className={dif > 0 ? "text-[#4B7355]" : "text-[#C7522A]"}> → {dif > 0 ? `+${dif}` : dif}</span>}</div>
                          </div>
                          <input type="number" className={inputCls + " w-20 shrink-0 text-center"} value={contado ?? ""} onChange={(e) => setConteosHerr((prev) => ({ ...prev, [h.id]: e.target.value }))} placeholder={String(h.cantidad)} />
                        </div>
                      );
                    })}
                    {(herramientasPorCaja[caja.id] || []).length === 0 && <p className="text-xs text-[#8A8578]">Esta caja no tiene herramientas cargadas.</p>}
                  </div>
                </div>
              ))}
              {filtered.filter((i) => i.activo !== false).length === 0 && <p className="text-sm text-[#8A8578]">No hay cajas para controlar.</p>}
            </div>
            <div className="p-5 border-t border-line shrink-0">
              <button onClick={guardarControlHerr} disabled={controlHerrGuardando} className="w-full bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
                {controlHerrGuardando ? "Guardando..." : "Confirmar control de herramientas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

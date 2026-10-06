"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { ShoppingCart, Download, Printer, Pencil, Trash2, Plus, X, Check } from "lucide-react";

const emptyForm = { proveedor: "", retiradoPor: "", observaciones: "" };
const emptyItem = () => ({ key: Date.now() + Math.random(), descripcion: "", cantidad: "", unidad: "unid" });

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

function nro(n) {
  return n != null ? "OC-" + String(n).padStart(4, "0") : null;
}

const ESTADO_STYLE = {
  pendiente: { bg: "#FBEFE6", color: "#B25A1E", label: "Pendiente" },
  retirada: { bg: "#EAF0E4", color: "#3D5A2E", label: "Retirada" },
  cancelada: { bg: "#EFEBE0", color: "#6B6558", label: "Cancelada" },
};

export default function OrdenesCompraPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const puedeAcceder = rol === "admin" || rol === "subadmin";

  const [ordenes, setOrdenes] = useState([]);
  const [itemsPorOrden, setItemsPorOrden] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formItems, setFormItems] = useState([emptyItem()]);
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [tarjeta, setTarjeta] = useState(null);

  async function cargar() {
    setLoading(true);
    const [{ data, error }, { data: items, error: errItems }] = await Promise.all([
      supabase.from("ordenes_compra").select("*").order("fecha", { ascending: false }),
      supabase.from("orden_compra_items").select("*"),
    ]);
    if (error) setError(error.message);
    else setOrdenes(data || []);
    if (errItems) setError(errItems.message);
    else {
      const mapa = {};
      (items || []).forEach((fila) => {
        (mapa[fila.orden_id] = mapa[fila.orden_id] || []).push(fila);
      });
      setItemsPorOrden(mapa);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && !puedeAcceder) router.replace("/ingreso-egreso");
  }, [rol, puedeAcceder, router]);

  function mostrarMensaje(texto) {
    setConfirmacion(texto);
    setTimeout(() => setConfirmacion(null), 3000);
  }

  function cambiarItem(key, campo, valor) {
    setFormItems((prev) => prev.map((i) => (i.key === key ? { ...i, [campo]: valor } : i)));
  }

  function agregarItem() {
    setFormItems((prev) => [...prev, emptyItem()]);
  }

  function quitarItem(key) {
    setFormItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  }

  function abrirNuevo() {
    setEditandoId(null);
    setForm(emptyForm);
    setFormItems([emptyItem()]);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function abrirEditar(o) {
    if (o.estado !== "pendiente") return;
    setEditandoId(o.id);
    setForm({ proveedor: o.proveedor || "", retiradoPor: o.retirado_por || "", observaciones: o.observaciones || "" });
    const items = itemsPorOrden[o.id] || [];
    setFormItems(
      items.length > 0
        ? items.map((i) => ({
            key: `saved-${i.id}`,
            descripcion: i.descripcion || "",
            cantidad: i.cantidad != null ? String(i.cantidad) : "",
            unidad: i.unidad || "unid",
          }))
        : [emptyItem()]
    );
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault();
    if (enviando) return;
    setError(null);

    if (!form.proveedor.trim()) {
      setError("La ferretería (proveedor) es obligatoria.");
      return;
    }
    const itemsValidos = formItems
      .map((i) => ({ descripcion: i.descripcion.trim(), cantidad: Number(i.cantidad), unidad: i.unidad.trim() || "unid" }))
      .filter((i) => i.descripcion || i.cantidad > 0);
    if (itemsValidos.length === 0) {
      setError("Agregá al menos un artículo con descripción.");
      return;
    }
    for (const i of itemsValidos) {
      if (!i.descripcion) {
        setError("Todos los artículos tienen que tener descripción.");
        return;
      }
      if (!i.cantidad || i.cantidad <= 0) {
        setError("La cantidad de cada artículo tiene que ser mayor a 0.");
        return;
      }
    }

    setEnviando(true);
    const payload = {
      proveedor: form.proveedor.trim(),
      retirado_por: form.retiradoPor.trim() || null,
      observaciones: form.observaciones.trim() || null,
    };
    let ordenId = editandoId;
    let error;
    if (editandoId) {
      ({ error } = await supabase.from("ordenes_compra").update(payload).eq("id", editandoId));
      if (!error) {
        ({ error } = await supabase.from("orden_compra_items").delete().eq("orden_id", editandoId));
      }
    } else {
      const { data: nueva, error: errIns } = await supabase
        .from("ordenes_compra")
        .insert({ ...payload, usuario_email: session?.user?.email || null })
        .select("id")
        .single();
      error = errIns;
      if (!error) ordenId = nueva.id;
    }

    if (!error) {
      const { error: errItems } = await supabase.from("orden_compra_items").insert(
        itemsValidos.map((i) => ({ orden_id: ordenId, descripcion: i.descripcion, cantidad: i.cantidad, unidad: i.unidad }))
      );
      error = errItems;
    }

    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(emptyForm);
    setFormItems([emptyItem()]);
    setEditandoId(null);
    mostrarMensaje(editandoId ? "Orden actualizada" : "Orden registrada");
    cargar();
  }

  async function cambiarEstado(o, nuevoEstado) {
    setError(null);
    const { error } = await supabase.from("ordenes_compra").update({ estado: nuevoEstado }).eq("id", o.id);
    if (error) {
      setError(error.message);
      return;
    }
    mostrarMensaje(`Orden ${ESTADO_STYLE[nuevoEstado].label.toLowerCase()}`);
    cargar();
  }

  async function eliminarOrden() {
    if (!confirmarEliminar) return;
    const { error } = await supabase.from("ordenes_compra").delete().eq("id", confirmarEliminar.id);
    if (error) {
      setError(error.message);
      setConfirmarEliminar(null);
      return;
    }
    setConfirmarEliminar(null);
    mostrarMensaje("Orden eliminada");
    cargar();
  }

  function imprimirOrden(o) {
    setTarjeta(o);
    const tituloOriginal = document.title;
    document.title = `OC-${o.numero != null ? nro(o.numero) : o.id}-${(o.proveedor || "ferreteria").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-")}`;
    function restaurarTitulo() {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurarTitulo);
    }
    window.addEventListener("afterprint", restaurarTitulo);
    setTimeout(() => window.print(), 100);
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = ordenes.map((o) => ({
      "N°": nro(o.numero) || "",
      Fecha: new Date(o.fecha).toLocaleString("es-MX"),
      Estado: ESTADO_STYLE[o.estado]?.label || o.estado,
      Ferretería: o.proveedor || "",
      "Retirado por": o.retirado_por || "",
      Artículos: (itemsPorOrden[o.id] || []).map((i) => `${i.descripcion} x${i.cantidad} ${i.unidad}`).join(" | "),
      Observaciones: o.observaciones || "",
      Usuario: o.usuario_email || "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Ordenes");
    XLSX.writeFile(libro, `ordenes-compra-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rol && !puedeAcceder) return null;

  const itemsTarjeta = tarjeta ? itemsPorOrden[tarjeta.id] || [] : [];

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} color="#F4791E" />
          <h1 className="font-display text-3xl font-semibold">Órdenes de compra</h1>
        </div>
        <button onClick={exportarExcel} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
          <Download size={16} /> Exportar a Excel
        </button>
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}
      {confirmacion && <p className="text-sm text-green mb-4">{confirmacion}</p>}

      <div className="flex flex-col gap-6">
        <form onSubmit={submit} className="bg-white border border-line rounded-sm p-4 sm:p-6 w-full max-w-2xl">
          {editandoId && (
            <div className="flex items-center justify-between bg-[#F2EEE3] border border-line rounded-sm px-3 py-2 mb-4 text-xs text-[#6B6558]">
              Editando orden existente
              <button type="button" onClick={abrirNuevo} className="text-[#3B5166] hover:underline flex items-center gap-1">
                <X size={13} /> Cancelar edición
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Ferretería">
              <input className={inputCls} value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} placeholder="Ej. Ferretería El Tornillo" />
            </Field>
            <Field label="Retira (quién va con la orden)">
              <input className={inputCls} value={form.retiradoPor} onChange={(e) => setForm({ ...form, retiradoPor: e.target.value })} placeholder="Ej. Juan Pérez" />
            </Field>
          </div>

          <Field label="Observaciones (opcional)">
            <input className={inputCls} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Ej. Pasar antes del mediodía" />
          </Field>

          <div className="border-t border-[#EFEBE0] pt-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wide text-[#6B6558]">Artículos a retirar ({formItems.length})</p>
              <button type="button" onClick={agregarItem} className="inline-flex items-center gap-1 text-sm text-[#3B5166] hover:underline">
                <Plus size={14} /> Agregar artículo
              </button>
            </div>
            <ul className="space-y-2 mb-1">
              {formItems.map((it) => (
                <li key={it.key} className="flex items-end gap-2 bg-[#F7F4EC] rounded-sm px-3 py-2">
                  <label className="block flex-1 min-w-0">
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Artículo</span>
                    <input className={inputCls + " !py-1.5"} value={it.descripcion} onChange={(e) => cambiarItem(it.key, "descripcion", e.target.value)} placeholder="Ej. Tornillos 1/4 x 2" />
                  </label>
                  <label className="block w-20 shrink-0">
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Cant.</span>
                    <input type="number" step="0.01" min="0" className={inputCls + " !py-1.5 text-center"} value={it.cantidad} onChange={(e) => cambiarItem(it.key, "cantidad", e.target.value)} />
                  </label>
                  <label className="block w-20 shrink-0">
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Unidad</span>
                    <input className={inputCls + " !py-1.5 text-center"} value={it.unidad} onChange={(e) => cambiarItem(it.key, "unidad", e.target.value)} placeholder="unid" />
                  </label>
                  <button type="button" onClick={() => quitarItem(it.key)} className="text-[#C7522A] hover:text-red p-1.5 shrink-0" title="Quitar">
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button type="submit" disabled={enviando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            {enviando ? "Guardando..." : editandoId ? "Guardar cambios" : "Registrar orden"}
          </button>
        </form>

        <div className="w-full">
          <h2 className="font-display text-xl font-semibold text-ink mb-3">Historial de órdenes</h2>

          {/* Móvil: tarjetas */}
          <div className="sm:hidden space-y-3">
            {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
            {!loading &&
              ordenes.map((o) => {
                const est = ESTADO_STYLE[o.estado] || ESTADO_STYLE.pendiente;
                const items = itemsPorOrden[o.id] || [];
                return (
                  <div key={o.id} className="bg-white border border-line rounded-sm p-4">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {o.numero != null && (
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-ink text-paper">{nro(o.numero)}</span>
                      )}
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm" style={{ backgroundColor: est.bg, color: est.color }}>
                        {est.label}
                      </span>
                      <span className="font-mono text-xs text-[#6B6558] ml-auto">{new Date(o.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    <div className="font-medium leading-snug">{o.proveedor || "Sin ferretería"}</div>
                    {o.retirado_por && <p className="text-xs text-[#6B6558] mt-0.5">Retira: {o.retirado_por}</p>}
                    <p className="text-xs text-[#6B6558] mt-1">{items.length} artículo(s)</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {o.estado === "pendiente" && (
                        <>
                          <button onClick={() => cambiarEstado(o, "retirada")} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                            <Check size={15} /> Marcar retirada
                          </button>
                          <button onClick={() => abrirEditar(o)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                            <Pencil size={15} /> Editar
                          </button>
                        </>
                      )}
                      <button onClick={() => imprimirOrden(o)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                        <Printer size={15} /> Imprimir
                      </button>
                      <button onClick={() => setConfirmarEliminar(o)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-[#C7522A]">
                        <Trash2 size={15} /> Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            {!loading && ordenes.length === 0 && <p className="text-center text-sm text-[#8A8578] py-8">Aún no hay órdenes</p>}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Ferretería</th>
                  <th className="px-4 py-3 font-medium">Retira</th>
                  <th className="px-4 py-3 font-medium">Artículos</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
                {!loading && ordenes.map((o, idx) => {
                  const est = ESTADO_STYLE[o.estado] || ESTADO_STYLE.pendiente;
                  const items = itemsPorOrden[o.id] || [];
                  return (
                    <tr key={o.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== ordenes.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{o.numero != null ? nro(o.numero) : "—"}</td>
                      <td className="px-4 py-3 text-[#6B6558] font-mono whitespace-nowrap">{new Date(o.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm whitespace-nowrap" style={{ backgroundColor: est.bg, color: est.color }}>
                          {est.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{o.proveedor || "—"}</td>
                      <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{o.retirado_por || "—"}</td>
                      <td className="px-4 py-3 text-[#4A463D] max-w-xs truncate">
                        {items.map((i) => `${i.descripcion} x${i.cantidad}`).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {o.estado === "pendiente" && (
                            <>
                              <button onClick={() => cambiarEstado(o, "retirada")} className="text-[#3D5A2E] hover:opacity-70" title="Marcar retirada">
                                <Check size={15} />
                              </button>
                              <button onClick={() => abrirEditar(o)} className="text-[#4A4B4D] hover:opacity-70" title="Editar">
                                <Pencil size={15} />
                              </button>
                            </>
                          )}
                          <button onClick={() => imprimirOrden(o)} className="text-[#4A4B4D] hover:opacity-70" title="Imprimir orden">
                            <Printer size={15} />
                          </button>
                          <button onClick={() => setConfirmarEliminar(o)} className="text-[#C7522A] hover:text-red" title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && ordenes.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Aún no hay órdenes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmarEliminar(null)}>
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold mb-2">Eliminar orden</h3>
            <p className="text-sm text-[#4A463D] mb-4">
              ¿Eliminar la orden <b>{confirmarEliminar.numero != null ? nro(confirmarEliminar.numero) : ""}</b>? También se quitan sus artículos.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmarEliminar(null)} className="px-4 py-2 border border-line rounded-sm text-sm text-ink hover:bg-[#F2EEE3]">
                Cancelar
              </button>
              <button onClick={eliminarOrden} className="px-4 py-2 bg-[#C7522A] text-white rounded-sm text-sm font-medium hover:bg-red">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {tarjeta && (
        <div className="print-card hidden">
          <div className="pc-header">
            <div className="pc-empresa">Simonetti Montajes Industriales</div>
            <div className="pc-tipo">Orden de compra {tarjeta.numero != null ? nro(tarjeta.numero) : ""}</div>
          </div>
          <table className="pc-tabla">
            <tbody>
              <tr><td className="pc-label">Fecha</td><td>{new Date(tarjeta.fecha).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</td></tr>
              <tr><td className="pc-label">Estado</td><td>{ESTADO_STYLE[tarjeta.estado]?.label || tarjeta.estado}</td></tr>
              <tr><td className="pc-label">Ferretería</td><td>{tarjeta.proveedor || "—"}</td></tr>
              <tr><td className="pc-label">Retira</td><td>{tarjeta.retirado_por || "—"}</td></tr>
              {tarjeta.observaciones && <tr><td className="pc-label">Observaciones</td><td>{tarjeta.observaciones}</td></tr>}
              <tr>
                <td className="pc-label">Artículos</td>
                <td>
                  {itemsTarjeta.length > 0 ? (
                    <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                      <thead><tr style={{ textAlign: "left", color: "#6B6558" }}><th style={{ padding: "4px 0" }}>Cant.</th><th>Artículo</th></tr></thead>
                      <tbody>
                        {itemsTarjeta.map((i) => (
                          <tr key={i.id} style={{ borderTop: "1px solid #E4DFD3" }}>
                            <td style={{ padding: "4px 0" }}>{i.cantidad} {i.unidad}</td>
                            <td>{i.descripcion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : "—"}
                </td>
              </tr>
              <tr><td className="pc-label">Registrado por</td><td>{tarjeta.usuario_email || "—"}</td></tr>
            </tbody>
          </table>
          <div style={{ display: "flex", gap: "32px", marginTop: "48px", fontSize: "12px", color: "#6B6558" }}>
            <div style={{ flex: 1, borderTop: "1px solid #1C1F1C", paddingTop: "4px", textAlign: "center" }}>Firma quien retira</div>
            <div style={{ flex: 1, borderTop: "1px solid #1C1F1C", paddingTop: "4px", textAlign: "center" }}>Firma ferretería</div>
          </div>
          <div className="pc-footer">Powered by Aresa</div>
        </div>
      )}
    </>
  );
}

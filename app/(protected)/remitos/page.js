"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Truck, Download, Printer, Pencil, Trash2, Plus, X, FileText } from "lucide-react";
import { DocPrint, DocGrid, DocTabla, DocFila, DocNota, DocFirmas } from "../../../components/DocPrint";

const emptyForm = { cliente: "", destino: "", transporte: "", chofer: "", observaciones: "" };
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
  return n != null ? "R-" + String(n).padStart(4, "0") : null;
}

export default function RemitosPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const puedeAcceder = rol === "admin" || rol === "subadmin";

  const [remitos, setRemitos] = useState([]);
  const [itemsPorRemito, setItemsPorRemito] = useState({});
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
      supabase.from("remitos").select("*").order("fecha", { ascending: false }),
      supabase.from("remito_items").select("*"),
    ]);
    if (error) setError(error.message);
    else setRemitos(data || []);
    if (errItems) setError(errItems.message);
    else {
      const mapa = {};
      (items || []).forEach((fila) => {
        (mapa[fila.remito_id] = mapa[fila.remito_id] || []).push(fila);
      });
      setItemsPorRemito(mapa);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && !puedeAcceder) router.replace("/ingreso-egreso");
  }, [rol, puedeAcceder, router]);

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

  function abrirEditar(r) {
    setEditandoId(r.id);
    setForm({
      cliente: r.cliente || "",
      destino: r.destino || "",
      transporte: r.transporte || "",
      chofer: r.chofer || "",
      observaciones: r.observaciones || "",
    });
    const items = itemsPorRemito[r.id] || [];
    setFormItems(
      items.length > 0
        ? items.map((i) => ({ key: `saved-${i.id}`, descripcion: i.descripcion || "", cantidad: i.cantidad != null ? String(i.cantidad) : "", unidad: i.unidad || "unid" }))
        : [emptyItem()]
    );
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault();
    if (enviando) return;
    setError(null);

    if (!form.cliente.trim()) {
      setError("El cliente es obligatorio.");
      return;
    }
    const itemsValidos = formItems
      .map((i) => ({ descripcion: i.descripcion.trim(), cantidad: Number(i.cantidad), unidad: i.unidad.trim() || "unid" }))
      .filter((i) => i.descripcion || i.cantidad > 0);
    if (itemsValidos.length === 0) {
      setError("Agregá al menos un ítem con descripción.");
      return;
    }
    for (const i of itemsValidos) {
      if (!i.descripcion) {
        setError("Todos los ítems tienen que tener descripción.");
        return;
      }
      if (!i.cantidad || i.cantidad <= 0) {
        setError("La cantidad de cada ítem tiene que ser mayor a 0.");
        return;
      }
    }

    setEnviando(true);
    const payload = {
      cliente: form.cliente.trim(),
      destino: form.destino.trim() || null,
      transporte: form.transporte.trim() || null,
      chofer: form.chofer.trim() || null,
      observaciones: form.observaciones.trim() || null,
    };

    let remitoId = editandoId;
    let error;
    if (editandoId) {
      ({ error } = await supabase.from("remitos").update(payload).eq("id", editandoId));
      if (!error) {
        ({ error } = await supabase.from("remito_items").delete().eq("remito_id", editandoId));
      }
    } else {
      const { data: nuevo, error: errIns } = await supabase
        .from("remitos")
        .insert({ ...payload, usuario_email: session?.user?.email || null })
        .select("id")
        .single();
      error = errIns;
      if (!error) remitoId = nuevo.id;
    }

    if (!error) {
      const { error: errItems } = await supabase.from("remito_items").insert(
        itemsValidos.map((i) => ({ remito_id: remitoId, descripcion: i.descripcion, cantidad: i.cantidad, unidad: i.unidad }))
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
    setConfirmacion(editandoId ? "Remito actualizado" : "Remito registrado");
    setTimeout(() => setConfirmacion(null), 3000);
    cargar();
  }

  async function eliminarRemito() {
    if (!confirmarEliminar) return;
    const { error } = await supabase.from("remitos").delete().eq("id", confirmarEliminar.id);
    if (error) {
      setError(error.message);
      setConfirmarEliminar(null);
      return;
    }
    setConfirmarEliminar(null);
    setConfirmacion("Remito eliminado");
    setTimeout(() => setConfirmacion(null), 2500);
    cargar();
  }

  function imprimirRemito(r) {
    setTarjeta(r);
    const tituloOriginal = document.title;
    const nombreCliente = (r.cliente || "sin-cliente").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-");
    document.title = `Remito-${r.numero != null ? nro(r.numero) : r.id}-${nombreCliente}`;
    function restaurarTitulo() {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurarTitulo);
    }
    window.addEventListener("afterprint", restaurarTitulo);
    setTimeout(() => window.print(), 100);
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = remitos.map((r) => ({
      "N°": nro(r.numero) || "",
      Fecha: new Date(r.fecha).toLocaleString("es-MX"),
      Cliente: r.cliente || "",
      Destino: r.destino || "",
      Transporte: r.transporte || "",
      Chofer: r.chofer || "",
      Ítems: (itemsPorRemito[r.id] || []).map((i) => `${i.descripcion} x${i.cantidad} ${i.unidad}`).join(" | "),
      Observaciones: r.observaciones || "",
      Usuario: r.usuario_email || "",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Remitos");
    XLSX.writeFile(libro, `remitos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rol && !puedeAcceder) return null;

  const itemsTarjeta = tarjeta ? itemsPorRemito[tarjeta.id] || [] : [];

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Truck size={20} color="#F4791E" />
          <h1 className="font-display text-3xl font-semibold">Remitos</h1>
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
              Editando remito existente
              <button type="button" onClick={abrirNuevo} className="text-[#3B5166] hover:underline flex items-center gap-1">
                <X size={13} /> Cancelar edición
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Cliente">
              <input className={inputCls} value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Ej. Bunge Tancacha" />
            </Field>
            <Field label="Destino">
              <input className={inputCls} value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} placeholder="Ej. Planta Tancacha" />
            </Field>
            <Field label="Transporte">
              <input className={inputCls} value={form.transporte} onChange={(e) => setForm({ ...form, transporte: e.target.value })} placeholder="Ej. Camión patente AB123CD" />
            </Field>
            <Field label="Chofer">
              <input className={inputCls} value={form.chofer} onChange={(e) => setForm({ ...form, chofer: e.target.value })} placeholder="Ej. Juan Pérez" />
            </Field>
          </div>

          <Field label="Observaciones (opcional)">
            <input className={inputCls} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Ej. Entregar en horario de mañana" />
          </Field>

          <div className="border-t border-[#EFEBE0] pt-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wide text-[#6B6558]">Ítems del remito ({formItems.length})</p>
              <button type="button" onClick={agregarItem} className="inline-flex items-center gap-1 text-sm text-[#3B5166] hover:underline">
                <Plus size={14} /> Agregar ítem
              </button>
            </div>
            <ul className="space-y-2 mb-1">
              {formItems.map((it) => (
                <li key={it.key} className="flex items-end gap-2 bg-[#F7F4EC] rounded-sm px-3 py-2">
                  <label className="block flex-1 min-w-0">
                    <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Descripción</span>
                    <input className={inputCls + " !py-1.5"} value={it.descripcion} onChange={(e) => cambiarItem(it.key, "descripcion", e.target.value)} placeholder="Ej. Soportes metálicos" />
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
            {enviando ? "Guardando..." : editandoId ? "Guardar cambios" : "Registrar remito"}
          </button>
        </form>

        <div className="w-full">
          <h2 className="font-display text-xl font-semibold text-ink mb-3">Historial de remitos</h2>

          {/* Móvil: tarjetas */}
          <div className="sm:hidden space-y-3">
            {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
            {!loading &&
              remitos.map((r) => (
                <div key={r.id} className="bg-white border border-line rounded-sm p-4">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {r.numero != null && (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-ink text-paper">{nro(r.numero)}</span>
                    )}
                    <span className="font-mono text-xs text-[#6B6558]">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <div className="font-medium leading-snug">{r.cliente || "Sin cliente"}</div>
                  {r.destino && <p className="text-sm text-[#4A463D] mt-0.5">Destino: {r.destino}</p>}
                  <p className="text-xs text-[#6B6558] mt-1">{(itemsPorRemito[r.id] || []).length} ítem(es)</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => abrirEditar(r)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                      <Pencil size={15} /> Editar
                    </button>
                    <button onClick={() => imprimirRemito(r)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                      <Printer size={15} /> Imprimir
                    </button>
                    <button onClick={() => setConfirmarEliminar(r)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-[#C7522A]">
                      <Trash2 size={15} /> Eliminar
                    </button>
                  </div>
                </div>
              ))}
            {!loading && remitos.length === 0 && <p className="text-center text-sm text-[#8A8578] py-8">Aún no hay remitos</p>}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Destino</th>
                  <th className="px-4 py-3 font-medium">Ítems</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8578]">Cargando...</td></tr>}
                {!loading && remitos.map((r, idx) => (
                  <tr key={r.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== remitos.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{r.numero != null ? nro(r.numero) : "—"}</td>
                    <td className="px-4 py-3 text-[#6B6558] font-mono whitespace-nowrap">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-3 text-[#4A463D] whitespace-nowrap">{r.cliente || "—"}</td>
                    <td className="px-4 py-3 text-[#4A463D]">{r.destino || "—"}</td>
                    <td className="px-4 py-3 text-[#4A463D] max-w-xs truncate">
                      {(itemsPorRemito[r.id] || []).map((i) => `${i.descripcion} x${i.cantidad}`).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => abrirEditar(r)} className="text-[#4A4B4D] hover:opacity-70" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => imprimirRemito(r)} className="text-[#4A4B4D] hover:opacity-70" title="Imprimir remito">
                          <Printer size={15} />
                        </button>
                        <button onClick={() => setConfirmarEliminar(r)} className="text-[#C7522A] hover:text-red" title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && remitos.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8A8578]">Aún no hay remitos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmarEliminar(null)}>
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold mb-2">Eliminar remito</h3>
            <p className="text-sm text-[#4A463D] mb-4">
              ¿Eliminar el remito <b>{confirmarEliminar.numero != null ? nro(confirmarEliminar.numero) : ""}</b> de <b>{confirmarEliminar.cliente || "sin cliente"}</b>? También se quitan sus ítems.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmarEliminar(null)} className="px-4 py-2 border border-line rounded-sm text-sm text-ink hover:bg-[#F2EEE3]">
                Cancelar
              </button>
              <button onClick={eliminarRemito} className="px-4 py-2 bg-[#C7522A] text-white rounded-sm text-sm font-medium hover:bg-red">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {tarjeta && (
        <DocPrint titulo="Remito" numero={tarjeta.numero != null ? nro(tarjeta.numero) : null}>
          <DocGrid
            datos={[
              { label: "Fecha", valor: new Date(tarjeta.fecha).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) },
              { label: "Registrado por", valor: tarjeta.usuario_email || "—" },
              { label: "Cliente", valor: tarjeta.cliente || "—" },
              { label: "Destino", valor: tarjeta.destino || "—" },
              { label: "Transporte", valor: tarjeta.transporte || "—" },
              { label: "Chofer", valor: tarjeta.chofer || "—" },
            ]}
          />
          <DocNota label="Observaciones" texto={tarjeta.observaciones} />
          <DocTabla head={[{ label: "Cant." }, { label: "Descripción" }]}>
            {itemsTarjeta.map((i, idx) => (
              <DocFila
                key={i.id}
                zebra={idx % 2 === 1}
                celdas={[{ valor: `${i.cantidad} ${i.unidad}` }, { valor: i.descripcion }]}
              />
            ))}
          </DocTabla>
          <DocFirmas izq="Firma receptor" der="Aclaración" />
        </DocPrint>
      )}
    </>
  );
}

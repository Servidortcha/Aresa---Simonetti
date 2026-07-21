"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { ArrowRightLeft, ArrowDownCircle, ArrowUpCircle, CheckCircle2, History } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function IngresoEgresoPage() {
  const { rol, session } = useAuth();
  const soloEgreso = rol === "operario" || rol === "taller_stock";
  const esAdmin = rol === "admin";
  const [insumos, setInsumos] = useState([]);
  const [depositoSel, setDepositoSel] = useState("Principal");
  const [confirmacion, setConfirmacion] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ insumoId: "", tipo: "entrada", cantidad: "", producto: "", nota: "" });
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(true);

  const insumosVisibles = esAdmin ? insumos.filter((i) => i.deposito === depositoSel) : insumos;

  async function cargarHistorial() {
    setHistorialLoading(true);
    let query = supabase
      .from("movimientos")
      .select("id, tipo, cantidad, fecha, producto_texto, insumos!inner(nombre, unidad, deposito)")
      .order("fecha", { ascending: false })
      .limit(8);
    if (!esAdmin) query = query.eq("insumos.deposito", "Principal");
    if (soloEgreso) query = query.eq("tipo", "salida");
    const { data } = await query;
    setHistorial(data || []);
    setHistorialLoading(false);
  }

  useEffect(() => {
    cargarHistorial();
  }, [esAdmin, soloEgreso]);

  useEffect(() => {
    if (soloEgreso) setForm((f) => (f.tipo === "salida" ? f : { ...f, tipo: "salida" }));
  }, [soloEgreso]);

  useEffect(() => {
    setForm((f) => ({ ...f, insumoId: "" }));
  }, [depositoSel]);

  useEffect(() => {
    async function load() {
      const { data: i } = await supabase.from("insumos").select("*").order("nombre");
      const visibles = rol === "admin" ? (i || []) : (i || []).filter((x) => x.deposito === "Principal");
      setInsumos(visibles.filter((x) => x.activo !== false));
    }
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const insumo = insumos.find((i) => i.id === Number(form.insumoId));
    const cant = Number(form.cantidad);
    if (!insumo || !cant) return;

    // 1. Registrar el movimiento (fecha y hora quedan automáticas por default de la base de datos)
    const { error: movError } = await supabase.from("movimientos").insert({
      insumo_id: insumo.id,
      tipo: form.tipo,
      cantidad: cant,
      producto_texto: form.tipo === "salida" ? form.producto || null : null,
      nota: form.nota || null,
      usuario_email: session?.user?.email || null,
    });
    if (movError) {
      setError(movError.message);
      return;
    }

    // 2. Actualizar el stock del insumo
    const nuevoStock = form.tipo === "entrada" ? insumo.stock + cant : insumo.stock - cant;
    const { error: stockError } = await supabase.from("insumos").update({ stock: nuevoStock }).eq("id", insumo.id);
    if (stockError) {
      setError(stockError.message);
      return;
    }

    setInsumos((prev) => prev.map((i) => (i.id === insumo.id ? { ...i, stock: nuevoStock } : i)));
    setConfirmacion(`${form.tipo === "entrada" ? "Entrada" : "Salida"} de ${cant} ${insumo.unidad} registrada para ${insumo.nombre}`);
    setForm({ insumoId: "", tipo: "entrada", cantidad: "", producto: "", nota: "" });
    setTimeout(() => setConfirmacion(null), 3500);
    cargarHistorial();
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <ArrowRightLeft size={20} color="#F4791E" />
        <h1 className="font-display text-3xl font-semibold">Registrar ingreso o egreso</h1>
      </div>

      {confirmacion && (
        <div className="flex items-center gap-2 bg-[#EAF0E4] border border-[#B9CBA9] text-[#3D5A2E] text-sm px-4 py-3 rounded-sm mb-5 max-w-lg">
          <CheckCircle2 size={16} /> {confirmacion}
        </div>
      )}
      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <form onSubmit={submit} className="bg-white border border-line rounded-sm p-4 sm:p-6 w-full max-w-lg">
          {esAdmin && (
            <Field label="Stock">
              <div className="flex gap-2">
                {["Principal", "Pañol"].map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDepositoSel(d)}
                    className="flex-1 py-2 rounded-sm text-sm font-medium border transition-colors"
                    style={{
                      backgroundColor: depositoSel === d ? "#4A4B4D" : "white",
                      color: depositoSel === d ? "white" : "#1C1F1C",
                      borderColor: depositoSel === d ? "transparent" : "#D8D2C4",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="Insumo">
            <select className={inputCls} value={form.insumoId} onChange={(e) => setForm({ ...form, insumoId: e.target.value })} required>
              <option value="">— Seleccionar insumo —</option>
              {insumosVisibles.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}{rol === "taller_stock" ? "" : ` (stock: ${i.stock} ${i.unidad})`}</option>
              ))}
            </select>
          </Field>

          <Field label="Tipo">
            <div className="flex gap-2">
              {(soloEgreso ? ["salida"] : ["entrada", "salida"]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm({ ...form, tipo: t })}
                  className="flex-1 py-2 rounded-sm text-sm font-medium border transition-colors"
                  style={{
                    backgroundColor: form.tipo === t ? (t === "entrada" ? "#4B7355" : "#C7522A") : "white",
                    color: form.tipo === t ? "white" : "#1C1F1C",
                    borderColor: form.tipo === t ? "transparent" : "#D8D2C4",
                  }}
                >
                  {t === "entrada" ? (
                    <span className="inline-flex items-center gap-1.5"><ArrowDownCircle size={14} /> Ingreso</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5"><ArrowUpCircle size={14} /> Egreso</span>
                  )}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Cantidad">
            <input type="number" className={inputCls} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
          </Field>

          {form.tipo === "salida" && (
            <Field label="Usado en (producto)">
              <input className={inputCls} value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} placeholder="Ej. Panel solar tipo A" />
            </Field>
          )}

          <Field label={form.tipo === "salida" ? "Retirado por (nombre y apellido)" : "Nota (opcional)"}>
            <input
              className={inputCls}
              value={form.nota}
              onChange={(e) => setForm({ ...form, nota: e.target.value })}
              placeholder={form.tipo === "salida" ? "Ej. Juan Pérez" : "Ej. Compra mensual"}
              required={form.tipo === "salida"}
            />
          </Field>

          <button type="submit" className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731]">
            Registrar {form.tipo === "entrada" ? "ingreso" : "egreso"}
          </button>
        </form>

        <div className="bg-white border border-line rounded-sm p-4 w-full lg:w-72 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-[#4A463D]">
            <History size={14} color="#F4791E" /> Últimos movimientos
          </div>
          {historialLoading && <p className="text-xs text-[#8A8578]">Cargando...</p>}
          {!historialLoading && historial.length === 0 && <p className="text-xs text-[#8A8578]">Sin movimientos aún</p>}
          <ul className="space-y-3">
            {historial.map((m) => (
              <li key={m.id} className="text-xs border-b border-[#EFEBE0] last:border-0 pb-2 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink truncate pr-2">{m.insumos?.nombre}</span>
                  <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ color: m.tipo === "entrada" ? "#4B7355" : "#C7522A" }}>
                    {m.tipo === "entrada" ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
                    {m.cantidad} {m.insumos?.unidad}
                  </span>
                </div>
                <div className="text-[#8A8578] mt-0.5">
                  {new Date(m.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                  {m.producto_texto && <> · {m.producto_texto}</>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { ArrowRightLeft, ArrowDownCircle, ArrowUpCircle, CheckCircle2, History, Plus, Trash2 } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

const lineaVacia = () => ({ key: Date.now() + Math.random(), insumoId: "", tipo: "entrada", cantidad: "", producto: "", nota: "", fabricacionId: "" });

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
  const [tipoGeneral, setTipoGeneral] = useState("entrada");
  const [lineas, setLineas] = useState([lineaVacia()]);
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [fabricacionesAbiertas, setFabricacionesAbiertas] = useState([]);

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
    setLineas((prev) => prev.map((l) => ({ ...l, insumoId: "" })));
  }, [depositoSel]);

  useEffect(() => {
    if (soloEgreso) setTipoGeneral("salida");
  }, [soloEgreso]);

  function cambiarLinea(key, campo, valor) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, lineaVacia()]);
  }

  function quitarLinea(key) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  useEffect(() => {
    supabase.from("fabricaciones").select("id, nombre").eq("estado", "abierta").order("fecha_apertura").then(({ data }) => {
      setFabricacionesAbiertas(data || []);
    });
  }, []);

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
    if (enviando) return;

    const validas = [];
    for (const l of lineas) {
      const insumo = insumos.find((i) => i.id === Number(l.insumoId));
      const cant = Number(l.cantidad);
      if (!l.insumoId || !insumo) {
        setError("Completá todas las líneas: elegí el insumo en cada una.");
        return;
      }
      if (!cant || cant <= 0) {
        setError("La cantidad de cada línea tiene que ser un número mayor a 0.");
        return;
      }
      if (l.tipo === "salida" && cant > insumo.stock) {
        setError(`No hay suficiente stock de ${insumo.nombre}: quedan ${insumo.stock} ${insumo.unidad}.`);
        return;
      }
      if (l.tipo === "salida" && !l.nota.trim()) {
        setError("En cada egreso falta indicar quién retira el insumo.");
        return;
      }
      if (l.tipo === "entrada" && rol !== "admin") {
        setError("Solo el administrador puede registrar ingresos.");
        return;
      }
      validas.push({ l, insumo, cant });
    }

    setEnviando(true);
    let okCount = 0;
    let errorMsg = null;

    for (const { l, insumo, cant } of validas) {
      const fabricacionSel = l.fabricacionId ? fabricacionesAbiertas.find((f) => String(f.id) === String(l.fabricacionId)) : null;
      const { data, error: err } = await supabase.rpc("registrar_movimiento_insumo", {
        p_insumo_id: insumo.id,
        p_tipo: l.tipo,
        p_cantidad: cant,
        p_producto_texto: l.tipo === "salida" ? (fabricacionSel ? fabricacionSel.nombre : l.producto || null) : null,
        p_nota: l.nota || null,
        p_usuario_email: session?.user?.email || null,
        p_fabricacion_id: l.tipo === "salida" && fabricacionSel ? fabricacionSel.id : null,
      });
      const resultado = data?.[0];
      if (err || !resultado?.ok) {
        errorMsg = errorMsg || (err?.message || resultado?.mensaje || `No se pudo registrar ${insumo.nombre}.`);
      } else {
        okCount++;
        setInsumos((prev) => prev.map((i) => (i.id === insumo.id ? { ...i, stock: resultado.nuevo_stock } : i)));
      }
    }

    setEnviando(false);
    if (okCount > 0) {
      setConfirmacion(`${okCount} movimiento${okCount !== 1 ? "s" : ""} registrado${okCount !== 1 ? "s" : ""}`);
      setTimeout(() => setConfirmacion(null), 3500);
      setLineas([lineaVacia()]);
      cargarHistorial();
    }
    if (errorMsg) setError(errorMsg);
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
        <form onSubmit={submit} className="bg-white border border-line rounded-sm p-4 sm:p-6 w-full max-w-2xl">
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

          <Field label="Tipo de movimiento">
            <div className="flex gap-2">
              {(soloEgreso ? ["salida"] : ["entrada", "salida"]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTipoGeneral(t)}
                  className="flex-1 py-2 rounded-sm text-sm font-medium border transition-colors"
                  style={{
                    backgroundColor: tipoGeneral === t ? (t === "entrada" ? "#4B7355" : "#C7522A") : "white",
                    color: tipoGeneral === t ? "white" : "#1C1F1C",
                    borderColor: tipoGeneral === t ? "transparent" : "#D8D2C4",
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

          <div className="border-t border-[#EFEBE0] pt-4 mt-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-[#6B6558]">Productos ({lineas.length})</p>
              <button
                type="button"
                onClick={agregarLinea}
                className="inline-flex items-center gap-1 text-sm text-[#3B5166] hover:underline"
              >
                <Plus size={14} /> Agregar producto
              </button>
            </div>

            {lineas.map((l) => (
              <div key={l.key} className="border border-[#EFEBE0] rounded-sm p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wide text-[#8A8578]">Producto</span>
                  <button type="button" onClick={() => quitarLinea(l.key)} className="text-[#C7522A] hover:text-red p-0.5" title="Quitar producto">
                    <Trash2 size={14} />
                  </button>
                </div>

                <Field label="Insumo">
                  <select className={inputCls} value={l.insumoId} onChange={(e) => cambiarLinea(l.key, "insumoId", e.target.value)} required>
                    <option value="">— Seleccionar insumo —</option>
                    {insumosVisibles.map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre}{rol === "taller_stock" ? "" : ` (stock: ${i.stock} ${i.unidad})`}</option>
                    ))}
                  </select>
                </Field>

                {esAdmin && (
                  <Field label="Tipo de esta línea">
                    <div className="flex gap-2">
                      {["entrada", "salida"].map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => cambiarLinea(l.key, "tipo", t)}
                          className="flex-1 py-1.5 rounded-sm text-sm font-medium border transition-colors"
                          style={{
                            backgroundColor: l.tipo === t ? (t === "entrada" ? "#4B7355" : "#C7522A") : "white",
                            color: l.tipo === t ? "white" : "#1C1F1C",
                            borderColor: l.tipo === t ? "transparent" : "#D8D2C4",
                          }}
                        >
                          {t === "entrada" ? "Ingreso" : "Egreso"}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                <Field label="Cantidad">
                  <input type="number" className={inputCls} value={l.cantidad} onChange={(e) => cambiarLinea(l.key, "cantidad", e.target.value)} required />
                </Field>

                {l.tipo === "salida" && (
                  <>
                    <Field label="Fabricación abierta (opcional)">
                      <select className={inputCls} value={l.fabricacionId} onChange={(e) => cambiarLinea(l.key, "fabricacionId", e.target.value)}>
                        <option value="">— Sin vincular —</option>
                        {fabricacionesAbiertas.map((f) => (
                          <option key={f.id} value={f.id}>{f.nombre}</option>
                        ))}
                      </select>
                      {fabricacionesAbiertas.length === 0 && (
                        <p className="text-[10px] text-[#8A8578] mt-1">No hay fabricaciones abiertas.</p>
                      )}
                    </Field>
                    {!l.fabricacionId && (
                      <Field label="Usado en (producto)">
                        <input className={inputCls} value={l.producto} onChange={(e) => cambiarLinea(l.key, "producto", e.target.value)} placeholder="Ej. Panel solar tipo A" />
                      </Field>
                    )}
                  </>
                )}

                <Field label={l.tipo === "salida" ? "Retirado por (nombre y apellido)" : "Nota (opcional)"}>
                  <input
                    className={inputCls}
                    value={l.nota}
                    onChange={(e) => cambiarLinea(l.key, "nota", e.target.value)}
                    placeholder={l.tipo === "salida" ? "Ej. Juan Pérez" : "Ej. Compra mensual"}
                    required={l.tipo === "salida"}
                  />
                </Field>
              </div>
            ))}
          </div>

          <button type="submit" disabled={enviando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            {enviando ? "Guardando..." : `Registrar ${tipoGeneral === "entrada" ? "los ingresos" : "los egresos"} (${lineas.length})`}
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

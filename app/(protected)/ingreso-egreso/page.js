"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { ArrowRightLeft, ArrowDownCircle, ArrowUpCircle, CheckCircle2, History, Plus, Trash2, ListChecks, Check, X } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

const itemVacio = () => ({ key: Date.now() + Math.random(), insumoId: "", tipo: "entrada", cantidad: "", producto: "", nota: "", fabricacionId: "" });

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

function BtnTipo({ activo, tipo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-2 rounded-sm text-sm font-medium border transition-colors"
      style={{
        backgroundColor: activo ? (tipo === "entrada" ? "#4B7355" : "#C7522A") : "white",
        color: activo ? "white" : "#1C1F1C",
        borderColor: activo ? "transparent" : "#D8D2C4",
      }}
    >
      {children}
    </button>
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

  // Formulario de captura de un solo ítem
  const [item, setItem] = useState(itemVacio());
  // Lista de ítems cargados, listos para confirmar
  const [lista, setLista] = useState([]);
  const [editandoKey, setEditandoKey] = useState(null);

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
    setItem((prev) => ({ ...prev, insumoId: "" }));
  }, [depositoSel]);

  useEffect(() => {
    if (soloEgreso) setItem((prev) => ({ ...prev, tipo: "salida" }));
  }, [soloEgreso]);

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

  function insumoDe(itemRef) {
    return insumos.find((i) => i.id === Number(itemRef.insumoId));
  }

  // ---- Paso 1: validar y agregar un ítem a la lista ----
  function agregarALista() {
    setError(null);
    const insumo = insumoDe(item);
    const cant = Number(item.cantidad);
    if (!item.insumoId || !insumo) {
      setError("Elegí el insumo.");
      return;
    }
    if (!cant || cant <= 0) {
      setError("La cantidad tiene que ser un número mayor a 0.");
      return;
    }
    if (item.tipo === "salida" && cant > insumo.stock) {
      setError(`No hay suficiente stock de ${insumo.nombre}: quedan ${insumo.stock} ${insumo.unidad}.`);
      return;
    }
    if (item.tipo === "salida" && !item.nota.trim()) {
      setError("En un egreso falta indicar quién retira el insumo.");
      return;
    }
    if (item.tipo === "entrada" && !esAdmin) {
      setError("Solo el administrador puede registrar ingresos.");
      return;
    }

    const nuevoItem = { ...item, key: Date.now() + Math.random() };
    if (editandoKey) {
      setLista((prev) => prev.map((l) => (l.key === editandoKey ? nuevoItem : l)));
      setEditandoKey(null);
    } else {
      setLista((prev) => [...prev, nuevoItem]);
    }
    setItem(itemVacio());
    setItem((prev) => ({ ...prev, tipo: soloEgreso ? "salida" : item.tipo }));
  }

  function quitarDeLista(key) {
    setLista((prev) => prev.filter((l) => l.key !== key));
    if (editandoKey === key) setEditandoKey(null);
  }

  function editarDeLista(l) {
    setEditandoKey(l.key);
    setItem({ ...l });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicion() {
    setEditandoKey(null);
    setItem(itemVacio());
    setItem((prev) => ({ ...prev, tipo: soloEgreso ? "salida" : prev.tipo }));
  }

  // ---- Paso 2: confirmar toda la lista ----
  async function confirmarLista() {
    setError(null);
    if (enviando) return;
    if (lista.length === 0) {
      setError("No hay nada cargado en la lista para confirmar.");
      return;
    }

    setEnviando(true);
    let okCount = 0;
    let errorMsg = null;

    for (const l of lista) {
      const insumo = insumoDe(l);
      if (!insumo) continue;
      const fabricacionSel = l.fabricacionId ? fabricacionesAbiertas.find((f) => String(f.id) === String(l.fabricacionId)) : null;
      const { data, error: err } = await supabase.rpc("registrar_movimiento_insumo", {
        p_insumo_id: insumo.id,
        p_tipo: l.tipo,
        p_cantidad: Number(l.cantidad),
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
      setConfirmacion(`${okCount} movimiento${okCount !== 1 ? "s" : ""} confirmado${okCount !== 1 ? "s" : ""}`);
      setTimeout(() => setConfirmacion(null), 3500);
      setLista([]);
      setEditandoKey(null);
      setItem(itemVacio());
      setItem((prev) => ({ ...prev, tipo: soloEgreso ? "salida" : prev.tipo }));
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
        {/* Formulario de captura */}
        <div className="w-full max-w-2xl">
          <div className="bg-white border border-line rounded-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">{editandoKey ? "Editar producto de la lista" : "Cargar producto"}</h2>
              {editandoKey && (
                <button onClick={cancelarEdicion} className="inline-flex items-center gap-1 text-sm text-[#3B5166] hover:underline">
                  <X size={14} /> Cancelar edición
                </button>
              )}
            </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Field label="Tipo de movimiento">
                <div className="flex gap-2">
                  {(soloEgreso ? ["salida"] : ["entrada", "salida"]).map((t) => (
                    <BtnTipo key={t} activo={item.tipo === t} tipo={t} onClick={() => setItem({ ...item, tipo: t })}>
                      {t === "entrada" ? (
                        <span className="inline-flex items-center gap-1.5"><ArrowDownCircle size={14} /> Ingreso</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5"><ArrowUpCircle size={14} /> Egreso</span>
                      )}
                    </BtnTipo>
                  ))}
                </div>
              </Field>
              <Field label="Insumo">
                <select className={inputCls} value={item.insumoId} onChange={(e) => setItem({ ...item, insumoId: e.target.value })}>
                  <option value="">— Seleccionar insumo —</option>
                  {insumosVisibles.map((i) => (
                    <option key={i.id} value={i.id}>{i.nombre}{rol === "taller_stock" ? "" : ` (stock: ${i.stock} ${i.unidad})`}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Cantidad">
              <input type="number" className={inputCls + " max-w-[160px]"} value={item.cantidad} onChange={(e) => setItem({ ...item, cantidad: e.target.value })} />
            </Field>

            {item.tipo === "salida" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <Field label="Fabricación abierta (opcional)">
                  <select className={inputCls} value={item.fabricacionId} onChange={(e) => setItem({ ...item, fabricacionId: e.target.value })}>
                    <option value="">— Sin vincular —</option>
                    {fabricacionesAbiertas.map((f) => (
                      <option key={f.id} value={f.id}>{f.nombre}</option>
                    ))}
                  </select>
                  {fabricacionesAbiertas.length === 0 && (
                    <p className="text-[10px] text-[#8A8578] mt-1">No hay fabricaciones abiertas.</p>
                  )}
                </Field>
                {!item.fabricacionId && (
                  <Field label="Usado en (producto)">
                    <input className={inputCls} value={item.producto} onChange={(e) => setItem({ ...item, producto: e.target.value })} placeholder="Ej. Panel solar tipo A" />
                  </Field>
                )}
              </div>
            )}

            <Field label={item.tipo === "salida" ? "Retirado por (nombre y apellido)" : "Nota (opcional)"}>
              <input
                className={inputCls}
                value={item.nota}
                onChange={(e) => setItem({ ...item, nota: e.target.value })}
                placeholder={item.tipo === "salida" ? "Ej. Juan Pérez" : "Ej. Compra mensual"}
              />
            </Field>

            <button
              type="button"
              onClick={agregarALista}
              className="w-full mt-1 inline-flex items-center justify-center gap-1.5 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] transition-colors"
            >
              <Plus size={16} /> {editandoKey ? "Guardar cambios en la lista" : "Agregar a la lista"}
            </button>
          </div>

          {/* Lista de productos cargados */}
          <div className="bg-white border border-line rounded-sm p-4 sm:p-6 mt-4">
            <div className="flex items-center gap-1.5 mb-3">
              <ListChecks size={16} color="#F4791E" />
              <h2 className="font-display text-lg font-semibold">Lista para confirmar</h2>
              <span className="ml-auto text-xs text-[#6B6558]">{lista.length} producto{lista.length !== 1 ? "s" : ""}</span>
            </div>

            {lista.length === 0 && (
              <p className="text-sm text-[#8A8578] py-4 text-center">Todavía no cargaste productos. Agregalos arriba y van apareciendo acá.</p>
            )}

            <ul className="space-y-2 mb-4">
              {lista.map((l) => {
                const insumo = insumoDe(l);
                const fabricacionSel = l.fabricacionId ? fabricacionesAbiertas.find((f) => String(f.id) === String(l.fabricacionId)) : null;
                return (
                  <li key={l.key} className="flex items-center justify-between gap-3 bg-[#F7F4EC] rounded-sm px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-[#4A463D] truncate">{insumo?.nombre || "—"}</div>
                      <div className="text-[10px] uppercase tracking-wide text-[#8A8578]">
                        <span style={{ color: l.tipo === "entrada" ? "#4B7355" : "#C7522A" }}>
                          {l.tipo === "entrada" ? "Ingreso" : "Egreso"}
                        </span>
                        {" · "}{l.cantidad} {insumo?.unidad}
                        {l.tipo === "salida" && (fabricacionSel ? ` · ${fabricacionSel.nombre}` : l.producto ? ` · ${l.producto}` : "")}
                        {l.nota ? ` · ${l.nota}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => editarDeLista(l)} className="text-[#3B5166] hover:underline text-xs px-1">Editar</button>
                      <button onClick={() => quitarDeLista(l.key)} className="text-[#C7522A] hover:text-red p-1" title="Quitar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={confirmarLista}
              disabled={enviando || lista.length === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-[#4B7355] text-white py-2.5 rounded-sm text-sm font-medium hover:bg-[#3D5A2E] disabled:opacity-50 transition-colors"
            >
              <Check size={16} /> {enviando ? "Confirmando..." : `Confirmar y guardar (${lista.length})`}
            </button>
          </div>
        </div>

        {/* Historial lateral */}
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

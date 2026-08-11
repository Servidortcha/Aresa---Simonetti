"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import {
  Wallet,
  Save,
  Plus,
  X,
  CheckCircle2,
  Calculator,
  Trash2,
  Clock,
  AlertTriangle,
  ClipboardList,
  Boxes,
} from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

const HORAS_POR_DIA = 11;

function pesos(n) {
  const v = Number(n || 0);
  return "$ " + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function horasDeObra(apertura, cierre) {
  const fin = cierre ? new Date(cierre).getTime() : Date.now();
  const ms = fin - new Date(apertura).getTime();
  if (ms < 0) return 0;
  return (ms / 3600000) * (HORAS_POR_DIA / 24);
}

function lineaDeCadaUno(insumoId) {
  return { insumo_id: insumoId, nombre: "", unidad: "", estQty: 0, usadoQty: 0, peso: 0, precioKg: 0, estPesos: 0, usadoPesos: 0 };
}

function armarLineas(fab, estimadosPorFab, usadosPorFab, preciosMap) {
  const porInsumo = {};
  (estimadosPorFab[fab.id] || []).forEach((e) => {
    const l = porInsumo[e.insumo_id] || lineaDeCadaUno(e.insumo_id);
    l.nombre = e.nombre;
    l.unidad = e.unidad;
    l.estQty += Number(e.cantidad) || 0;
    porInsumo[e.insumo_id] = l;
  });
  (usadosPorFab[fab.id] || []).forEach((u) => {
    const l = porInsumo[u.insumo_id] || lineaDeCadaUno(u.insumo_id);
    l.nombre = u.nombre;
    l.unidad = u.unidad;
    l.usadoQty += Number(u.cantidad) || 0;
    porInsumo[u.insumo_id] = l;
  });
  return Object.values(porInsumo).map((l) => {
    const p = preciosMap[l.insumo_id] || {};
    l.peso = Number(p.peso_unitario_kg) || 0;
    l.precioKg = Number(p.precio_kg) || 0;
    l.estPesos = l.estQty * l.peso * l.precioKg;
    l.usadoPesos = l.usadoQty * l.peso * l.precioKg;
    return l;
  });
}

const defaultQuote = () => ({ horas: "", valor_hora: "", margen: "", otros: [], estado: "presupuesto" });

export default function PreciosPage() {
  const { rol, session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const [catalogo, setCatalogo] = useState([]);
  const [dirty, setDirty] = useState(new Set());

  const [fabricaciones, setFabricaciones] = useState([]);
  const [estimadosPorFab, setEstimadosPorFab] = useState({});
  const [usadosPorFab, setUsadosPorFab] = useState({});
  const [cotizacionesPorFab, setCotizacionesPorFab] = useState({});
  const [externosPorFab, setExternosPorFab] = useState({});
  const [quoteEdits, setQuoteEdits] = useState({});
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false);
  const [guardando, setGuardando] = useState(null);
  const [extraIds, setExtraIds] = useState([]);
  const [seleccionObra, setSeleccionObra] = useState("");

  async function cargar() {
    setLoading(true);
    const [resInsumos, resPrecios, resFab, resEst, resUsados, resCotiz, resExternos] = await Promise.all([
      supabase.from("insumos").select("id, nombre, unidad, deposito, activo").order("nombre"),
      supabase.from("precios_materiales").select("*"),
      supabase.from("fabricaciones").select("*").order("fecha_apertura", { ascending: false }),
      supabase.from("fabricacion_estimados").select("*"),
      supabase.from("fabricacion_insumos").select("*"),
      supabase.from("cotizaciones").select("*"),
      supabase.from("fabricacion_articulos_externos").select("*"),
    ]);
    const err = [resInsumos, resPrecios, resFab, resEst, resUsados, resCotiz, resExternos].find((r) => r.error);
    if (err) {
      setError(err.error.message);
      setLoading(false);
      return;
    }

    const preciosMap = {};
    (resPrecios.data || []).forEach((p) => (preciosMap[p.insumo_id] = p));

    const cat = (resInsumos.data || [])
      .filter((i) => i.activo !== false)
      .map((i) => ({
        insumo_id: i.id,
        nombre: i.nombre,
        unidad: i.unidad || "unid",
        deposito: i.deposito || "",
        peso_unitario_kg: preciosMap[i.id] ? String(preciosMap[i.id].peso_unitario_kg ?? "") : "",
        precio_kg: preciosMap[i.id] ? String(preciosMap[i.id].precio_kg ?? "") : "",
      }));
    setCatalogo(cat);
    setDirty(new Set());

    setFabricaciones(resFab.data || []);

    const estMap = {};
    const insByName = new Map((resInsumos.data || []).map((i) => [i.id, i]));
    (resEst.data || []).forEach((fila) => {
      const ins = insByName.get(fila.insumo_id);
      if (!ins) return;
      (estMap[fila.fabricacion_id] = estMap[fila.fabricacion_id] || []).push({
        id: fila.id,
        insumo_id: fila.insumo_id,
        nombre: ins.nombre,
        unidad: ins.unidad || "unid",
        cantidad: fila.cantidad,
      });
    });
    setEstimadosPorFab(estMap);

    const usadosMap = {};
    (resUsados.data || []).forEach((fila) => {
      const ins = insByName.get(fila.insumo_id);
      if (!ins) return;
      (usadosMap[fila.fabricacion_id] = usadosMap[fila.fabricacion_id] || []).push({
        id: fila.id,
        insumo_id: fila.insumo_id,
        nombre: ins.nombre,
        unidad: ins.unidad || "unid",
        cantidad: fila.cantidad,
      });
    });
    setUsadosPorFab(usadosMap);

    const cotMap = {};
    (resCotiz.data || []).forEach((c) => (cotMap[c.fabricacion_id] = c));
    setCotizacionesPorFab(cotMap);

    const extMap = {};
    (resExternos.data || []).forEach((a) => {
      (extMap[a.fabricacion_id] = extMap[a.fabricacion_id] || []).push(a);
    });
    setExternosPorFab(extMap);

    const edits = {};
    (resFab.data || []).forEach((f) => {
      const c = cotMap[f.id];
      edits[f.id] = c
        ? {
            horas: c.horas != null ? String(c.horas) : "",
            valor_hora: c.valor_hora != null ? String(c.valor_hora) : "",
            margen: c.margen_porcentaje != null ? String(c.margen_porcentaje) : "",
            otros: (c.otros_costos || []).map((o, i) => ({ _id: "otro" + i, descripcion: o.descripcion || "", monto: o.monto != null ? String(o.monto) : "" })),
            estado: c.estado || "presupuesto",
          }
        : defaultQuote();
    });
    setQuoteEdits(edits);

    setLoading(false);
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

  const preciosMap = useMemo(() => {
    const map = {};
    catalogo.forEach((c) => {
      map[c.insumo_id] = { peso_unitario_kg: Number(c.peso_unitario_kg) || 0, precio_kg: Number(c.precio_kg) || 0 };
    });
    return map;
  }, [catalogo]);

  function cambiarCatalogo(insumoId, campo, valor) {
    setCatalogo((prev) => prev.map((c) => (c.insumo_id === insumoId ? { ...c, [campo]: valor } : c)));
    setDirty((prev) => new Set(prev).add(insumoId));
  }

  async function guardarCatalogo() {
    setError(null);
    const filas = catalogo.filter((c) => dirty.has(c.insumo_id));
    if (filas.length === 0) {
      mostrarMensaje("No hay cambios en el catálogo.");
      return;
    }
    setGuardandoCatalogo(true);
    for (const c of filas) {
      const { error: err } = await supabase.from("precios_materiales").upsert(
        {
          insumo_id: c.insumo_id,
          peso_unitario_kg: Number(c.peso_unitario_kg) || 0,
          precio_kg: Number(c.precio_kg) || 0,
          usuario_email: session?.user?.email || null,
        },
        { onConflict: "insumo_id" }
      );
      if (err) {
        setError(err.message);
        setGuardandoCatalogo(false);
        return;
      }
    }
    setDirty(new Set());
    setGuardandoCatalogo(false);
    mostrarMensaje("Catálogo de precios guardado.");
  }

  function setQuote(fabId, campo, valor) {
    setQuoteEdits((prev) => ({ ...prev, [fabId]: { ...prev[fabId], [campo]: valor } }));
  }

  function setOtro(fabId, idx, campo, valor) {
    setQuoteEdits((prev) => {
      const q = prev[fabId];
      const otros = q.otros.map((o, i) => (i === idx ? { ...o, [campo]: valor } : o));
      return { ...prev, [fabId]: { ...q, otros } };
    });
  }

  function agregarOtro(fabId) {
    setQuoteEdits((prev) => {
      const q = prev[fabId];
      return { ...prev, [fabId]: { ...q, otros: [...q.otros, { _id: "otro" + Math.random().toString(36).slice(2), descripcion: "", monto: "" }] } };
    });
  }

  function quitarOtro(fabId, idx) {
    setQuoteEdits((prev) => {
      const q = prev[fabId];
      return { ...prev, [fabId]: { ...q, otros: q.otros.filter((_, i) => i !== idx) } };
    });
  }

  function usarHorasDeObra(fabId, fab) {
    const horas = horasDeObra(fab.fecha_apertura, fab.fecha_cierre);
    setQuote(fabId, "horas", String(horas.toFixed(1)));
  }

  async function guardarCotizacion(fabId) {
    setError(null);
    const q = quoteEdits[fabId];
    if (!q) return;
    const otros = (q.otros || [])
      .filter((o) => o.descripcion.trim() || Number(o.monto) > 0)
      .map((o) => ({ descripcion: o.descripcion.trim(), monto: Number(o.monto) || 0 }));
    const payload = {
      fabricacion_id: fabId,
      estado: q.estado,
      valor_hora: Number(q.valor_hora) || 0,
      horas: Number(q.horas) || 0,
      margen_porcentaje: Number(q.margen) || 0,
      otros_costos: otros,
      usuario_email: session?.user?.email || null,
    };
    setGuardando(fabId);
    const existing = cotizacionesPorFab[fabId];
    const { error: err } = existing
      ? await supabase.from("cotizaciones").update(payload).eq("id", existing.id)
      : await supabase.from("cotizaciones").insert(payload);
    setGuardando(null);
    if (err) {
      setError(err.message);
      return;
    }
    mostrarMensaje("Cotización guardada.");
    cargar();
  }

  function agregarObraExtra() {
    if (!seleccionObra) return;
    const id = Number(seleccionObra);
    setExtraIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSeleccionObra("");
  }

  function quitarObraExtra(id) {
    setExtraIds((prev) => prev.filter((x) => x !== id));
  }

  if (rol && rol !== "admin") return null;

  function TarjetaCotizacion({ fab, extra }) {
    const lines = armarLineas(fab, estimadosPorFab, usadosPorFab, preciosMap);
    const externosF = externosPorFab[fab.id] || [];
    const externosTotal = externosF.reduce((a, x) => a + (Number(x.cantidad) || 0) * (Number(x.valor_unitario) || 0), 0);
    const q = quoteEdits[fab.id] || defaultQuote();
    const horas = Number(q.horas) || 0;
    const valorHora = Number(q.valor_hora) || 0;
    const margen = Number(q.margen) || 0;
    const otrosTotal = (q.otros || []).reduce((a, o) => a + (Number(o.monto) || 0), 0);
    const mano = horas * valorHora;

    const matEst = lines.reduce((a, l) => a + l.estPesos, 0);
    const matUsado = lines.reduce((a, l) => a + l.usadoPesos, 0);
    const subEst = matEst + mano + otrosTotal;
    const subUsado = matUsado + mano + otrosTotal;
    const finEst = subEst * (1 + margen / 100);
    const finUsado = subUsado * (1 + margen / 100);
    const sinPrecio = lines.some((l) => l.peso <= 0 || l.precioKg <= 0);
    const horarioFab = horasDeObra(fab.fecha_apertura, fab.fecha_cierre);

    return (
      <div className="bg-white border border-line rounded-sm p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="font-medium leading-snug">{fab.nombre}</div>
            {fab.cliente && <div className="text-xs text-[#6B6558] mt-0.5">{fab.cliente}</div>}
            <div className="text-xs text-[#8A8578] mt-1">
              {fab.estado === "cerrada" ? "Obra cerrada" : "Obra abierta"} · {new Date(fab.fecha_apertura).toLocaleString("es-MX", { dateStyle: "short" })}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {extra && (
              <button onClick={() => quitarObraExtra(fab.id)} className="text-[10px] text-[#C7522A] hover:underline">
                Quitar de cotización
              </button>
            )}
            <select value={q.estado} onChange={(e) => setQuote(fab.id, "estado", e.target.value)} className={inputCls + " !py-1.5 !px-2 w-auto text-xs"}>
              <option value="presupuesto">Presupuesto</option>
              <option value="aprobado">Aprobado</option>
              <option value="facturado">Facturado</option>
            </select>
            {q.estado === "aprobado" && <span className="text-[10px] uppercase tracking-wide text-[#3D5A2E] bg-[#EAF0E4] px-2 py-0.5 rounded-sm">Aprobado</span>}
            {q.estado === "facturado" && <span className="text-[10px] uppercase tracking-wide text-[#2E6F9E] bg-[#EAF0F5] px-2 py-0.5 rounded-sm">Facturado</span>}
          </div>
        </div>

        {sinPrecio && (
          <div className="flex items-center gap-2 text-xs text-[#8A5A1E] bg-[#FBF3E5] border border-[#EBD9B8] px-3 py-2 rounded-sm mb-3">
            <AlertTriangle size={14} /> Hay materiales sin peso o precio cargado. Completá el catálogo para calcular bien.
          </div>
        )}

        {lines.length === 0 ? (
          <p className="text-xs text-[#8A8578] mb-3">Esta obra todavía no tiene materiales estimados ni usados.</p>
        ) : (
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-[#8A8578] border-b border-[#EFEBE0]">
                  <th className="py-1.5 pr-2">Material</th>
                  <th className="py-1.5 px-2 text-center">Est.</th>
                  <th className="py-1.5 px-2 text-center">Usado</th>
                  <th className="py-1.5 px-2 text-center">kg/u</th>
                  <th className="py-1.5 px-2 text-right">$/kg</th>
                  <th className="py-1.5 pl-2 text-right">$ Presupuesto</th>
                  <th className="py-1.5 pl-2 text-right">$ Costeo</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-[#F5F1E6] text-[#4A463D]">
                    <td className="py-1.5 pr-2 min-w-0 truncate max-w-[220px]">
                      <span className="flex items-center gap-1.5">
                        <Boxes size={12} className="shrink-0 text-[#8A8578]" />
                        <span className="truncate">{l.nombre}</span>
                        {l.peso <= 0 || l.precioKg <= 0 ? <AlertTriangle size={12} className="shrink-0 text-[#F4791E]" /> : null}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono">{l.estQty || "—"}</td>
                    <td className="py-1.5 px-2 text-center font-mono">{l.usadoQty || "—"}</td>
                    <td className="py-1.5 px-2 text-center font-mono">{l.peso || "—"}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{l.precioKg ? pesos(l.precioKg) : "—"}</td>
                    <td className="py-1.5 pl-2 text-right font-mono">{l.estPesos ? pesos(l.estPesos) : "—"}</td>
                    <td className="py-1.5 pl-2 text-right font-mono">{l.usadoPesos ? pesos(l.usadoPesos) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm font-medium text-ink">
                  <td className="py-2 pr-2" colSpan="5">Total material</td>
                  <td className="py-2 pl-2 text-right font-mono">{pesos(matEst)}</td>
                  <td className="py-2 pl-2 text-right font-mono">{pesos(matUsado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <label className="block">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">
              <Clock size={11} /> Horas
              <button
                type="button"
                onClick={() => usarHorasDeObra(fab.id, fab)}
                className="ml-auto text-[#2E6F9E] hover:underline normal-case"
                title="Usar las horas medidas de la obra"
              >
                usar {horarioFab ? horarioFab.toFixed(1) + " h" : "—"}
              </button>
            </span>
            <input type="number" step="0.5" min="0" className={inputCls} value={q.horas} onChange={(e) => setQuote(fab.id, "horas", e.target.value)} placeholder="0" />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Valor hora ($)</span>
            <input type="number" step="0.01" min="0" className={inputCls} value={q.valor_hora} onChange={(e) => setQuote(fab.id, "valor_hora", e.target.value)} placeholder="0" />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Margen (%)</span>
            <input type="number" step="0.5" min="0" className={inputCls} value={q.margen} onChange={(e) => setQuote(fab.id, "margen", e.target.value)} placeholder="0" />
          </label>
        </div>

        <div className="mb-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">
            <Plus size={11} /> Otros costos (transporte, consumibles, plegado...)
            <button type="button" onClick={() => agregarOtro(fab.id)} className="ml-auto inline-flex items-center gap-1 text-[#2E6F9E] hover:underline normal-case">
              <Plus size={12} /> Agregar
            </button>
          </p>
          {(q.otros || []).length === 0 && <p className="text-xs text-[#B0AA9A]">Sin otros costos.</p>}
          <ul className="space-y-1.5">
            {(q.otros || []).map((o, i) => (
              <li key={o._id} className="flex items-center gap-2">
                <input
                  className={inputCls + " !py-1.5 flex-1 min-w-0"}
                  placeholder="Descripción"
                  value={o.descripcion}
                  onChange={(e) => setOtro(fab.id, i, "descripcion", e.target.value)}
                />
                <input
                  className={inputCls + " !py-1.5 w-28 shrink-0 text-right font-mono"}
                  placeholder="Monto"
                  value={o.monto}
                  onChange={(e) => setOtro(fab.id, i, "monto", e.target.value)}
                />
                <button onClick={() => quitarOtro(fab.id, i)} className="text-[#C7522A] hover:text-red p-1 shrink-0" title="Quitar">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {externosF.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Artículos externos (no-stock)</p>
            <ul className="space-y-1">
              {externosF.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm text-[#4A463D]">
                  <span className="truncate">
                    {a.descripcion} <span className="text-[#8A8578]">× {a.cantidad}</span>
                  </span>
                  <span className="font-mono shrink-0">{pesos(Number(a.cantidad) * Number(a.valor_unitario))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#EFEBE0]">
          <div className="bg-[#FBF3E5] border border-[#EBD9B8] rounded-sm p-3">
            <p className="text-[10px] uppercase tracking-wide text-[#8A5A1E] mb-1.5">Presupuesto (estimado)</p>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-[#6B6558]">Material</dt><dd className="font-mono">{pesos(matEst)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6B6558]">Mano de obra</dt><dd className="font-mono">{pesos(mano)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6B6558]">Otros costos</dt><dd className="font-mono">{pesos(otrosTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6B6558]">Artículos externos</dt><dd className="font-mono">{pesos(externosTotal)}</dd></div>
              <div className="flex justify-between border-t border-[#EBD9B8] pt-1"><dt>Subtotal</dt><dd className="font-mono">{pesos(subEst)}</dd></div>
              <div className="flex justify-between"><dt>Margen {margen}%</dt><dd className="font-mono">{pesos(finEst - subEst)}</dd></div>
              <div className="flex justify-between text-base font-semibold text-[#8A5A1E] pt-1"><dt>Precio final</dt><dd className="font-mono">{pesos(finEst)}</dd></div>
            </dl>
          </div>
          <div className="bg-[#EAF0E4] border border-[#B9CBA9] rounded-sm p-3">
            <p className="text-[10px] uppercase tracking-wide text-[#3D5A2E] mb-1.5">Costeo real (usado)</p>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-[#6B6558]">Material</dt><dd className="font-mono">{pesos(matUsado)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6B6558]">Mano de obra</dt><dd className="font-mono">{pesos(mano)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6B6558]">Otros costos</dt><dd className="font-mono">{pesos(otrosTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6B6558]">Artículos externos</dt><dd className="font-mono">{pesos(externosTotal)}</dd></div>
              <div className="flex justify-between border-t border-[#B9CBA9] pt-1"><dt>Subtotal</dt><dd className="font-mono">{pesos(subUsado)}</dd></div>
              <div className="flex justify-between"><dt>Margen {margen}%</dt><dd className="font-mono">{pesos(finUsado - subUsado)}</dd></div>
              <div className="flex justify-between text-base font-semibold text-[#3D5A2E] pt-1"><dt>Precio final</dt><dd className="font-mono">{pesos(finUsado)}</dd></div>
            </dl>
          </div>
        </div>

        <button
          onClick={() => guardarCotizacion(fab.id)}
          disabled={guardando === fab.id}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-ink text-paper px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60"
        >
          <Save size={15} /> {guardando === fab.id ? "Guardando..." : "Guardar cotización"}
        </button>
      </div>
    );
  }

  const conMateriales = fabricaciones.filter((f) => (estimadosPorFab[f.id] || []).length > 0 || (usadosPorFab[f.id] || []).length > 0 || (externosPorFab[f.id] || []).length > 0);
  const idEnLista = new Set(conMateriales.map((f) => f.id));
  const disponibles = fabricaciones.filter((f) => f.estado === "abierta" && !idEnLista.has(f.id) && !extraIds.includes(f.id));
  const paraCotizar = [...conMateriales, ...fabricaciones.filter((f) => extraIds.includes(f.id))];

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <Wallet size={20} color="#F4791E" />
        <h1 className="font-display text-3xl font-semibold">Precios de obras</h1>
      </div>

      {confirmacion && (
        <div className="flex items-center gap-2 bg-[#EAF0E4] border border-[#B9CBA9] text-[#3D5A2E] text-sm px-4 py-3 rounded-sm mb-5 max-w-2xl">
          <CheckCircle2 size={16} /> {confirmacion}
        </div>
      )}
      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}

      {!loading && (
        <div className="flex flex-col gap-6">
          <section className="bg-white border border-line rounded-sm p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <Calculator size={18} className="text-[#2E6F9E]" />
                Catálogo de precios
              </h2>
              <button
                onClick={guardarCatalogo}
                disabled={guardandoCatalogo}
                className="inline-flex items-center gap-1.5 bg-ink text-paper px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60"
              >
                <Save size={15} /> {guardandoCatalogo ? "Guardando..." : "Guardar"}
              </button>
            </div>
            <p className="text-xs text-[#6B6558] mb-3">
              El precio del metal se maneja por kg. Cargá el <strong>peso por unidad</strong> y el <strong>precio por kg</strong>: el costo por unidad queda calculado solo.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[#8A8578] border-b border-[#EFEBE0]">
                    <th className="py-2 pr-2">Material</th>
                    <th className="py-2 px-2">Unidad</th>
                    <th className="py-2 px-2">Depósito</th>
                    <th className="py-2 px-2 w-28">Peso por unidad (kg)</th>
                    <th className="py-2 px-2 w-28">Precio por kg ($)</th>
                    <th className="py-2 pl-2 text-right">Costo por unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogo.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-xs text-[#8A8578]">
                        No hay insumos activos. Cargá materiales en Stock.
                      </td>
                    </tr>
                  )}
                  {catalogo.map((c) => {
                    const peso = Number(c.peso_unitario_kg) || 0;
                    const precio = Number(c.precio_kg) || 0;
                    const marcado = dirty.has(c.insumo_id);
                    return (
                      <tr key={c.insumo_id} className="border-b border-[#F5F1E6] text-[#4A463D]">
                        <td className="py-2 pr-2 min-w-0 max-w-[240px]">
                          <span className="truncate block">{c.nombre}</span>
                        </td>
                        <td className="py-2 px-2 text-[#8A8578]">{c.unidad}</td>
                        <td className="py-2 px-2 text-[#8A8578]">{c.deposito || "—"}</td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={inputCls + " !py-1.5 text-right font-mono" + (marcado ? " border-green" : "")}
                            value={c.peso_unitario_kg}
                            onChange={(e) => cambiarCatalogo(c.insumo_id, "peso_unitario_kg", e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={inputCls + " !py-1.5 text-right font-mono" + (marcado ? " border-green" : "")}
                            value={c.precio_kg}
                            onChange={(e) => cambiarCatalogo(c.insumo_id, "precio_kg", e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 pl-2 text-right font-mono">{pesos(peso * precio)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold mb-3">
              <ClipboardList size={18} className="text-[#2E6F9E]" />
              Cotización de obras
            </h2>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <select
                className={inputCls + " w-auto min-w-[280px]"}
                value={seleccionObra}
                onChange={(e) => setSeleccionObra(e.target.value)}
              >
                <option value="">Elegí una obra abierta para cotizar...</option>
                {disponibles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                    {f.cliente ? ` (${f.cliente})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={agregarObraExtra}
                disabled={!seleccionObra}
                className="inline-flex items-center gap-1.5 bg-white border border-line text-ink px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] disabled:opacity-40 transition-colors"
              >
                <Plus size={15} /> Agregar a cotización
              </button>
              {extraIds.length > 0 && (
                <span className="text-xs text-[#6B6558]">Obras agregadas: {extraIds.length}</span>
              )}
            </div>
            {paraCotizar.length === 0 && (
              <p className="text-center text-sm text-[#8A8578] py-8">
                No hay obras para cotizar. Elegí una obra abierta en el selector o cargá materiales en Fabricación.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4">
              {paraCotizar.map((f) => (
                <TarjetaCotizacion key={f.id} fab={f} extra={extraIds.includes(f.id)} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

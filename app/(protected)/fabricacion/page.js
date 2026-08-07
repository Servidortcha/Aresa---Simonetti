"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Factory, Plus, CheckCircle2, Lock, Boxes, CalendarClock } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

const vacioAbrir = { nombre: "", cliente: "", descripcion: "" };

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

export default function FabricacionPage() {
  const { rol, session } = useAuth();
  const router = useRouter();

  const [fabricaciones, setFabricaciones] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [insumosPorFabricacion, setInsumosPorFabricacion] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [formAbrir, setFormAbrir] = useState(vacioAbrir);
  const [subiendo, setSubiendo] = useState(false);
  const [cerrando, setCerrando] = useState(null);

  const abiertas = fabricaciones.filter((f) => f.estado === "abierta");
  const cerradas = fabricaciones.filter((f) => f.estado === "cerrada");

  async function cargar() {
    setLoading(true);
    const [{ data: fac, error: ef }, { data: ins, error: ei }, { data: fis, error: efi }] = await Promise.all([
      supabase.from("fabricaciones").select("*").order("fecha_apertura", { ascending: false }),
      supabase.from("insumos").select("id, nombre, unidad, stock, deposito").eq("activo", true).order("nombre"),
      supabase.from("fabricacion_insumos").select("id, fabricacion_id, insumo_id, cantidad, fecha"),
    ]);
    if (ef) setError(ef.message);
    else setFabricaciones(fac || []);
    if (ei) setError(ei.message);
    else setInsumos(ins || []);
    if (efi) setError(efi.message);
    else {
      const mapa = {};
      (fis || []).forEach((fila) => {
        const insumo = (ins || []).find((i) => i.id === fila.insumo_id);
        if (!insumo) return;
        (mapa[fila.fabricacion_id] = mapa[fila.fabricacion_id] || []).push({
          id: fila.id,
          nombre: insumo.nombre,
          unidad: insumo.unidad || "u",
          deposito: insumo.deposito || "",
          cantidad: fila.cantidad,
          fecha: fila.fecha,
        });
      });
      setInsumosPorFabricacion(mapa);
    }
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

  if (rol && rol !== "admin") return null;

  function Tarjeta({ f }) {
    const insumosF = insumosPorFabricacion[f.id] || [];
    const total = insumosF.reduce((acc, x) => acc + x.cantidad, 0);
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

        {f.estado === "abierta" && (
          <>
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

        {f.estado === "cerrada" && f.fecha_cierre && (
          <div className="flex items-center gap-1.5 text-xs text-[#8A8578] mt-3 pt-3 border-t border-[#EFEBE0]">
            <CalendarClock size={13} /> Cerrada el {new Date(f.fecha_cierre).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
          </div>
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
    </>
  );
}

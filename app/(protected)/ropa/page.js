"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import { Shirt, Download, Printer, Pencil, Trash2, Search, Plus, X, CheckCircle2 } from "lucide-react";
import { DocPrint, DocGrid, DocTabla, DocFila, DocNota } from "../../../components/DocPrint";

const CATEGORIAS = ["Pantalon", "Camisa", "Buzo"];
const TALLES = {
  Pantalon: ["40", "42", "44", "46", "48", "50", "52", "54", "56"],
  Camisa: ["S", "M", "L", "XL", "XXL", "3XL"],
  Buzo: ["S", "M", "L", "XL", "XXL", "3XL"],
};

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function RopaPage() {
  const { rol, session } = useAuth();
  const router = useRouter();
  const puedeAcceder = rol === "admin" || rol === "subadmin";

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [form, setForm] = useState({ categoria: CATEGORIAS[0], talle: TALLES.Pantalon[0], destinatario: "", cantidad: "1", observaciones: "" });
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [tarjeta, setTarjeta] = useState(null);
  const [query, setQuery] = useState("");
  const [filtroCat, setFiltroCat] = useState("todas");

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase.from("ropa_entregas").select("*").order("fecha", { ascending: false });
    if (error) setError(error.message);
    else setRegistros(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (rol && !puedeAcceder) router.replace("/ingreso-egreso");
  }, [rol, puedeAcceder, router]);

  const tallesActuales = TALLES[form.categoria] || [];

  function cambiarCategoria(cat) {
    setForm((prev) => ({ ...prev, categoria: cat, talle: TALLES[cat][0] }));
  }

  function abrirNuevo() {
    setEditandoId(null);
    setForm({ categoria: CATEGORIAS[0], talle: TALLES.Pantalon[0], destinatario: "", cantidad: "1", observaciones: "" });
    setError(null);
  }

  function abrirEditar(r) {
    setEditandoId(r.id);
    setForm({
      categoria: r.categoria,
      talle: r.talle,
      destinatario: r.destinatario,
      cantidad: r.cantidad != null ? String(r.cantidad) : "1",
      observaciones: r.observaciones || "",
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault();
    if (guardando) return;
    setError(null);
    if (!form.destinatario.trim()) {
      setError("Escribí el nombre de la persona.");
      return;
    }
    const cant = Number(form.cantidad);
    if (!cant || cant <= 0) {
      setError("La cantidad tiene que ser mayor a 0.");
      return;
    }
    if (!tallesActuales.includes(form.talle)) {
      setError("Elegí un talle válido para esa categoría.");
      return;
    }

    setGuardando(true);
    const payload = {
      categoria: form.categoria,
      talle: form.talle,
      destinatario: form.destinatario.trim(),
      cantidad: cant,
      observaciones: form.observaciones.trim() || null,
    };
    let error;
    if (editandoId) {
      ({ error } = await supabase.from("ropa_entregas").update(payload).eq("id", editandoId));
    } else {
      ({ error } = await supabase
        .from("ropa_entregas")
        .insert({ ...payload, usuario_email: session?.user?.email || null }));
    }
    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setConfirmacion(editandoId ? "Entrega actualizada" : "Entrega registrada");
    setTimeout(() => setConfirmacion(null), 3000);
    abrirNuevo();
    cargar();
  }

  async function eliminarRegistro() {
    if (!confirmarEliminar) return;
    const { error } = await supabase.from("ropa_entregas").delete().eq("id", confirmarEliminar.id);
    if (error) {
      setError(error.message);
      setConfirmarEliminar(null);
      return;
    }
    setConfirmarEliminar(null);
    setConfirmacion("Entrega eliminada");
    setTimeout(() => setConfirmacion(null), 2500);
    cargar();
  }

  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      if (query) {
        const q = query.toLowerCase();
        if (!((r.destinatario || "").toLowerCase().includes(q) || (r.talle || "").toLowerCase().includes(q))) return false;
      }
      if (filtroCat !== "todas" && r.categoria !== filtroCat) return false;
      return true;
    });
  }, [registros, query, filtroCat]);

  const resumen = useMemo(() => {
    const by = {};
    registros.forEach((r) => {
      by[r.destinatario] = by[r.destinatario] || { total: 0, items: [] };
      by[r.destinatario].total += Number(r.cantidad) || 0;
      by[r.destinatario].items.push(`${r.categoria} talle ${r.talle}`);
    });
    return by;
  }, [registros]);

  function imprimir(r) {
    setTarjeta(r);
    const tituloOriginal = document.title;
    document.title = `Ropa-${r.categoria}-${r.talle}-${(r.destinatario || "sin-nombre").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-")}`;
    function restaurar() {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurar);
    }
    window.addEventListener("afterprint", restaurar);
    setTimeout(() => window.print(), 100);
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const filas = filtrados.map((r) => ({
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
    XLSX.utils.book_append_sheet(libro, hoja, "Ropa");
    XLSX.writeFile(libro, `ropa-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (rol && !puedeAcceder) return null;

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Shirt size={20} color="#F4791E" />
          <h1 className="font-display text-3xl font-semibold">Ropa de trabajo</h1>
        </div>
        <button onClick={exportarExcel} className="flex items-center gap-1.5 bg-white border border-line text-ink px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] transition-colors">
          <Download size={16} /> Exportar a Excel
        </button>
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}
      {confirmacion && (
        <div className="flex items-center gap-2 bg-[#EAF0E4] border border-[#B9CBA9] text-[#3D5A2E] text-sm px-4 py-3 rounded-sm mb-5 max-w-2xl">
          <CheckCircle2 size={16} /> {confirmacion}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <form onSubmit={submit} className="bg-white border border-line rounded-sm p-4 sm:p-6 w-full max-w-2xl">
          {editandoId && (
            <div className="flex items-center justify-between bg-[#F2EEE3] border border-line rounded-sm px-3 py-2 mb-4 text-xs text-[#6B6558]">
              Editando entrega existente
              <button type="button" onClick={abrirNuevo} className="text-[#3B5166] hover:underline flex items-center gap-1">
                <X size={13} /> Cancelar edición
              </button>
            </div>
          )}

          <Field label="Categoría">
            <div className="flex gap-2">
              {CATEGORIAS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => cambiarCategoria(c)}
                  className="flex-1 py-2 rounded-sm text-sm font-medium border transition-colors"
                  style={{
                    backgroundColor: form.categoria === c ? "#4A4B4D" : "white",
                    color: form.categoria === c ? "white" : "#1C1F1C",
                    borderColor: form.categoria === c ? "transparent" : "#D8D2C4",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Talle">
              <div className="flex flex-wrap gap-1.5">
                {tallesActuales.map((t) => (
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
            </Field>
            <Field label="Cantidad">
              <input type="number" step="1" min="1" className={inputCls + " max-w-[120px]"} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </Field>
          </div>

          <Field label="Persona">
            <input className={inputCls} value={form.destinatario} onChange={(e) => setForm({ ...form, destinatario: e.target.value })} placeholder="Nombre y apellido" list="nombres-ropa" />
            <datalist id="nombres-ropa">
              {Object.keys(resumen).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>

          <Field label="Observaciones (opcional)">
            <input className={inputCls} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Ej. Cambio por rotura" />
          </Field>

          <button type="submit" disabled={guardando} className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60">
            {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Registrar entrega"}
          </button>
        </form>

        <div className="w-full">
          <h2 className="font-display text-xl font-semibold text-ink mb-3">Historial de entregas</h2>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-line rounded-sm px-3 py-2 w-full sm:max-w-xs">
              <Search size={15} color="#6B6558" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar persona o talle" className="flex-1 text-sm outline-none" />
            </div>
            <select value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)} className="bg-white border border-line rounded-sm px-3 py-2 text-sm text-ink">
              <option value="todas">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {query || filtroCat !== "todas" ? (
              <span className="text-xs text-[#8A8578]">
                {filtrados.length} entrega{filtrados.length !== 1 ? "s" : ""}
              </span>
            ) : null}
          </div>

          {/* Móvil: tarjetas */}
          <div className="sm:hidden space-y-3">
            {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}
            {!loading &&
              filtrados.map((r) => (
                <div key={r.id} className="bg-white border border-line rounded-sm p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#EAF0F5] text-[#2E6F9E]">{r.categoria}</span>
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#F2EEE3] text-[#6B6558]">Talle {r.talle}</span>
                    <span className="font-mono text-xs text-[#6B6558]">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <div className="font-medium leading-snug">{r.destinatario}</div>
                  <p className="text-xs text-[#6B6558] mt-0.5">Cantidad: {r.cantidad}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => abrirEditar(r)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                      <Pencil size={15} /> Editar
                    </button>
                    <button onClick={() => imprimir(r)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-ink">
                      <Printer size={15} /> Imprimir
                    </button>
                    <button onClick={() => setConfirmarEliminar(r)} className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-sm text-sm font-medium text-[#C7522A]">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            {!loading && filtrados.length === 0 && <p className="text-center text-sm text-[#8A8578] py-8">Aún no hay entregas</p>}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden sm:block bg-white border border-line rounded-sm overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[820px]">
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
                {!loading && filtrados.map((r, idx) => (
                  <tr key={r.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== filtrados.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                    <td className="px-4 py-3 text-[#6B6558] font-mono whitespace-nowrap">{new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#EAF0F5] text-[#2E6F9E] whitespace-nowrap">{r.categoria}</span>
                    </td>
                    <td className="px-4 py-3 font-mono">{r.talle}</td>
                    <td className="px-4 py-3 text-[#4A463D]">{r.destinatario}</td>
                    <td className="px-4 py-3 font-mono">{r.cantidad}</td>
                    <td className="px-4 py-3 text-[#8A8578] max-w-[200px] truncate">{r.observaciones || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => abrirEditar(r)} className="text-[#4A4B4D] hover:opacity-70" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => imprimir(r)} className="text-[#4A4B4D] hover:opacity-70" title="Imprimir entrega">
                          <Printer size={15} />
                        </button>
                        <button onClick={() => setConfirmarEliminar(r)} className="text-[#C7522A] hover:text-red" title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtrados.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8578]">Aún no hay entregas</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {Object.keys(resumen).length > 0 && (
            <div className="mt-6">
              <h2 className="font-display text-lg font-semibold text-ink mb-2">Resumen por persona</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(resumen).map(([nombre, info]) => (
                  <div key={nombre} className="bg-white border border-line rounded-sm p-3">
                    <div className="font-medium text-ink truncate">{nombre}</div>
                    <div className="text-xs text-[#6B6558] mt-1">{info.total} prenda{info.total !== 1 ? "s" : ""}</div>
                    <div className="text-xs text-[#8A8578] mt-1 leading-snug">{info.items.join(" · ")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmarEliminar(null)}>
          <div className="bg-card w-full max-w-sm rounded-sm border border-line shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold mb-2">Eliminar entrega</h3>
            <p className="text-sm text-[#4A463D] mb-4">
              ¿Eliminar la entrega de <b>{confirmarEliminar.categoria} talle {confirmarEliminar.talle}</b> para <b>{confirmarEliminar.destinatario}</b>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmarEliminar(null)} className="px-4 py-2 border border-line rounded-sm text-sm text-ink hover:bg-[#F2EEE3]">
                Cancelar
              </button>
              <button onClick={eliminarRegistro} className="px-4 py-2 bg-[#C7522A] text-white rounded-sm text-sm font-medium hover:bg-red">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {tarjeta && (
        <DocPrint titulo="Entrega de ropa" numero={null}>
          <DocGrid
            datos={[
              { label: "Fecha", valor: new Date(tarjeta.fecha).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) },
              { label: "Registrado por", valor: tarjeta.usuario_email || "—" },
              { label: "Categoría", valor: tarjeta.categoria },
              { label: "Talle", valor: tarjeta.talle },
              { label: "Persona", valor: tarjeta.destinatario },
              { label: "Cantidad", valor: String(tarjeta.cantidad) },
            ]}
          />
          <DocNota label="Observaciones" texto={tarjeta.observaciones} />
          <div style={{ border: "1px solid #E4DFD3", borderRadius: 6, padding: "14px 16px", textAlign: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, color: "#1C1F1C" }}>
              {tarjeta.categoria} — Talle {tarjeta.talle}
            </div>
            <div style={{ fontSize: 15, marginTop: 2 }}>{tarjeta.destinatario}</div>
          </div>
          <div style={{ display: "flex", gap: 40, marginTop: 56, fontSize: 12, color: "#6B6558" }}>
            <div style={{ flex: 1, borderTop: "1px solid #1C1F1C", paddingTop: 6, textAlign: "center" }}>Firma quien entrega</div>
            <div style={{ flex: 1, borderTop: "1px solid #1C1F1C", paddingTop: 6, textAlign: "center" }}>Firma quien recibe</div>
          </div>
        </DocPrint>
      )}
    </>
  );
}

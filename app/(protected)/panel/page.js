"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Truck,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";

const hoyLocal = new Date().toLocaleDateString("en-CA");

function formatFecha(f) {
  if (!f) return "—";
  return new Date(f).toLocaleDateString("es-AR");
}

function Stat({ icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-line rounded-sm p-4 flex items-start gap-3">
      <div className="p-2.5 rounded-sm shrink-0" style={{ backgroundColor: (color || "#EAF0F5") + "22", color: color || "#2E6F9E" }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-[#8A8578]">{label}</div>
        <div className="font-display text-2xl font-semibold text-ink leading-tight">{value}</div>
        {sub && <div className="text-xs text-[#6B6558] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ icon, color, children }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink mb-3">
      <span className="p-1.5 rounded-sm" style={{ backgroundColor: (color || "#2E6F9E") + "22", color: color || "#2E6F9E" }}>
        {icon}
      </span>
      {children}
    </h2>
  );
}

export default function PanelPage() {
  const { rol } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [partes, setPartes] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [gruas, setGruas] = useState([]);
  const [bajos, setBajos] = useState([]);

  useEffect(() => {
    if (rol && rol !== "admin") router.replace("/ingreso-egreso");
  }, [rol, router]);

  async function cargar() {
    setLoading(true);
    const [resPartes, resFrentes, resPersonas, resGruas, resInsumos] = await Promise.all([
      supabase.from("partes_diarios").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(60),
      supabase.from("frentes_trabajo").select("id, nombre").order("nombre"),
      supabase.from("frente_personas").select("frente_id, nombre, rol"),
      supabase.from("trabajos_grua").select("*").order("fecha", { ascending: false }).limit(60),
      supabase.from("insumos").select("*").order("deposito").order("nombre"),
    ]);
    const err = [resPartes, resFrentes, resPersonas, resGruas, resInsumos].find((r) => r.error);
    if (err) {
      setError(err.error.message);
    } else {
      setPartes(resPartes.data || []);
      setFrentes(resFrentes.data || []);
      setPersonas(resPersonas.data || []);
      setGruas(resGruas.data || []);
      setBajos((resInsumos.data || []).filter((i) => i.activo !== false && i.stock < i.minimo));
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rol && rol !== "admin") return null;

  const partesHoy = partes.filter((p) => p.fecha === hoyLocal);
  const partesMes = partes.filter((p) => (p.fecha || "").slice(0, 7) === hoyLocal.slice(0, 7));
  const gruasMes = gruas.filter((g) => (g.fecha || "").slice(0, 7) === hoyLocal.slice(0, 7));
  const horasMes = gruasMes.reduce((acc, g) => acc + (Number(g.horas_uso) || 0), 0);

  const partesRecientes = partes.slice(0, 8);
  const gruasRecientes = gruas.slice(0, 8);

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <LayoutDashboard size={22} color="#F4791E" />
        <h1 className="font-display text-3xl font-semibold">Panel de administración</h1>
      </div>

      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat
          icon={<ClipboardList size={18} />}
          label="Partes diarios de hoy"
          value={loading ? "…" : partesHoy.length}
          sub={partesHoy.length === 1 ? "1 frente reportó" : `${partesHoy.length} frentes reportaron`}
          color="#2E6F9E"
        />
        <Stat
          icon={<Building2 size={18} />}
          label="Frentes de trabajo"
          value={loading ? "…" : frentes.length}
          sub={`${personas.length} personas en total`}
          color="#4B7355"
        />
        <Stat
          icon={<Truck size={18} />}
          label="Grúa este mes"
          value={loading ? "…" : gruasMes.length}
          sub={`${horasMes} h de uso`}
          color="#F4791E"
        />
        <Stat
          icon={<AlertTriangle size={18} />}
          label="Insumos bajo mínimo"
          value={loading ? "…" : bajos.length}
          sub={bajos.length > 0 ? "requieren reposición" : "sin alertas"}
          color={bajos.length > 0 ? "#C7522A" : "#4B7355"}
        />
      </div>

      {loading ? (
        <p className="text-center text-sm text-[#8A8578] py-12">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Stocks comprometidos */}
          <section>
            <SectionTitle icon={<AlertTriangle size={16} />} color="#C7522A">
              Stocks comprometidos ({bajos.length})
            </SectionTitle>
            {bajos.length === 0 ? (
              <div className="bg-white border border-line rounded-sm p-4 text-sm text-[#6B6558]">
                Todo el stock está por encima del mínimo. No hay insumos comprometidos.
              </div>
            ) : (
              <div className="bg-white border border-line rounded-sm overflow-x-auto w-full">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                      <th className="px-4 py-3 font-medium">Insumo</th>
                      <th className="px-4 py-3 font-medium">Depósito</th>
                      <th className="px-4 py-3 font-medium">Categoría</th>
                      <th className="px-4 py-3 font-medium">Stock / Mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bajos.map((i, idx) => (
                      <tr key={i.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} ${idx !== bajos.length - 1 ? "border-b border-[#EFEBE0]" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{i.nombre}</div>
                        </td>
                        <td className="px-4 py-3 text-[#4A463D]">{i.deposito || "General"}</td>
                        <td className="px-4 py-3 text-[#4A463D]">{i.categoria || "—"}</td>
                        <td className="px-4 py-3 font-mono">
                          <span className="text-red font-medium">{i.stock}</span> <span className="text-[#B0AA9A]">/ {i.minimo}</span>{" "}
                          <span className="text-[#8A8578] text-xs">{i.unidad}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Frentes de trabajo */}
          <section>
            <SectionTitle icon={<Building2 size={16} />} color="#4B7355">
              Frentes de trabajo
            </SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {frentes.map((f) => {
                const personasFrente = personas.filter((p) => p.frente_id === f.id);
                const encargado = personasFrente.find((p) => p.rol?.toLowerCase().includes("encargado")) || personasFrente[0];
                const partesFrente = partes.filter((p) => p.frente_id === f.id);
                const ultima = partesFrente[0];
                return (
                  <div key={f.id} className="bg-white border border-line rounded-sm p-4">
                    <div className="font-display text-lg font-semibold text-ink leading-snug">{f.nombre}</div>
                    {encargado && <div className="text-sm text-[#6B6558] mt-0.5">{encargado.nombre} · {encargado.rol}</div>}
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#EFEBE0] text-sm">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Personas</span>
                        <span className="font-mono">{personasFrente.length}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Partes</span>
                        <span className="font-mono">{partesFrente.length}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase tracking-wide text-[#8A8578]">Último parte</span>
                        <span className="font-mono text-[#6B6558]">{ultima ? `${formatFecha(ultima.fecha)}${ultima.novedades ? " · con novedades" : ""}` : "Sin partes aún"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Partes diarios recientes */}
          <section>
            <SectionTitle icon={<ClipboardList size={16} />} color="#2E6F9E">
              Partes diarios recientes ({partesRecientes.length})
            </SectionTitle>
            <div className="space-y-3">
              {partesRecientes.length === 0 && (
                <div className="bg-white border border-line rounded-sm p-4 text-sm text-[#6B6558]">Todavía no hay partes diarios cargados.</div>
              )}
              {partesRecientes.map((p) => (
                <div key={p.id} className="bg-white border border-line rounded-sm p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#EAF0F5] text-[#2E6F9E]">
                      {frentes.find((f) => f.id === p.frente_id)?.nombre || "Frente"}
                    </span>
                    <span className="font-mono text-xs text-[#6B6558]">{formatFecha(p.fecha)}</span>
                    <span className="text-xs text-[#8A8578] ml-auto">{p.usuario_email || ""}</span>
                  </div>
                  {p.tareas && <p className="text-sm text-[#4A463D] whitespace-pre-wrap line-clamp-2">{p.tareas}</p>}
                  {p.novedades && (
                    <p className="mt-2 bg-[#FBEFE6] border border-[#EFD9C4] rounded-sm px-3 py-1.5 text-sm text-[#8A4A16] whitespace-pre-wrap line-clamp-2">
                      {p.novedades}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Grúa reciente */}
          <section>
            <SectionTitle icon={<Truck size={16} />} color="#F4791E">
              Trabajos de grúa recientes ({gruasRecientes.length})
            </SectionTitle>
            <div className="space-y-3">
              {gruasRecientes.length === 0 && (
                <div className="bg-white border border-line rounded-sm p-4 text-sm text-[#6B6558]">Todavía no hay trabajos de grúa registrados.</div>
              )}
              {gruasRecientes.map((g) => (
                <div key={g.id} className="bg-white border border-line rounded-sm p-4 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-[#6B6558]">
                        <CalendarDays size={12} className="inline mr-1" />
                        {new Date(g.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      <span className="text-xs text-[#8A8578]">{g.operador || ""}</span>
                    </div>
                    <div className="font-medium mt-1">{g.cliente || "Sin cliente"}</div>
                    {g.descripcion && <p className="text-sm text-[#4A463D] line-clamp-2">{g.descripcion}</p>}
                    <div className="text-xs text-[#6B6558] mt-1">
                      {[g.ubicacion, g.tipo_grua, g.horas_uso != null ? `${g.horas_uso} h` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {g.foto_url && (
                    <a href={g.foto_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.foto_url} alt="Foto" className="h-14 w-14 object-cover rounded-sm border border-line" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

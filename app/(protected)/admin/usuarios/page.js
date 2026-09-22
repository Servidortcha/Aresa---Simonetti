"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../lib/AuthContext";
import { Users, CheckCircle2, ShieldCheck, ChevronDown } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

const ROLES = ["admin", "taller_stock", "encargado", "operario", "grua", "supervision"];

const ROL_LABEL = {
  admin: "Administrador",
  taller_stock: "Taller / Stock",
  encargado: "Encargado",
  operario: "Operario",
  grua: "Grúa",
  supervision: "Supervisión",
};

export default function AdminUsuariosPage() {
  const { rol } = useAuth();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState([]);
  const [frentes, setFrentes] = useState([]);
  const [encargadosPorFrente, setEncargadosPorFrente] = useState({});
  const [accesosSup, setAccesosSup] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [guardando, setGuardando] = useState(null);
  const [rolesEdit, setRolesEdit] = useState({});
  const [frenteEncargado, setFrenteEncargado] = useState({});
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    if (rol && rol !== "admin") router.replace("/ingreso-egreso");
  }, [rol, router]);

  async function cargar() {
    setLoading(true);
    const [{ data: users, error: errU }, { data: fr, error: errF }, { data: acc, error: errA }] = await Promise.all([
      supabase.rpc("lista_usuarios"),
      supabase.from("frentes_trabajo").select("id, nombre, encargado_user_id").order("nombre"),
      supabase.rpc("lista_supervision_accesos"),
    ]);
    if (errU) setError(errU.message);
    else {
      setUsuarios(users || []);
      const re = {};
      (users || []).forEach((u) => { re[u.user_id] = u.rol || ""; });
      setRolesEdit(re);
    }
    if (errF) setError(errF.message);
    else {
      setFrentes(fr || []);
      const map = {};
      (fr || []).forEach((f) => { if (f.encargado_user_id) map[f.encargado_user_id] = f; });
      setEncargadosPorFrente(map);
    }
    if (!errA) setAccesosSup(acc || []);
    setLoading(false);
  }

  useEffect(() => {
    if (rol === "admin") cargar();
  }, [rol]);

  function mostrarMensaje(texto) {
    setConfirmacion(texto);
    setTimeout(() => setConfirmacion(null), 3000);
  }

  async function guardarRol(u) {
    const nuevo = rolesEdit[u.user_id];
    if (!nuevo || nuevo === (u.rol || "")) return;
    setError(null);
    setGuardando(u.user_id + "-rol");
    const { data, error } = await supabase.rpc("asignar_rol", { p_email: u.email, p_rol: nuevo });
    setGuardando(null);
    const r = data?.[0];
    if (error || !r?.ok) {
      setError(error?.message || r?.mensaje || "No se pudo asignar el rol.");
      return;
    }
    mostrarMensaje(`Rol de ${u.email} actualizado`);
    cargar();
  }

  async function vincularFrente(u) {
    const frenteId = frenteEncargado[u.user_id];
    if (!frenteId) {
      setError("Elegí el frente para vincular.");
      return;
    }
    setError(null);
    setGuardando(u.user_id + "-frente");
    const { data, error } = await supabase.rpc("vincular_encargado_frente", { p_email: u.email, p_frente_id: frenteId });
    setGuardando(null);
    const r = data?.[0];
    if (error || !r?.ok) {
      setError(error?.message || r?.mensaje || "No se pudo vincular.");
      return;
    }
    mostrarMensaje(`${u.email} vinculado al frente`);
    cargar();
  }

  const accesosPorUsuario = useMemo(() => {
    const map = {};
    accesosSup.forEach((a) => { (map[a.user_id] = map[a.user_id] || []).push(a); });
    return map;
  }, [accesosSup]);

  if (rol && rol !== "admin") return null;

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Users size={20} color="#F4791E" />
        <h1 className="font-display text-3xl font-semibold">Usuarios</h1>
      </div>
      <p className="text-sm text-[#6B6558] mb-6">
        La persona se registra sola en <Link href="/registro" className="text-[#3B5166] hover:underline">/registro</Link> y
        después le asignás el rol y su frente desde acá. Los frentes nuevos se crean en <Link href="/organigrama" className="text-[#3B5166] hover:underline">Organigrama</Link>.
      </p>

      {confirmacion && (
        <div className="flex items-center gap-2 bg-[#EAF0E4] border border-[#B9CBA9] text-[#3D5A2E] text-sm px-4 py-3 rounded-sm mb-5 max-w-2xl">
          <CheckCircle2 size={16} /> {confirmacion}
        </div>
      )}
      {error && <p className="text-sm text-red mb-4">Error: {error}</p>}

      {loading && <p className="text-center text-sm text-[#8A8578] py-8">Cargando...</p>}

      {!loading && (
        <div className="space-y-3">
          {usuarios.map((u) => {
            const esAbierto = abierto === u.user_id;
            const rolActual = u.rol || "(sin rol)";
            const frenteEnc = encargadosPorFrente[u.user_id];
            const accSup = accesosPorUsuario[u.user_id] || [];
            return (
              <div key={u.user_id} className="bg-white border border-line rounded-sm">
                <button
                  onClick={() => setAbierto(esAbierto ? null : u.user_id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">{u.email}</div>
                    <div className="text-xs text-[#6B6558] mt-0.5">
                      {u.rol ? ROL_LABEL[u.rol] || u.rol : <span className="text-[#B25A1E] font-medium">Pendiente de activación</span>}
                      {frenteEnc ? ` · Encargado de ${frenteEnc.nombre}` : ""}
                      {accSup.length > 0 ? ` · Supervisa ${accSup.length} frente${accSup.length !== 1 ? "s" : ""}` : ""}
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-[#8A8578] shrink-0 transition-transform ${esAbierto ? "rotate-180" : ""}`} />
                </button>

                {esAbierto && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#EFEBE0]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <label className="block">
                        <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Rol (actual: {rolActual})</span>
                        <div className="flex gap-2">
                          <select
                            className={inputCls}
                            value={rolesEdit[u.user_id] || ""}
                            onChange={(e) => setRolesEdit((prev) => ({ ...prev, [u.user_id]: e.target.value }))}
                          >
                            <option value="">— Elegir —</option>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{ROL_LABEL[r]}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => guardarRol(u)}
                            disabled={guardando === u.user_id + "-rol"}
                            className="bg-ink text-paper px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60 shrink-0"
                          >
                            {guardando === u.user_id + "-rol" ? "..." : "Guardar"}
                          </button>
                        </div>
                      </label>

                      <label className="block">
                        <span className="block text-[10px] uppercase tracking-wide text-[#8A8578] mb-1">Vincular como encargado de frente</span>
                        <div className="flex gap-2">
                          <select
                            className={inputCls}
                            value={frenteEncargado[u.user_id] || ""}
                            onChange={(e) => setFrenteEncargado((prev) => ({ ...prev, [u.user_id]: e.target.value }))}
                          >
                            <option value="">— Frente —</option>
                            {frentes.map((f) => (
                              <option key={f.id} value={f.id}>{f.nombre}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => vincularFrente(u)}
                            disabled={guardando === u.user_id + "-frente"}
                            className="bg-white border border-line text-ink px-3 py-2 rounded-sm text-sm font-medium hover:bg-[#F2EEE3] disabled:opacity-60 shrink-0"
                          >
                            {guardando === u.user_id + "-frente" ? "..." : "Vincular"}
                          </button>
                        </div>
                      </label>
                    </div>

                    {accSup.length > 0 && (
                      <div className="mt-3 flex items-start gap-1.5 text-xs text-[#6B6558]">
                        <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                        <span>
                          Supervisa: {accSup.map((a) => a.frente_nombre).join(", ")}.{" "}
                          <Link href="/partes-diarios" className="text-[#3B5166] hover:underline">Gestionar en Partes diarios</Link>
                        </span>
                      </div>
                    )}
                    <p className="text-[11px] text-[#8A8578] mt-2">
                      Alta: {u.creado ? new Date(u.creado).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {usuarios.length === 0 && (
            <p className="text-center text-sm text-[#8A8578] py-8">No hay usuarios registrados.</p>
          )}
        </div>
      )}
    </>
  );
}

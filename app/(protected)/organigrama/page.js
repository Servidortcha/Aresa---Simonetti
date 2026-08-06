"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import AdminGuard from "../../../components/AdminGuard";

const ROLES = ["Encargado de escuadrilla", "Puntero", "Operario"];

const CSS = `
.organigrama{
  --navy:#1F2A37;
  --navy-2:#2E3D4E;
  --paper:#F6F3EA;
  --line:#C9BFA0;
  --ocre:#C97A2B;
  --ocre-2:#E6A23C;
  --text:#1F2A37;
  --muted:#4B5A68;
  --danger:#B84C3E;
  box-sizing:border-box;
  background:var(--paper);
  color:var(--text);
  font-family:-apple-system,"Segoe UI",Roboto,sans-serif;
  border:1px solid var(--line);
  border-radius:8px;
  overflow:hidden;
}
.organigrama header{padding:24px 28px 14px;text-align:center;border-bottom:2px solid var(--ocre);}
.organigrama header h1{margin:0 0 4px;font-size:21px;color:var(--navy);}
.organigrama header p{margin:0;font-size:12.5px;color:var(--muted);}
.organigrama .status{font-size:11.5px;color:#8A8064;margin-top:6px;min-height:16px;}

.organigrama .fixed-chart{max-width:900px;margin:20px auto 8px;display:flex;flex-direction:column;align-items:center;padding:0 12px;}
.organigrama .box{border-radius:7px;padding:10px 18px;text-align:center;min-width:220px;}
.organigrama .box.top{background:var(--navy);color:#fff;}
.organigrama .box.top .role{color:var(--ocre-2);font-size:11px;}
.organigrama .box.mid{background:var(--navy-2);color:#fff;margin:0 8px;}
.organigrama .box.mid .role{color:#CBD5DE;font-size:10.5px;}
.organigrama .box.leaf{background:#fff;border:1.4px solid var(--line);color:var(--text);}
.organigrama .box.leaf .role{color:var(--muted);font-size:10.5px;}
.organigrama .box b{display:block;font-size:13.5px;}
.organigrama .box.ops{min-width:280px;max-width:340px;}
.organigrama .ops-list{list-style:none;margin:8px 0 0;padding:8px 0 0;text-align:left;font-size:12px;line-height:1.5;color:var(--text);max-height:200px;overflow-y:auto;border-top:1px solid var(--line);}
.organigrama .row{display:flex;justify-content:center;gap:14px;margin-top:10px;flex-wrap:wrap;}
.organigrama .connector{width:1.4px;height:16px;background:#9A8F71;}

.organigrama main{max-width:1180px;margin:24px auto 40px;padding:0 20px;}
.organigrama .section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;}
.organigrama .section-title h2{margin:0;font-size:16px;color:var(--navy);}
.organigrama .section-title p{margin:2px 0 0;font-size:12px;color:var(--muted);}

.organigrama button{font-family:inherit;cursor:pointer;border:none;border-radius:5px;font-size:12.5px;font-weight:600;padding:8px 13px;}
.organigrama .btn-add{background:var(--ocre);color:#fff;}
.organigrama .btn-add:hover{background:#B56A22;}
.organigrama .btn-ghost{background:transparent;border:1px solid var(--line);color:var(--muted);}
.organigrama .btn-ghost:hover{border-color:var(--ocre);color:var(--ocre);}
.organigrama .btn-danger-mini{background:none;border:none;color:#B0A488;font-size:15px;cursor:pointer;line-height:1;padding:2px;}
.organigrama .btn-danger-mini:hover{color:var(--danger);}

.organigrama .fronts{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;}
.organigrama .front-card{background:#fff;border:1.4px solid var(--line);border-radius:8px;padding:14px 16px 16px;}
.organigrama .front-card .fc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;}
.organigrama .front-card .fc-acceso{display:flex;align-items:center;justify-content:center;margin:-4px 0 8px;}
.organigrama .front-card .acceso{font-size:10.5px;color:#A79A78;letter-spacing:0.4px;text-transform:uppercase;}
.organigrama .front-card .acceso.ok{color:#4B7355;}
.organigrama .front-card input.name-input{font-size:14.5px;font-weight:700;color:var(--navy);border:none;background:transparent;width:100%;border-bottom:1px dashed transparent;}
.organigrama .front-card input.name-input:focus{outline:none;border-bottom:1px dashed var(--ocre);}
.organigrama .person{padding:8px 0;border-top:1px solid #EFE9D8;}
.organigrama .person .pline1{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.organigrama .person .pname{font-size:13px;font-weight:600;flex:1;min-width:0;word-break:break-word;}
.organigrama .person .pline2{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.organigrama .person select.role-select{font-size:11px;border:1px solid var(--line);border-radius:4px;background:#FBF9F3;color:var(--muted);padding:3px 4px;}
.organigrama .person select.move-select{font-size:11px;border:1px solid var(--line);border-radius:4px;background:#FBF9F3;color:var(--muted);padding:3px 4px;max-width:130px;}
.organigrama .add-person-row{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);display:flex;gap:6px;flex-wrap:wrap;}
.organigrama .add-person-row input[type=text]{flex:1;min-width:110px;font-size:16px;padding:6px 8px;border:1px solid var(--line);border-radius:4px;background:#FBF9F3;}
.organigrama .add-person-row select{font-size:12px;padding:6px 6px;border:1px solid var(--line);border-radius:4px;background:#FBF9F3;}
.organigrama .add-person-row button{padding:6px 10px;font-size:11.5px;}
.organigrama .empty-hint{font-size:12px;color:#A79A78;font-style:italic;padding:6px 0;}
.organigrama footer{text-align:center;padding:18px 20px;font-size:11px;color:#A79A78;font-style:italic;}

@media (max-width:640px){
  .organigrama header{padding:18px 16px 12px;}
  .organigrama main{padding:0 12px;}
  .organigrama .box.ops{min-width:100%;}
  .organigrama .front-card input.name-input{font-size:16px;}
  .organigrama .person select.role-select,
  .organigrama .person select.move-select,
  .organigrama .add-person-row select{font-size:16px;}
}
`;

function FrenteCard({ frente, otros, onRename, onDelete, onAdd, onRemove, onRol, onMove }) {
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRol, setNuevoRol] = useState(ROLES[0]);

  async function agregar() {
    const ok = await onAdd(frente, nuevoNombre, nuevoRol);
    if (ok) {
      setNuevoNombre("");
      setNuevoRol(ROLES[0]);
    }
  }

  return (
    <div className="front-card">
      <div className="fc-head">
        <input
          className="name-input"
          defaultValue={frente.nombre}
          onBlur={(e) => onRename(frente, e.target.value)}
          placeholder="Nombre del frente"
        />
        <button className="btn-danger-mini" title="Eliminar este frente" onClick={() => onDelete(frente)}>
          ✕
        </button>
      </div>
      <div className="fc-acceso">
        {frente.encargado_user_id ? (
          <span className="acceso ok" title="Encargado con cuenta vinculada">
            ✓ Encargado con acceso
          </span>
        ) : (
          <span className="acceso" title="Sin cuenta vinculada para cargar partes diarios">
            Sin acceso de encargado
          </span>
        )}
      </div>

      {frente.frente_personas.length === 0 && <div className="empty-hint">Sin personal asignado.</div>}

      {frente.frente_personas.map((p) => (
        <div className="person" key={p.id}>
          <div className="pline1">
            <span className="pname">{p.nombre}</span>
            <button className="btn-danger-mini" title="Sacar de este frente" onClick={() => onRemove(frente, p)}>
              ✕
            </button>
          </div>
          <div className="pline2">
            <select className="role-select" value={p.rol} onChange={(e) => onRol(frente, p, e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select className="move-select" value="" onChange={(e) => onMove(frente, p, e.target.value)}>
              <option value="">Mover a…</option>
              {otros.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      <div className="add-person-row">
        <input
          type="text"
          placeholder="Nombre y apellido"
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
        />
        <select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={agregar}>
          + Agregar
        </button>
      </div>
    </div>
  );
}

function OrganigramaInner() {
  const [frentes, setFrentes] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  async function cargar() {
    setLoading(true);
    const [resFrentes, resPersonas, resEmpleados] = await Promise.all([
      supabase.from("frentes_trabajo").select("id, nombre, encargado_user_id").order("nombre"),
      supabase.from("frente_personas").select("id, frente_id, nombre, rol").order("created_at"),
      supabase.from("empleados").select("id, apellido, nombre").eq("activo", true).order("apellido"),
    ]);
    if (resFrentes.error) {
      setStatus({ msg: "No se pudo cargar el organigrama: " + resFrentes.error.message, error: true });
    } else {
      const personas = resPersonas.error ? [] : resPersonas.data || [];
      setFrentes(
        (resFrentes.data || []).map((f) => ({
          ...f,
          frente_personas: personas.filter((p) => p.frente_id === f.id),
        }))
      );
    }
    if (!resEmpleados.error) setOperarios(resEmpleados.data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function showStatus(msg, error) {
    setStatus({ msg, error });
    if (!error) {
      setTimeout(() => setStatus((s) => (s && s.msg === msg ? null : s)), 1800);
    }
  }

  async function addFrente() {
    const nm = window.prompt("Nombre del nuevo frente de trabajo (ej: nombre de la obra o cliente):");
    if (!nm || !nm.trim()) return;
    const { data, error } = await supabase.from("frentes_trabajo").insert({ nombre: nm.trim() }).select().single();
    if (error) {
      showStatus("No se pudo guardar el cambio. Probá de nuevo.", true);
      return;
    }
    setFrentes((prev) => [...prev, { ...data, frente_personas: [] }]);
    showStatus("Guardado ✓");
  }

  async function deleteFrente(frente) {
    if (frente.frente_personas.length && !window.confirm(`"${frente.nombre}" tiene personas asignadas. ¿Eliminar igual?`)) return;
    const { error } = await supabase.from("frentes_trabajo").delete().eq("id", frente.id);
    if (error) {
      showStatus("No se pudo guardar el cambio. Probá de nuevo.", true);
      return;
    }
    setFrentes((prev) => prev.filter((f) => f.id !== frente.id));
    showStatus("Guardado ✓");
  }

  async function renameFrente(frente, nombre) {
    const nm = nombre.trim();
    if (!nm || nm === frente.nombre) return;
    const { error } = await supabase.from("frentes_trabajo").update({ nombre: nm }).eq("id", frente.id);
    if (error) {
      showStatus("No se pudo guardar el cambio. Probá de nuevo.", true);
      return;
    }
    setFrentes((prev) => prev.map((f) => (f.id === frente.id ? { ...f, nombre: nm } : f)));
    showStatus("Guardado ✓");
  }

  async function addPersona(frente, nombre, rol) {
    const nm = nombre.trim();
    if (!nm) return false;
    const { data, error } = await supabase
      .from("frente_personas")
      .insert({ frente_id: frente.id, nombre: nm, rol })
      .select()
      .single();
    if (error) {
      showStatus("No se pudo guardar el cambio. Probá de nuevo.", true);
      return false;
    }
    setFrentes((prev) => prev.map((f) => (f.id === frente.id ? { ...f, frente_personas: [...f.frente_personas, data] } : f)));
    showStatus("Guardado ✓");
    return true;
  }

  async function removePersona(frente, persona) {
    const { error } = await supabase.from("frente_personas").delete().eq("id", persona.id);
    if (error) {
      showStatus("No se pudo guardar el cambio. Probá de nuevo.", true);
      return;
    }
    setFrentes((prev) =>
      prev.map((f) => (f.id === frente.id ? { ...f, frente_personas: f.frente_personas.filter((p) => p.id !== persona.id) } : f))
    );
    showStatus("Guardado ✓");
  }

  async function changeRol(frente, persona, rol) {
    const { error } = await supabase.from("frente_personas").update({ rol }).eq("id", persona.id);
    if (error) {
      showStatus("No se pudo guardar el cambio. Probá de nuevo.", true);
      return;
    }
    setFrentes((prev) =>
      prev.map((f) =>
        f.id === frente.id
          ? { ...f, frente_personas: f.frente_personas.map((p) => (p.id === persona.id ? { ...p, rol } : p)) }
          : f
      )
    );
    showStatus("Guardado ✓");
  }

  async function movePersona(origen, persona, targetId) {
    if (!targetId) return;
    const { error } = await supabase.from("frente_personas").update({ frente_id: targetId }).eq("id", persona.id);
    if (error) {
      showStatus("No se pudo guardar el cambio. Probá de nuevo.", true);
      return;
    }
    setFrentes((prev) =>
      prev.map((f) => {
        if (f.id === origen.id) return { ...f, frente_personas: f.frente_personas.filter((p) => p.id !== persona.id) };
        if (f.id === targetId) return { ...f, frente_personas: [...f.frente_personas, persona] };
        return f;
      })
    );
    showStatus("Guardado ✓");
  }

  return (
    <div className="organigrama">
      <style>{CSS}</style>
      <header>
        <h1>Organigrama — Simonetti Montajes Industriales</h1>
        <p>
          La parte fija de la empresa no cambia. Los frentes de trabajo sí — agregá, movés o sacás gente cuando roten de
          obra.
        </p>
        <div className="status">{status?.msg || ""}</div>
      </header>

      <div className="fixed-chart">
        <div className="box top">
          <b>Daniel Simonetti</b>
          <span className="role">Dueño — Encargado de pagos</span>
        </div>
        <div className="connector" />
        <div className="row">
          <div className="box mid">
            <b>Sub-gerencia</b>
            <span className="role">Encargada de Administración</span>
          </div>
          <div className="box mid">
            <b>Jesús Romero</b>
            <span className="role">Encargado de Fabricación — Taller</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <div className="box leaf">
            <b>Valentino Rodulfo</b>
            <span className="role">Administración, RR.HH., mercaderías, corte láser</span>
          </div>
          <div className="box leaf ops">
            <b>Operarios de Taller</b>
            <span className="role">Grilla de empleados de fabricación</span>
            {loading ? (
              <span className="role" style={{ marginTop: 6 }}>
                Cargando…
              </span>
            ) : operarios.length === 0 ? (
              <span className="role" style={{ marginTop: 6 }}>
                Sin empleados activos en la grilla
              </span>
            ) : (
              <ul className="ops-list">
                {operarios.map((o) => (
                  <li key={o.id}>
                    {o.apellido}, {o.nombre}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <main>
        <div className="section-title">
          <div>
            <h2>Frentes de trabajo (escuadrillas externas)</h2>
            <p>Editable — los cambios se guardan solos.</p>
          </div>
          <button className="btn-add" onClick={addFrente}>
            + Nuevo frente
          </button>
        </div>
        <div className="fronts">
          {frentes.map((f) => (
            <FrenteCard
              key={f.id}
              frente={f}
              otros={frentes.filter((x) => x.id !== f.id)}
              onRename={renameFrente}
              onDelete={deleteFrente}
              onAdd={addPersona}
              onRemove={removePersona}
              onRol={changeRol}
              onMove={movePersona}
            />
          ))}
        </div>
      </main>

      <footer>Simonetti Montajes Industriales</footer>
    </div>
  );
}

export default function OrganigramaPage() {
  return (
    <AdminGuard>
      <OrganigramaInner />
    </AdminGuard>
  );
}

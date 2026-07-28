"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const emptyForm = {
  legajo_nro: "",
  apellido: "",
  nombre: "",
  domicilio: "",
  localidad: "",
  cuil: "",
  fecha_ingreso: "",
  fecha_antiguedad: "",
  categoria: "",
  tipo_contrato: "Pers. Construcción",
  sueldo_basico: "",
  banco: "",
  lugar_pago: "",
};

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarEmpleados();
  }, [mostrarInactivos]);

  async function cargarEmpleados() {
    setLoading(true);
    let query = supabase
      .from("empleados")
      .select("*")
      .order("apellido", { ascending: true });

    if (!mostrarInactivos) {
      query = query.eq("activo", true);
    }

    const { data, error } = await query;
    if (error) {
      setError("Error al cargar empleados: " + error.message);
    } else {
      setEmpleados(data);
      setError("");
    }
    setLoading(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validarForm() {
    if (!form.legajo_nro.trim()) return "El legajo es obligatorio";
    if (!form.apellido.trim()) return "El apellido es obligatorio";
    if (!form.nombre.trim()) return "El nombre es obligatorio";
    if (!form.sueldo_basico || isNaN(Number(form.sueldo_basico)))
      return "El sueldo básico debe ser un número válido";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return; // evita doble envío

    const errorValidacion = validarForm();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      sueldo_basico: Number(form.sueldo_basico),
      fecha_ingreso: form.fecha_ingreso || null,
      fecha_antiguedad: form.fecha_antiguedad || null,
    };

    let result;
    if (editId) {
      result = await supabase
        .from("empleados")
        .update(payload)
        .eq("id", editId);
    } else {
      result = await supabase.from("empleados").insert([payload]);
    }

    if (result.error) {
      setError("Error al guardar: " + result.error.message);
    } else {
      setForm(emptyForm);
      setEditId(null);
      await cargarEmpleados();
    }
    setSaving(false);
  }

  function handleEditar(emp) {
    setEditId(emp.id);
    setForm({
      legajo_nro: emp.legajo_nro || "",
      apellido: emp.apellido || "",
      nombre: emp.nombre || "",
      domicilio: emp.domicilio || "",
      localidad: emp.localidad || "",
      cuil: emp.cuil || "",
      fecha_ingreso: emp.fecha_ingreso || "",
      fecha_antiguedad: emp.fecha_antiguedad || "",
      categoria: emp.categoria || "",
      tipo_contrato: emp.tipo_contrato || "Pers. Construcción",
      sueldo_basico: emp.sueldo_basico ?? "",
      banco: emp.banco || "",
      lugar_pago: emp.lugar_pago || "",
    });
  }

  function handleCancelarEdicion() {
    setEditId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleArchivar(emp) {
    const nuevoEstado = !emp.activo;
    const confirmMsg = nuevoEstado
      ? `¿Reactivar a ${emp.apellido}, ${emp.nombre}?`
      : `¿Archivar a ${emp.apellido}, ${emp.nombre}? No se va a poder liquidar mientras esté archivado.`;

    if (!window.confirm(confirmMsg)) return;

    const { error } = await supabase
      .from("empleados")
      .update({ activo: nuevoEstado })
      .eq("id", emp.id);

    if (error) {
      setError("Error al actualizar estado: " + error.message);
    } else {
      await cargarEmpleados();
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#163A5F" }}>
        Empleados
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {/* Formulario alta/edición */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-lg p-4 md:p-6 mb-8 shadow-sm"
      >
        <h2 className="font-semibold mb-4" style={{ color: "#2E6F9E" }}>
          {editId ? "Editar empleado" : "Nuevo empleado"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo label="Legajo N°" name="legajo_nro" value={form.legajo_nro} onChange={handleChange} />
          <Campo label="Apellido" name="apellido" value={form.apellido} onChange={handleChange} />
          <Campo label="Nombre" name="nombre" value={form.nombre} onChange={handleChange} />

          <Campo label="C.U.I.L." name="cuil" value={form.cuil} onChange={handleChange} placeholder="20-12345678-9" />
          <Campo label="Domicilio" name="domicilio" value={form.domicilio} onChange={handleChange} />
          <Campo label="Localidad" name="localidad" value={form.localidad} onChange={handleChange} />

          <Campo label="Categoría" name="categoria" value={form.categoria} onChange={handleChange} placeholder="Ayudante, Oficial..." />
          <Campo label="Tipo de contrato" name="tipo_contrato" value={form.tipo_contrato} onChange={handleChange} />
          <Campo label="Sueldo Básico" name="sueldo_basico" type="number" value={form.sueldo_basico} onChange={handleChange} />

          <Campo label="Fecha de Ingreso" name="fecha_ingreso" type="date" value={form.fecha_ingreso} onChange={handleChange} />
          <Campo label="Fecha Antigüedad" name="fecha_antiguedad" type="date" value={form.fecha_antiguedad} onChange={handleChange} />
          <Campo label="Banco" name="banco" value={form.banco} onChange={handleChange} />

          <Campo label="Lugar de pago" name="lugar_pago" value={form.lugar_pago} onChange={handleChange} />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: "#2E6F9E" }}
          >
            {saving ? "Guardando..." : editId ? "Guardar cambios" : "Agregar empleado"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={handleCancelarEdicion}
              className="px-4 py-2 rounded border font-medium"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Listado */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold" style={{ color: "#2E6F9E" }}>
          Listado
        </h2>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
          />
          Mostrar archivados
        </label>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "#163A5F" }}>
              <tr className="text-white text-left">
                <th className="p-2">Legajo</th>
                <th className="p-2">Apellido y Nombre</th>
                <th className="p-2">CUIL</th>
                <th className="p-2">Categoría</th>
                <th className="p-2">Sueldo Básico</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp, i) => (
                <tr
                  key={emp.id}
                  className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="p-2">{emp.legajo_nro}</td>
                  <td className="p-2">
                    {emp.apellido}, {emp.nombre}
                  </td>
                  <td className="p-2">{emp.cuil}</td>
                  <td className="p-2">{emp.categoria}</td>
                  <td className="p-2">
                    {Number(emp.sueldo_basico).toLocaleString("es-AR", {
                      style: "currency",
                      currency: "ARS",
                    })}
                  </td>
                  <td className="p-2">
                    {emp.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Archivado</span>
                    )}
                  </td>
                  <td className="p-2 flex gap-2">
                    <button
                      onClick={() => handleEditar(emp)}
                      className="text-blue-700 underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleArchivar(emp)}
                      className="text-red-600 underline"
                    >
                      {emp.activo ? "Archivar" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              ))}
              {empleados.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    No hay empleados cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Campo({ label, name, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "#0B0E13" }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2 text-sm"
      />
    </div>
  );
}

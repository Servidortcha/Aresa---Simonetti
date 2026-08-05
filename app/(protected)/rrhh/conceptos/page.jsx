"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import AdminGuard from "../../../../components/AdminGuard";

const emptyForm = {
  codigo: "",
  nombre: "",
  tipo: "haber_con_desc",
  modo_calculo: "manual",
  porcentaje: "",
  orden: "",
};

const TIPO_LABEL = {
  haber_con_desc: "Haber con descuento",
  haber_sin_desc: "Haber sin descuento",
  descuento: "Descuento",
};

const MODO_LABEL = {
  porcentaje_basico: "% del básico",
  monto_fijo: "Monto fijo",
  manual: "Manual (se carga cada vez)",
};

export default function ConceptosPage() {
  return (
    <AdminGuard>
      <ConceptosPageInner />
    </AdminGuard>
  );
}

function ConceptosPageInner() {
  const [conceptos, setConceptos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarConceptos();
  }, [mostrarInactivos]);

  async function cargarConceptos() {
    setLoading(true);
    let query = supabase
      .from("conceptos")
      .select("*")
      .order("orden", { ascending: true });

    if (!mostrarInactivos) {
      query = query.eq("activo", true);
    }

    const { data, error } = await query;
    if (error) {
      setError("Error al cargar conceptos: " + error.message);
    } else {
      setConceptos(data);
      setError("");
    }
    setLoading(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validarForm() {
    if (!form.nombre.trim()) return "El nombre es obligatorio";
    if (form.modo_calculo === "porcentaje_basico" && !form.porcentaje)
      return "Si el modo es % del básico, tenés que indicar el porcentaje";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const errorValidacion = validarForm();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      codigo: form.codigo || null,
      nombre: form.nombre,
      tipo: form.tipo,
      modo_calculo: form.modo_calculo,
      porcentaje:
        form.modo_calculo === "porcentaje_basico" && form.porcentaje
          ? Number(form.porcentaje)
          : null,
      orden: form.orden ? Number(form.orden) : 0,
    };

    let result;
    if (editId) {
      result = await supabase.from("conceptos").update(payload).eq("id", editId);
    } else {
      result = await supabase.from("conceptos").insert([payload]);
    }

    if (result.error) {
      setError("Error al guardar: " + result.error.message);
    } else {
      setForm(emptyForm);
      setEditId(null);
      await cargarConceptos();
    }
    setSaving(false);
  }

  function handleEditar(c) {
    setEditId(c.id);
    setForm({
      codigo: c.codigo || "",
      nombre: c.nombre || "",
      tipo: c.tipo,
      modo_calculo: c.modo_calculo,
      porcentaje: c.porcentaje ?? "",
      orden: c.orden ?? "",
    });
  }

  function handleCancelarEdicion() {
    setEditId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleArchivar(c) {
    const nuevoEstado = !c.activo;
    const confirmMsg = nuevoEstado
      ? `¿Reactivar "${c.nombre}"?`
      : `¿Archivar "${c.nombre}"? Ya no va a aparecer al liquidar.`;
    if (!window.confirm(confirmMsg)) return;

    const { error } = await supabase
      .from("conceptos")
      .update({ activo: nuevoEstado })
      .eq("id", c.id);

    if (error) {
      setError("Error al actualizar estado: " + error.message);
    } else {
      await cargarConceptos();
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1
        className="text-2xl font-bold mb-6"
        style={{ fontFamily: "Space Grotesk, sans-serif", color: "#163A5F" }}
      >
        Conceptos de Liquidación
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-lg p-4 md:p-6 mb-8 shadow-sm"
      >
        <h2 className="font-semibold mb-4" style={{ color: "#2E6F9E" }}>
          {editId ? "Editar concepto" : "Nuevo concepto"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo label="Código" name="codigo" value={form.codigo} onChange={handleChange} />
          <Campo label="Nombre" name="nombre" value={form.nombre} onChange={handleChange} />
          <Campo label="Orden" name="orden" type="number" value={form.orden} onChange={handleChange} />

          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {Object.entries(TIPO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modo de cálculo</label>
            <select
              name="modo_calculo"
              value={form.modo_calculo}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {Object.entries(MODO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {form.modo_calculo === "porcentaje_basico" && (
            <Campo
              label="Porcentaje (%)"
              name="porcentaje"
              type="number"
              value={form.porcentaje}
              onChange={handleChange}
            />
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: "#2E6F9E" }}
          >
            {saving ? "Guardando..." : editId ? "Guardar cambios" : "Agregar concepto"}
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
                <th className="p-2">Orden</th>
                <th className="p-2">Código</th>
                <th className="p-2">Nombre</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Modo de cálculo</th>
                <th className="p-2">%</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {conceptos.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="p-2">{c.orden}</td>
                  <td className="p-2">{c.codigo}</td>
                  <td className="p-2">{c.nombre}</td>
                  <td className="p-2">{TIPO_LABEL[c.tipo]}</td>
                  <td className="p-2">{MODO_LABEL[c.modo_calculo]}</td>
                  <td className="p-2">{c.porcentaje ? `${c.porcentaje}%` : "-"}</td>
                  <td className="p-2">
                    {c.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Archivado</span>
                    )}
                  </td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => handleEditar(c)} className="text-blue-700 underline">
                      Editar
                    </button>
                    <button onClick={() => handleArchivar(c)} className="text-red-600 underline">
                      {c.activo ? "Archivar" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              ))}
              {conceptos.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No hay conceptos cargados.
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

function Campo({ label, name, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full border rounded px-3 py-2 text-sm"
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import AdminGuard from "../../../../components/AdminGuard";

// Datos fijos de la empresa (encabezado del recibo)
const EMPRESA = {
  nombre: "SIMONETTI, DANIEL EDUARDO",
  direccion: "INT. SEBASTIÁN SCARAFIA N° 131 - (5933) TANCACHA - CÓRDOBA",
  cuit: "CUIT 20-28273146-1 - IIBB 280-761338 - IVA RESPONSABLE INSCRIPTO",
  rubro: "MONTAJES INDUSTRIALES",
};

const TIPO_LABEL = {
  quincena1: "1° Quinc.",
  quincena2: "2° Quinc.",
  sac: "SAC",
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function numeroALetras(num) {
  // Conversión simple de número a letras para pesos argentinos
  const unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const especiales = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
  const decenas = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const centenas = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

  function convertirGrupo(n) {
    if (n === 0) return "";
    if (n === 100) return "cien";
    let resultado = "";
    if (n >= 100) {
      resultado += centenas[Math.floor(n / 100)] + " ";
      n %= 100;
    }
    if (n >= 10 && n < 20) {
      resultado += especiales[n - 10];
      return resultado.trim();
    }
    if (n >= 20) {
      resultado += decenas[Math.floor(n / 10)];
      if (n % 10 > 0) resultado += " y " + unidades[n % 10];
      return resultado.trim();
    }
    resultado += unidades[n];
    return resultado.trim();
  }

  function convertirEntero(n) {
    if (n === 0) return "cero";
    let partes = [];
    const millones = Math.floor(n / 1000000);
    const miles = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;

    if (millones > 0) {
      partes.push(millones === 1 ? "un millón" : convertirGrupo(millones) + " millones");
    }
    if (miles > 0) {
      partes.push(miles === 1 ? "mil" : convertirGrupo(miles) + " mil");
    }
    if (resto > 0) {
      partes.push(convertirGrupo(resto));
    }
    return partes.join(" ") || "cero";
  }

  const entero = Math.floor(Math.abs(num));
  const centavos = Math.round((Math.abs(num) - entero) * 100);
  const centavosStr = String(centavos).padStart(2, "0");
  return `${convertirEntero(entero)} con ${centavosStr}/100`;
}

function formatearMoneda(n) {
  return Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

export default function LiquidacionPage() {
  return (
    <AdminGuard>
      <LiquidacionPageInner />
    </AdminGuard>
  );
}

function LiquidacionPageInner() {
  const [empleados, setEmpleados] = useState([]);
  const [empleadoId, setEmpleadoId] = useState("");
  const [tipo, setTipo] = useState("quincena1");
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [fechaPago, setFechaPago] = useState("");
  const [fechaDeposito, setFechaDeposito] = useState("");
  const [detalle, setDetalle] = useState([]); // filas editables
  const [empleadoActual, setEmpleadoActual] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensajeOk, setMensajeOk] = useState("");

  useEffect(() => {
    cargarEmpleados();
  }, []);

  async function cargarEmpleados() {
    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .eq("activo", true)
      .order("apellido", { ascending: true });
    if (!error) setEmpleados(data);
  }

  async function generarLiquidacion() {
    if (!empleadoId) {
      setError("Elegí un empleado primero");
      return;
    }
    setLoading(true);
    setError("");
    setMensajeOk("");

    const emp = empleados.find((e) => e.id === empleadoId);
    setEmpleadoActual(emp);

    const { data: conceptos, error: errConceptos } = await supabase
      .from("conceptos")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (errConceptos) {
      setError("Error al cargar conceptos: " + errConceptos.message);
      setLoading(false);
      return;
    }

    const basico = Number(emp.sueldo_basico || 0);

    const filas = conceptos.map((c) => {
      let monto = 0;
      let cantidad = "";
      if (c.modo_calculo === "porcentaje_basico" && c.tipo === "descuento") {
        monto = Math.round(basico * (Number(c.porcentaje) / 100) * 100) / 100;
        cantidad = c.porcentaje;
      } else if (c.nombre.toLowerCase().includes("sueldo básico") || c.nombre.toLowerCase().includes("sueldo basico")) {
        monto = tipo === "sac" ? 0 : basico;
      }
      return {
        concepto_id: c.id,
        concepto_nombre: c.nombre,
        tipo: c.tipo,
        cantidad,
        monto,
        orden: c.orden,
      };
    });

    setDetalle(filas);
    setLoading(false);
  }

  function actualizarFila(index, campo, valor) {
    setDetalle((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [campo]: valor } : f))
    );
  }

  function calcularTotales() {
    const totalConDesc = detalle
      .filter((f) => f.tipo === "haber_con_desc")
      .reduce((acc, f) => acc + Number(f.monto || 0), 0);
    const totalSinDesc = detalle
      .filter((f) => f.tipo === "haber_sin_desc")
      .reduce((acc, f) => acc + Number(f.monto || 0), 0);
    const totalDescuentos = detalle
      .filter((f) => f.tipo === "descuento")
      .reduce((acc, f) => acc + Number(f.monto || 0), 0);
    const bruto = totalConDesc + totalSinDesc;
    const neto = bruto - totalDescuentos;
    return { totalConDesc, totalSinDesc, totalDescuentos, bruto, neto };
  }

  async function handleGuardar() {
    if (!empleadoActual) return;
    setGuardando(true);
    setError("");

    const totales = calcularTotales();
    const mesLiquidadoTexto =
      tipo === "sac"
        ? `SAC ${MESES[mes - 1]} ${anio}`
        : `Sueldo ${MESES[mes - 1]} ${anio} - ${TIPO_LABEL[tipo]}`;

    const { data: liq, error: errLiq } = await supabase
      .from("liquidaciones")
      .insert([
        {
          empleado_id: empleadoActual.id,
          periodo_mes: mes,
          periodo_anio: anio,
          tipo,
          mes_liquidado_texto: mesLiquidadoTexto,
          fecha_pago: fechaPago || null,
          fecha_deposito: fechaDeposito || null,
          banco: empleadoActual.banco,
          lugar_pago: empleadoActual.lugar_pago,
          sueldo_basico: empleadoActual.sueldo_basico,
          total_hab_con_desc: totales.totalConDesc,
          total_hab_sin_desc: totales.totalSinDesc,
          total_descuentos: totales.totalDescuentos,
          sueldo_bruto: totales.bruto,
          neto_a_cobrar: totales.neto,
        },
      ])
      .select()
      .single();

    if (errLiq) {
      setError("Error al guardar liquidación: " + errLiq.message);
      setGuardando(false);
      return;
    }

    const filasDetalle = detalle.map((f) => ({
      liquidacion_id: liq.id,
      concepto_id: f.concepto_id,
      concepto_nombre: f.concepto_nombre,
      tipo: f.tipo,
      cantidad: f.cantidad === "" ? null : Number(f.cantidad),
      monto: Number(f.monto || 0),
      orden: f.orden,
    }));

    const { error: errDetalle } = await supabase
      .from("liquidacion_detalle")
      .insert(filasDetalle);

    if (errDetalle) {
      setError("Error al guardar el detalle: " + errDetalle.message);
    } else {
      setMensajeOk("Liquidación guardada correctamente.");
    }
    setGuardando(false);
  }

  function handleImprimir() {
    if (!empleadoActual) return;
    const totales = calcularTotales();
    const mesLiquidadoTexto =
      tipo === "sac"
        ? `SAC ${MESES[mes - 1]} ${anio}`
        : `Sueldo ${MESES[mes - 1]} ${anio} - ${TIPO_LABEL[tipo]}`;

    const filasHtml = detalle
      .map((f) => {
        const habConDesc = f.tipo === "haber_con_desc" ? formatearMoneda(f.monto) : "";
        const habSinDesc = f.tipo === "haber_sin_desc" ? formatearMoneda(f.monto) : "";
        const desc = f.tipo === "descuento" ? formatearMoneda(f.monto) : "";
        return `<tr>
          <td></td>
          <td>${esc(f.concepto_nombre)}</td>
          <td style="text-align:right">${f.cantidad !== "" && f.cantidad !== null ? esc(f.cantidad) : ""}</td>
          <td style="text-align:right">${habConDesc}</td>
          <td style="text-align:right">${habSinDesc}</td>
          <td style="text-align:right">${desc}</td>
        </tr>`;
      })
      .join("");

    const html = `
    <html>
    <head>
      <title>Recibo - ${esc(empleadoActual.apellido)}, ${esc(empleadoActual.nombre)}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #333; padding: 4px 6px; }
        .header-table td { border: none; padding: 2px 6px; }
        .titulo { text-align: center; font-weight: bold; font-size: 15px; }
        .subtitulo { text-align: center; font-size: 11px; }
        .totales td { font-weight: bold; }
        .firma { margin-top: 40px; display: flex; justify-content: space-between; }
        .firma div { width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 4px; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr><td colspan="4" class="titulo">${EMPRESA.nombre}</td></tr>
        <tr><td colspan="4" class="subtitulo">${EMPRESA.direccion}</td></tr>
        <tr><td colspan="4" class="subtitulo">${EMPRESA.cuit}</td></tr>
        <tr><td colspan="4" class="subtitulo">${EMPRESA.rubro}</td></tr>
      </table>
      <table style="margin-top:10px">
        <tr>
          <td><b>Legajo N°</b><br>${esc(empleadoActual.legajo_nro)}</td>
          <td><b>Apellido y Nombre</b><br>${esc(empleadoActual.apellido)}, ${esc(empleadoActual.nombre)}</td>
          <td><b>Mes Liquidado</b><br>${esc(mesLiquidadoTexto)}</td>
        </tr>
        <tr>
          <td><b>C.U.I.L.</b><br>${esc(empleadoActual.cuil || "")}</td>
          <td><b>Categoría</b><br>${esc(empleadoActual.categoria || "")}</td>
          <td><b>Sueldo Básico</b><br>${formatearMoneda(empleadoActual.sueldo_basico)}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Domicilio / Localidad</b><br>${esc(empleadoActual.domicilio || "")} - ${esc(empleadoActual.localidad || "")}</td>
          <td><b>Banco</b><br>${esc(empleadoActual.banco || "")}</td>
        </tr>
      </table>
      <table style="margin-top:10px">
        <thead>
          <tr>
            <th>Cód.</th>
            <th>Concepto</th>
            <th>Cant.</th>
            <th>Hab. c/ Desc.</th>
            <th>Hab. s/ Desc.</th>
            <th>Desc.</th>
          </tr>
        </thead>
        <tbody>
          ${filasHtml}
          <tr class="totales">
            <td colspan="3">Totales:</td>
            <td style="text-align:right">${formatearMoneda(totales.totalConDesc)}</td>
            <td style="text-align:right">${formatearMoneda(totales.totalSinDesc)}</td>
            <td style="text-align:right">${formatearMoneda(totales.totalDescuentos)}</td>
          </tr>
        </tbody>
      </table>
      <table style="margin-top:10px">
        <tr class="totales"><td>Sueldo Bruto:</td><td style="text-align:right">${formatearMoneda(totales.bruto)}</td></tr>
      </table>
      <table style="margin-top:10px">
        <tr><td><b>Neto a Cobrar:</b> $ ${formatearMoneda(totales.neto)}</td></tr>
        <tr><td><b>Son Pesos:</b> <i>${numeroALetras(totales.neto)}</i></td></tr>
      </table>
      <div class="firma">
        <div>Firma del Empleado</div>
        <div>Firma del Empleador</div>
      </div>
    </body>
    </html>
    `;

    const ventana = window.open("", "_blank");
    ventana.document.write(html);
    ventana.document.close();
    ventana.print();
  }

  const totales = calcularTotales();

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#163A5F" }}>
        Liquidación de Sueldos
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}
      {mensajeOk && (
        <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-2 rounded mb-4">
          {mensajeOk}
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 md:p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Empleado</label>
            <select
              value={empleadoId}
              onChange={(e) => setEmpleadoId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.apellido}, {e.nombre} (Legajo {e.legajo_nro})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tipo de liquidación</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="quincena1">1° Quincena</option>
              <option value="quincena2">2° Quincena</option>
              <option value="sac">SAC (Aguinaldo)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Mes</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {MESES.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Año</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fecha de pago</label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fecha de depósito</label>
            <input
              type="date"
              value={fechaDeposito}
              onChange={(e) => setFechaDeposito(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={generarLiquidacion}
          disabled={loading}
          className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: "#2E6F9E" }}
        >
          {loading ? "Generando..." : "Generar liquidación"}
        </button>
      </div>

      {detalle.length > 0 && (
        <>
          <div className="bg-white border rounded-lg p-4 md:p-6 mb-6 shadow-sm overflow-x-auto">
            <h2 className="font-semibold mb-4" style={{ color: "#2E6F9E" }}>
              Detalle (editable antes de confirmar)
            </h2>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "#163A5F" }}>
                <tr className="text-white text-left">
                  <th className="p-2">Concepto</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Cantidad / %</th>
                  <th className="p-2">Monto</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((f, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-2">{f.concepto_nombre}</td>
                    <td className="p-2">
                      {f.tipo === "haber_con_desc" && "Haber c/desc"}
                      {f.tipo === "haber_sin_desc" && "Haber s/desc"}
                      {f.tipo === "descuento" && "Descuento"}
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={f.cantidad}
                        onChange={(e) => actualizarFila(i, "cantidad", e.target.value)}
                        className="w-20 border rounded px-2 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={f.monto}
                        onChange={(e) => actualizarFila(i, "monto", e.target.value)}
                        className="w-32 border rounded px-2 py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 text-sm space-y-1 text-right">
              <p>Total Haberes c/Desc: <b>{formatearMoneda(totales.totalConDesc)}</b></p>
              <p>Total Haberes s/Desc: <b>{formatearMoneda(totales.totalSinDesc)}</b></p>
              <p>Total Descuentos: <b>{formatearMoneda(totales.totalDescuentos)}</b></p>
              <p>Sueldo Bruto: <b>{formatearMoneda(totales.bruto)}</b></p>
              <p className="text-lg">Neto a Cobrar: <b>${formatearMoneda(totales.neto)}</b></p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: "#2E6F9E" }}
            >
              {guardando ? "Guardando..." : "Confirmar y guardar"}
            </button>
            <button
              onClick={handleImprimir}
              className="px-4 py-2 rounded border font-medium"
              style={{ borderColor: "#163A5F", color: "#163A5F" }}
            >
              Imprimir recibo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

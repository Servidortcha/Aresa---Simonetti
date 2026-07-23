"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/AuthContext";
import * as dxfIO from "../../../lib/nesting/dxfIO";
import * as geo from "../../../lib/nesting/geometry";
import * as nesting from "../../../lib/nesting/nesting";
import { Scissors, Upload, X, Download, AlertTriangle, Loader2 } from "lucide-react";

const inputCls = "w-full px-3 py-2 bg-white border border-line rounded-sm text-sm text-ink focus:outline-none focus:ring-2 focus:ring-green focus:border-transparent";

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide text-[#6B6558] mb-1">{label}</span>
      {children}
    </label>
  );
}

const COLORS = ["#2E6F9E", "#F4791E", "#4B7355", "#8A6D9E", "#B25A1E", "#3B8C82", "#6B5B95", "#C74E4E"];

function colorForPartId(partId, palette) {
  if (!palette[partId]) {
    const idx = Object.keys(palette).length % COLORS.length;
    palette[partId] = COLORS[idx];
  }
  return palette[partId];
}

// Convierte un contorno + agujeros a un atributo "d" de SVG (regla evenodd,
// asi los agujeros se ven como recortes reales de la pieza).
function toSvgPath(points, holes) {
  const ring = (pts) => "M " + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L ") + " Z";
  let d = ring(points);
  for (const h of holes || []) d += " " + ring(h);
  return d;
}

export default function NestingPage() {
  const { rol } = useAuth();
  const router = useRouter();
  const puedeAcceder = rol === "admin" || rol === "taller_stock";

  const [piezas, setPiezas] = useState([]); // { id, name, outer, holes, qty, area, error }
  const [sheetW, setSheetW] = useState("1200");
  const [maxLength, setMaxLength] = useState("");
  const [spacing, setSpacing] = useState("3");
  const [allowRotation, setAllowRotation] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null); // { sheets, unplaced }
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const paletteRef = useRef({});

  useEffect(() => {
    if (rol && !puedeAcceder) router.replace("/ingreso-egreso");
  }, [rol, puedeAcceder, router]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setError(null);
    const nuevas = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".dxf")) {
        nuevas.push({ id: crypto.randomUUID(), name: file.name, error: "No es un archivo .dxf" });
        continue;
      }
      try {
        const text = await file.text();
        const { outer, holes, warning } = dxfIO.loadDxfPiece(text);
        nuevas.push({
          id: crypto.randomUUID(),
          name: file.name,
          outer,
          holes,
          qty: 1,
          area: geo.polygonArea(outer),
          warning: warning || null,
        });
      } catch (err) {
        nuevas.push({ id: crypto.randomUUID(), name: file.name, error: err.message });
      }
    }
    setPiezas((prev) => [...prev, ...nuevas]);
  }

  function quitarPieza(id) {
    setPiezas((prev) => prev.filter((p) => p.id !== id));
  }

  function cambiarCantidad(id, qty) {
    setPiezas((prev) => prev.map((p) => (p.id === id ? { ...p, qty } : p)));
  }

  async function optimizar() {
    setError(null);
    setResultado(null);
    const validas = piezas.filter((p) => !p.error && Number(p.qty) > 0);
    if (validas.length === 0) {
      setError("Cargá al menos un DXF válido con cantidad mayor a 0.");
      return;
    }
    const w = Number(sheetW);
    if (!w || w <= 0) {
      setError("El ancho de chapa tiene que ser mayor a 0.");
      return;
    }
    setProcesando(true);
    // Pequeña pausa para que React pinte el estado "procesando" antes de
    // que el cálculo (síncrono, en el hilo principal) empiece.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const parts = validas.map((p) => ({
        part_id: p.id,
        name: p.name,
        points: p.outer,
        holes: p.holes,
        qty: Number(p.qty),
      }));
      const maxLenNum = maxLength.trim() ? Number(maxLength) : null;
      const { sheets, unplaced } = nesting.optimizeAll(parts, w, {
        spacingMm: Number(spacing) || 3,
        allowRotation,
        maxLengthMm: maxLenNum && maxLenNum > 0 ? maxLenNum : null,
      });
      setResultado({ sheets, unplaced });
    } catch (err) {
      setError("Error durante la optimización: " + err.message);
    }
    setProcesando(false);
  }

  function descargarChapa(sheet, index) {
    const dxfText = dxfIO.saveDxfLayout(sheet.pieces, sheet.width, sheet.height);
    const blob = new Blob([dxfText], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chapa_${index + 1}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPiezas = useMemo(() => piezas.filter((p) => !p.error).reduce((s, p) => s + (Number(p.qty) || 0), 0), [piezas]);

  if (rol && !puedeAcceder) return null;

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <Scissors size={20} color="#F4791E" />
        <h1 className="font-display text-3xl font-semibold">Optimización de cortes (Nesting)</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#FBEFE6] border border-[#E8C4A0] text-[#B25A1E] text-sm px-4 py-3 rounded-sm mb-5">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* --- Carga de piezas --- */}
        <div className="bg-white border border-line rounded-sm p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold mb-3">1. Piezas (archivos .dxf)</h2>

          <label className="flex items-center gap-2 border border-dashed border-line rounded-sm px-3 py-2.5 text-sm text-[#6B6558] cursor-pointer hover:bg-[#F2EEE3] transition-colors w-fit">
            <Upload size={15} />
            Elegir archivos DXF
            <input ref={fileInputRef} type="file" accept=".dxf" multiple className="hidden" onChange={handleFiles} />
          </label>

          {piezas.length > 0 && (
            <div className="mt-4 border border-line rounded-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="text-left text-xs uppercase text-[#6B6558] border-b border-line">
                    <th className="px-3 py-2 font-medium">Archivo</th>
                    <th className="px-3 py-2 font-medium">Área</th>
                    <th className="px-3 py-2 font-medium">Cantidad</th>
                    <th className="px-3 py-2 font-medium text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {piezas.map((p, idx) => (
                    <tr key={p.id} className={`${idx % 2 === 1 ? "bg-[#F7F4EC]" : ""} border-b border-[#EFEBE0] last:border-0`}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.name}</div>
                        {p.error && <div className="text-xs text-red flex items-center gap-1 mt-0.5"><AlertTriangle size={11} /> {p.error}</div>}
                        {p.warning && <div className="text-xs text-[#B25A1E] mt-0.5">{p.warning}</div>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{p.error ? "—" : `${(p.area / 100).toFixed(1)} cm²`}</td>
                      <td className="px-3 py-2">
                        {!p.error && (
                          <input
                            type="number"
                            min="1"
                            className="w-20 px-2 py-1 border border-line rounded-sm text-sm"
                            value={p.qty}
                            onChange={(e) => cambiarCantidad(p.id, e.target.value)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => quitarPieza(p.id)} className="text-[#8A8578] hover:text-red">
                          <X size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* --- Parámetros --- */}
        <div className="bg-white border border-line rounded-sm p-4 sm:p-6 max-w-xl">
          <h2 className="font-display text-lg font-semibold mb-3">2. Parámetros de la chapa</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Ancho de chapa (mm)">
              <input type="number" className={inputCls} value={sheetW} onChange={(e) => setSheetW(e.target.value)} />
            </Field>
            <Field label="Largo máximo (mm, opcional)">
              <input type="number" className={inputCls} value={maxLength} onChange={(e) => setMaxLength(e.target.value)} placeholder="Sin límite" />
            </Field>
            <Field label="Espaciado entre piezas (mm)">
              <input type="number" className={inputCls} value={spacing} onChange={(e) => setSpacing(e.target.value)} />
            </Field>
            <Field label="Rotación">
              <label className="flex items-center gap-2 h-[38px] text-sm text-ink">
                <input type="checkbox" checked={allowRotation} onChange={(e) => setAllowRotation(e.target.checked)} />
                Permitir rotar piezas libremente
              </label>
            </Field>
          </div>

          <button
            onClick={optimizar}
            disabled={procesando}
            className="w-full mt-2 bg-ink text-paper py-2.5 rounded-sm text-sm font-medium hover:bg-[#333731] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {procesando ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Optimizando {totalPiezas} pieza{totalPiezas !== 1 ? "s" : ""}...
              </>
            ) : (
              `Optimizar (${totalPiezas} pieza${totalPiezas !== 1 ? "s" : ""})`
            )}
          </button>
        </div>

        {/* --- Resultados --- */}
        {resultado && (
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-semibold">3. Resultado</h2>

            {resultado.unplaced.length > 0 && (
              <div className="flex items-start gap-2 bg-[#FBEFE6] border border-[#E8C4A0] text-[#B25A1E] text-sm px-4 py-3 rounded-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">No se pudieron ubicar {resultado.unplaced.length} pieza(s):</div>
                  <div className="text-xs mt-1">{resultado.unplaced.map((u) => u.name).join(", ")}</div>
                </div>
              </div>
            )}

            {resultado.sheets.length === 0 && resultado.unplaced.length === 0 && (
              <p className="text-sm text-[#8A8578]">No se generó ninguna chapa.</p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {resultado.sheets.map((sheet, idx) => (
                <div key={idx} className="bg-white border border-line rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">Chapa {idx + 1}</div>
                      <div className="text-xs text-[#8A8578] font-mono">
                        {sheet.width} x {sheet.height} mm · {sheet.utilization_pct}% de aprovechamiento · {sheet.pieces.length} piezas
                      </div>
                    </div>
                    <button
                      onClick={() => descargarChapa(sheet, idx)}
                      className="flex items-center gap-1.5 bg-white border border-line text-ink px-3 py-1.5 rounded-sm text-xs font-medium hover:bg-[#F2EEE3] transition-colors flex-shrink-0"
                    >
                      <Download size={13} /> DXF
                    </button>
                  </div>
                  <div className="border border-[#EFEBE0] rounded-sm overflow-hidden bg-[#FAFAF7]">
                    <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} style={{ width: "100%", height: "auto", display: "block" }}>
                      <g transform={`translate(0, ${sheet.height}) scale(1, -1)`}>
                        <rect x="0" y="0" width={sheet.width} height={sheet.height} fill="none" stroke="#B0AA9A" strokeWidth={sheet.width / 300} />
                        {sheet.pieces.map((p, pIdx) => (
                          <path
                            key={pIdx}
                            d={toSvgPath(p.points, p.holes)}
                            fillRule="evenodd"
                            fill={colorForPartId(p.part_id, paletteRef.current)}
                            fillOpacity="0.55"
                            stroke={colorForPartId(p.part_id, paletteRef.current)}
                            strokeWidth={sheet.width / 500}
                          />
                        ))}
                      </g>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";

const CSS = `
.inglete-tool{
  --blue-deep:#0F2438;
  --blue-panel:#16324D;
  --blue-line:#2E5877;
  --paper:#EFE9D8;
  --paper-line:#C9BFA0;
  --amber:#E6A23C;
  --amber-dim:#8A6323;
  --cyan:#6FC6C6;
  --ink:#0F2438;
  --white:#F6F3EA;
  --danger:#D96B5B;
  box-sizing:border-box;
  background:var(--blue-deep);
  color:var(--white);
  font-family:-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  border-radius:6px;
  overflow:hidden;
}
.inglete-tool .mono{font-family:"SF Mono","Consolas","Menlo",monospace;}
.inglete-tool header{padding:24px 28px 16px;border-bottom:1px solid var(--blue-line);}
.inglete-tool header .eyebrow{font-family:"SF Mono","Consolas","Menlo",monospace;font-size:11px;letter-spacing:3px;color:var(--amber);text-transform:uppercase;}
.inglete-tool header h1{margin:6px 0 4px;font-size:24px;font-weight:700;letter-spacing:0.3px;}
.inglete-tool header p{margin:0;color:#B9C8D4;font-size:13.5px;max-width:640px;line-height:1.5;}
.inglete-tool .layout{display:grid;grid-template-columns:300px 1fr;gap:0;}
@media (max-width:860px){.inglete-tool .layout{grid-template-columns:1fr;}}
.inglete-tool .panel{padding:24px 26px;border-right:1px solid var(--blue-line);}
.inglete-tool .field{margin-bottom:20px;}
.inglete-tool .field label{display:block;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;color:#9FB4C4;margin-bottom:7px;}
.inglete-tool .field .row{display:flex;align-items:center;gap:10px;}
.inglete-tool .field input[type=number]{width:100%;background:var(--blue-panel);border:1px solid var(--blue-line);color:var(--white);font-family:"SF Mono","Consolas","Menlo",monospace;font-size:16px;padding:9px 10px;border-radius:3px;}
.inglete-tool .field input[type=number]:focus{outline:none;border-color:var(--amber);}
.inglete-tool .field .unit{color:#8298A8;font-size:12.5px;}
.inglete-tool .field input[type=range]{width:100%;accent-color:var(--amber);}
.inglete-tool .field .hint{font-size:11.5px;color:#7E93A3;margin-top:5px;line-height:1.4;}
.inglete-tool .result-mini{margin-top:24px;padding-top:16px;border-top:1px dashed var(--blue-line);}
.inglete-tool .result-mini .r{display:flex;justify-content:space-between;font-size:12.5px;color:#B9C8D4;padding:4px 0;}
.inglete-tool .result-mini .r b{color:var(--amber);font-family:"SF Mono","Consolas","Menlo",monospace;}
.inglete-tool .warn{margin-top:16px;background:rgba(217,107,91,0.12);border:1px solid var(--danger);color:#F3C7BF;font-size:12px;padding:10px 12px;border-radius:3px;line-height:1.5;display:none;}
.inglete-tool .warn.show{display:block;}
.inglete-tool .stage{padding:24px 28px 36px;}
.inglete-tool .stage-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap;gap:10px;}
.inglete-tool .stage-head h2{margin:0;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#9FB4C4;font-weight:600;}
.inglete-tool button{background:var(--amber);color:#3A2708;border:none;font-weight:700;font-size:12.5px;letter-spacing:0.5px;padding:10px 16px;border-radius:3px;cursor:pointer;font-family:inherit;}
.inglete-tool button:hover{background:#F0B25A;}
.inglete-tool button.ghost{background:transparent;border:1px solid var(--blue-line);color:var(--white);}
.inglete-tool button.ghost:hover{border-color:var(--amber);color:var(--amber);}
.inglete-tool .btn-row{display:flex;gap:10px;}
.inglete-tool .paper{background:var(--paper);border-radius:4px;padding:16px 16px 8px;color:var(--ink);}
.inglete-tool svg text{font-family:"SF Mono","Consolas","Menlo",monospace;}
.inglete-tool table.mtable{width:100%;border-collapse:collapse;margin-top:20px;font-family:"SF Mono","Consolas","Menlo",monospace;font-size:12.5px;}
.inglete-tool table.mtable th{text-align:left;color:#9FB4C4;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-size:10.5px;padding:8px 10px;border-bottom:1px solid var(--blue-line);}
.inglete-tool table.mtable td{padding:7px 10px;border-bottom:1px solid rgba(46,88,119,0.35);}
.inglete-tool table.mtable tr.toe td{color:var(--amber);}
.inglete-tool table.mtable tr.heel td{color:var(--cyan);}
.inglete-tool .legend{display:flex;gap:18px;font-size:11.5px;color:#B9C8D4;margin-top:10px;flex-wrap:wrap;}
.inglete-tool .legend span{display:inline-flex;align-items:center;gap:6px;}
.inglete-tool .swatch{width:14px;height:3px;display:inline-block;}
.inglete-tool footer{padding:18px 28px 30px;color:#6E8496;font-size:11.5px;line-height:1.6;border-top:1px solid var(--blue-line);}

#printArea{display:none;}
@media print{
  body *{visibility:hidden;}
  .inglete-tool header, .inglete-tool .layout, .inglete-tool footer{display:none !important;}
  #printArea, #printArea *{visibility:visible;}
  #printArea{display:block;position:absolute;top:0;left:0;background:#fff;}
  .strip{page-break-after:always;padding:10mm;}
  .strip:last-child{page-break-after:auto;}
  .strip svg{display:block;}
  .strip .stripLabel{font-family:"SF Mono","Consolas","Menlo",monospace;font-size:9pt;color:#000;margin-bottom:2mm;}
}
`;

function computeTool(D1s, D2s, angN) {
  const R = parseFloat(D1s) / 2;
  const r = parseFloat(D2s) / 2;
  const thetaDeg = angN;
  const theta = (thetaDeg * Math.PI) / 180;

  let warning = null;

  if (!(R > 0) || !(r > 0)) {
    return { warning: "Ingresá diámetros mayores a 0.", lastPoints: [], meta: null };
  }

  if (r > R * 1.0) {
    warning =
      "El tubo a cortar es igual o más grueso que el principal. En ese caso la unión no es una simple silla de montar (el tubo pasaría de lado a lado) — revisá los diámetros o usá un software de trazado más completo.";
  }

  const N = 360;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * 2 * Math.PI;
    const inner = R * R - r * r * Math.cos(phi) * Math.cos(phi);
    if (inner < 0) continue;
    const s = (Math.sqrt(inner) - r * Math.cos(theta) * Math.sin(phi)) / Math.sin(theta);
    pts.push({ deg: i, phi, s });
  }

  if (pts.length < N * 0.9) {
    warning =
      "Los diámetros/ángulo ingresados generan una curva sin solución real en parte del recorrido. Probá con un tubo principal de mayor diámetro o un ángulo más cercano a 90°.";
  }

  if (pts.length === 0) return { warning, lastPoints: [], meta: null };

  const sMin = Math.min(...pts.map((p) => p.s));
  const sMax = Math.max(...pts.map((p) => p.s));
  const circ = 2 * Math.PI * r;

  const lastPoints = pts.map((p) => ({
    deg: p.deg,
    x_mm: r * p.phi,
    h_mm: p.s - sMin,
  }));
  const meta = { circ, hMax: sMax - sMin, D1: R * 2, D2: r * 2, theta: thetaDeg };

  return { warning, lastPoints, meta };
}

function buildSvgMarkup(lastPoints, meta) {
  const W = 1000;
  const H = 320;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 36;
  const maxX = meta.circ;
  const maxY = meta.hMax || 1;
  const sx = (W - padL - padR) / maxX;
  const sy = (H - padT - padB) / (maxY * 1.15 || 1);

  let g = "";
  for (let gx = 0; gx <= maxX; gx += 10) {
    const x = padL + gx * sx;
    g += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="#2E5877" stroke-width="0.6" opacity="0.35"/>`;
  }
  for (let gy = 0; gy <= maxY * 1.15; gy += 10) {
    const y = H - padB - gy * sy;
    g += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#2E5877" stroke-width="0.6" opacity="0.25"/>`;
    g += `<text x="${padL - 8}" y="${y + 3}" font-size="9" fill="#8298A8" text-anchor="end">${gy}</text>`;
  }

  const y0 = H - padB;
  g += `<line x1="${padL}" y1="${y0}" x2="${W - padR}" y2="${y0}" stroke="#8A6323" stroke-width="1.4" stroke-dasharray="4 3"/>`;

  let d = "";
  lastPoints.forEach((p, i) => {
    const x = padL + p.x_mm * sx;
    const y = H - padB - p.h_mm * sy;
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  });
  g += `<path d="${d}" fill="none" stroke="#C0392B" stroke-width="2.4" stroke-linejoin="round"/>`;

  g += `<text x="${padL}" y="${H - 8}" font-size="9" fill="#8298A8">0 mm</text>`;
  g += `<text x="${W - padR}" y="${H - 8}" font-size="9" fill="#8298A8" text-anchor="end">${maxX.toFixed(0)} mm (circunferencia completa)</text>`;

  return g;
}

function buildPrintMarkup(lastPoints, meta) {
  const stripWidthMm = 180;
  const maxX = meta.circ;
  const nStrips = Math.max(1, Math.ceil(maxX / stripWidthMm));
  const maxY = meta.hMax;

  let html = "";
  for (let s = 0; s < nStrips; s++) {
    const x0 = s * stripWidthMm;
    const x1 = Math.min(maxX, x0 + stripWidthMm);
    const w = x1 - x0;
    const svgW = w + 20;
    const svgH = maxY + 40;

    html += `<div class="strip">`;
    html += `<div class="stripLabel">Tramo ${s + 1}/${nStrips} — tubo Ø${meta.D2.toFixed(0)}mm sobre Ø${meta.D1.toFixed(0)}mm, ${meta.theta}° — posición ${x0.toFixed(0)}–${x1.toFixed(0)} mm de la circunferencia. Imprimir al 100% sin ajustar escala.</div>`;
    html += `<svg width="${svgW}mm" height="${svgH}mm" viewBox="0 0 ${svgW} ${svgH}">`;

    let inner = "";
    if (s === 0) {
      inner += `<line x1="10" y1="12" x2="110" y2="12" stroke="#000" stroke-width="0.4"/>`;
      for (let t = 0; t <= 100; t += 10) {
        inner += `<line x1="${10 + t}" y1="9" x2="${10 + t}" y2="15" stroke="#000" stroke-width="0.3"/>`;
      }
      inner += `<text x="10" y="24" font-size="3.2">Regla de control: esta línea debe medir 100 mm exactos</text>`;
    }
    for (let gx = 0; gx <= w; gx += 10) {
      inner += `<line x1="${10 + gx}" y1="34" x2="${10 + gx}" y2="${34 + maxY}" stroke="#ccc" stroke-width="0.2"/>`;
    }
    inner += `<line x1="10" y1="${34 + maxY}" x2="${10 + w}" y2="${34 + maxY}" stroke="#000" stroke-width="0.3" stroke-dasharray="2 1.5"/>`;

    const segPts = lastPoints.filter((p) => p.x_mm >= x0 - 0.01 && p.x_mm <= x1 + 0.01);
    let d = "";
    segPts.forEach((p, i) => {
      const x = 10 + (p.x_mm - x0);
      const y = 34 + maxY - p.h_mm;
      d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
    });
    inner += `<path d="${d}" fill="none" stroke="#000" stroke-width="0.5"/>`;

    if (s > 0) inner += `<text x="10" y="${34 + maxY + 8}" font-size="3">← continúa del tramo anterior</text>`;
    if (s < nStrips - 1) inner += `<text x="${10 + w - 45}" y="${34 + maxY + 8}" font-size="3">continúa en el siguiente tramo →</text>`;

    html += inner + `</svg></div>`;
  }
  return html;
}

function toCsv(lastPoints) {
  let out = "angulo_grados,posicion_circunferencia_mm,altura_mm\n";
  lastPoints.forEach((p) => {
    out += `${p.deg},${p.x_mm.toFixed(2)},${p.h_mm.toFixed(2)}\n`;
  });
  return out;
}

export default function IngletePage() {
  const [D1, setD1] = useState("60");
  const [D2, setD2] = useState("40");
  const [esp, setEsp] = useState("2");
  const [ang, setAng] = useState(90);
  const [printMarkup, setPrintMarkup] = useState("");

  const { warning, lastPoints, meta } = useMemo(() => computeTool(D1, D2, ang), [D1, D2, ang]);
  const svgMarkup = useMemo(() => (meta ? buildSvgMarkup(lastPoints, meta) : ""), [lastPoints, meta]);
  const tableRows = useMemo(() => {
    if (!meta) return [];
    const step = 15;
    const hs = lastPoints.map((p) => p.h_mm);
    const hMinIdx = hs.indexOf(Math.min(...hs));
    const hMaxIdx = hs.indexOf(Math.max(...hs));
    const rows = [];
    for (let d = 0; d < 360; d += step) {
      const p = lastPoints.reduce((a, b) => (Math.abs(b.deg - d) < Math.abs(a.deg - d) ? b : a));
      rows.push({
        key: d,
        deg: d,
        x: p.x_mm,
        h: p.h_mm,
        toe: Math.abs(p.deg - lastPoints[hMinIdx].deg) < step / 2,
        heel: Math.abs(p.deg - lastPoints[hMaxIdx].deg) < step / 2,
      });
    }
    return rows;
  }, [lastPoints, meta]);

  function handleCsv() {
    if (!meta) return;
    const blob = new Blob([toCsv(lastPoints)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plantilla_tubo_${meta.D2.toFixed(0)}mm_en_${meta.D1.toFixed(0)}mm_${meta.theta}deg.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    if (!meta) return;
    setPrintMarkup(buildPrintMarkup(lastPoints, meta));
    setTimeout(() => window.print(), 50);
  }

  return (
    <div className="inglete-tool">
      <style>{CSS}</style>

      <header>
        <div className="eyebrow">Simonetti · Herramientas de taller</div>
        <h1>Calculadora de inglete para tubos</h1>
        <p>
          Calculá la línea de corte para que un tubo encastre contra otro en el ángulo que necesites. Da la plantilla
          desarrollada, una tabla de medidas para marcar directo sobre el caño, y una plantilla imprimible a escala real.
        </p>
      </header>

      <div className="layout">
        <div className="panel">
          <div className="field">
            <label htmlFor="D1">Diámetro tubo principal (contra el que apoya)</label>
            <div className="row">
              <input type="number" id="D1" value={D1} min="1" step="0.5" onChange={(e) => setD1(e.target.value)} />
              <span className="unit">mm</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="D2">Diámetro del tubo a cortar</label>
            <div className="row">
              <input type="number" id="D2" value={D2} min="1" step="0.5" onChange={(e) => setD2(e.target.value)} />
              <span className="unit">mm</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="esp">Espesor de pared (referencia)</label>
            <div className="row">
              <input type="number" id="esp" value={esp} min="0" step="0.1" onChange={(e) => setEsp(e.target.value)} />
              <span className="unit">mm</span>
            </div>
            <div className="hint">No se usa en el cálculo de la curva (ver nota al pie). Sirve para tener a mano el diámetro interior.</div>
          </div>

          <div className="field">
            <label htmlFor="ang">
              Ángulo de intersección — <span className="mono">{ang}°</span>
            </label>
            <input type="range" id="ang" value={ang} min="15" max="165" step="1" onChange={(e) => setAng(Number(e.target.value))} />
            <div className="hint">90° = unión en T (perpendicular). Otros valores = unión al bies / diagonal.</div>
          </div>

          <div className="result-mini">
            <div className="r">
              <span>Circunferencia a desarrollar</span>
              <b>{meta ? `${meta.circ.toFixed(1)} mm` : "–"}</b>
            </div>
            <div className="r">
              <span>Altura mínima (talón)</span>
              <b>{meta ? "0.0 mm" : "–"}</b>
            </div>
            <div className="r">
              <span>Altura máxima (punta)</span>
              <b>{meta ? `${meta.hMax.toFixed(1)} mm` : "–"}</b>
            </div>
            <div className="r">
              <span>Largo mínimo de tubo</span>
              <b>{meta ? `${(meta.hMax + 15).toFixed(0)} mm (+15 margen)` : "–"}</b>
            </div>
          </div>

          <div className={`warn${warning ? " show" : ""}`}>{warning}</div>
        </div>

        <div className="stage">
          <div className="stage-head">
            <h2>Plantilla desarrollada (vista previa, no a escala)</h2>
            <div className="btn-row">
              <button className="ghost" onClick={handleCsv}>
                Exportar tabla (.csv)
              </button>
              <button onClick={handlePrint}>Imprimir plantilla 1:1</button>
            </div>
          </div>

          <div className="paper">
            {meta ? (
              <svg viewBox="0 0 1000 320" width="100%" height="320" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
            ) : (
              <div className="mono" style={{ padding: "20px 8px", color: "#8A8578", fontSize: "12px" }}>
                Ingresá valores válidos para ver la plantilla.
              </div>
            )}
            <div className="legend">
              <span>
                <span className="swatch" style={{ background: "#C0392B" }}></span> Línea de corte
              </span>
              <span>
                <span className="swatch" style={{ background: "#8A6323", opacity: 0.6 }}></span> Línea base (talón, altura 0)
              </span>
              <span>
                <span className="swatch" style={{ background: "#2E5877" }}></span> Grilla cada 10 mm
              </span>
            </div>
          </div>

          <table className="mtable">
            <thead>
              <tr>
                <th>Ángulo</th>
                <th>Posición en circunferencia</th>
                <th>Altura desde la base</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.key} className={`${r.toe ? "toe" : ""}${r.heel ? " heel" : ""}`}>
                  <td>{r.deg}°</td>
                  <td>{r.x.toFixed(1)} mm</td>
                  <td>{r.h.toFixed(1)} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer>
        <b>Cómo marcarlo en el taller:</b> envolvé el tubo a cortar con una tira de papel o una cinta métrica flexible y
        marcá una línea perpendicular al eje (la "línea base"), dejando margen suficiente hacia la punta. Desde esa línea,
        marcá en cada posición de la tabla la altura indicada, y uní los puntos a mano alzada o con una plantilla flexible.
        Cortá y ajustá con amoladora antes de soldar.
        <br />
        <br />
        <b>Nota sobre precisión:</b> la curva se calcula para pared delgada (radio exterior, sin compensar espesor). Para
        tubos de pared gruesa el corte real puede variar un par de milímetros respecto a la línea teórica — hacé una prueba
        en un recorte antes de cortar la pieza final.
      </footer>

      <div id="printArea" dangerouslySetInnerHTML={{ __html: printMarkup }} />
    </div>
  );
}

// dxfIO.js
// Lector y escritor mínimo de archivos DXF, sin dependencias externas.
// Puerto fiel de dxf_io.py -- ver ese archivo para la explicación completa
// de por qué se necesita encadenar segmentos sueltos y evaluar splines
// "de verdad" (De Boor) en vez de usar solo los puntos de control.

function readGroupCodes(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs = [];
  let i = 0;
  while (i < lines.length - 1) {
    const codeLine = lines[i].trim();
    const valueLine = lines[i + 1];
    const code = parseInt(codeLine, 10);
    if (Number.isNaN(code)) {
      i += 2;
      continue;
    }
    pairs.push([code, valueLine]);
    i += 2;
  }
  return pairs;
}

function iterEntities(pairs) {
  let inEntities = false;
  let currentType = null;
  let current = [];
  const out = [];
  for (const [code, value] of pairs) {
    if (code === 2 && value === "ENTITIES") {
      inEntities = true;
      continue;
    }
    if (code === 0 && value === "ENDSEC") {
      if (inEntities && currentType !== null) {
        out.push([currentType, current]);
        currentType = null;
        current = [];
      }
      inEntities = false;
      continue;
    }
    if (!inEntities) continue;
    if (code === 0) {
      if (currentType !== null) out.push([currentType, current]);
      currentType = value;
      current = [];
    } else {
      current.push([code, value]);
    }
  }
  if (currentType !== null) out.push([currentType, current]);
  return out;
}

function bulgeToArcPoints(p1, p2, bulge, segments = 16) {
  if (Math.abs(bulge) < 1e-9) return [p2];
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const theta = 4 * Math.atan(bulge);
  const chord = Math.hypot(x2 - x1, y2 - y1);
  if (chord < 1e-9) return [p2];
  const radius = chord / (2 * Math.sin(theta / 2));
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const h = radius * Math.cos(theta / 2);
  const nx = -dy / chord;
  const ny = dx / chord;
  const sign = bulge > 0 ? 1 : -1;
  const cx = mx + sign * h * nx;
  const cy = my + sign * h * ny;
  const startAng = Math.atan2(y1 - cy, x1 - cx);
  const pts = [];
  const n = Math.max(2, Math.floor(Math.abs(theta) / (Math.PI / segments)) + 1);
  for (let k = 1; k <= n; k++) {
    const a = startAng + (theta * k) / n;
    pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return pts;
}

// --- Evaluación de curvas SPLINE (B-spline/NURBS) vía De Boor ---

function findSpan(u, degree, knots, nCtrl) {
  if (u >= knots[nCtrl]) return nCtrl - 1;
  if (u <= knots[degree]) return degree;
  let lo = degree;
  let hi = nCtrl;
  let mid = Math.floor((lo + hi) / 2);
  while (u < knots[mid] || u >= knots[mid + 1]) {
    if (u < knots[mid]) hi = mid;
    else lo = mid;
    mid = Math.floor((lo + hi) / 2);
  }
  return mid;
}

function bsplinePoint(u, degree, knots, ctrlPts, weights) {
  const nCtrl = ctrlPts.length;
  const span = findSpan(u, degree, knots, nCtrl);
  const d = [];
  for (let j = 0; j <= degree; j++) {
    const idx = span - degree + j;
    const w = weights[idx];
    d.push([ctrlPts[idx][0] * w, ctrlPts[idx][1] * w, w]);
  }
  for (let r = 1; r <= degree; r++) {
    for (let j = degree; j >= r; j--) {
      const i = span - degree + j;
      const denom = knots[i + degree - r + 1] - knots[i];
      const alpha = Math.abs(denom) < 1e-12 ? 0 : (u - knots[i]) / denom;
      d[j][0] = (1 - alpha) * d[j - 1][0] + alpha * d[j][0];
      d[j][1] = (1 - alpha) * d[j - 1][1] + alpha * d[j][1];
      d[j][2] = (1 - alpha) * d[j - 1][2] + alpha * d[j][2];
    }
  }
  let w = d[degree][2];
  if (Math.abs(w) < 1e-12) w = 1;
  return [d[degree][0] / w, d[degree][1] / w];
}

function sampleSpline(degree, knots, ctrlPts, weights, nSamples = 40) {
  const nCtrl = ctrlPts.length;
  const u0 = knots[degree];
  const u1 = knots[nCtrl];
  const pts = [];
  for (let k = 0; k <= nSamples; k++) {
    let u = u0 + (u1 - u0) * (k / nSamples);
    u = Math.min(Math.max(u, knots[0]), knots[knots.length - 1] - 1e-9);
    pts.push(bsplinePoint(u, degree, knots, ctrlPts, weights));
  }
  return pts;
}

function parseSpline(codes, nSamples = 40) {
  let degree = 3;
  const knots = [];
  const ctrlPts = [];
  let weights = [];
  const fitPts = [];
  let flags = 0;
  let curCtrl = null;
  let curFit = null;
  for (const [code, value] of codes) {
    if (code === 70) flags = parseInt(parseFloat(value), 10);
    else if (code === 71) degree = parseInt(parseFloat(value), 10);
    else if (code === 40) knots.push(parseFloat(value));
    else if (code === 41) weights.push(parseFloat(value));
    else if (code === 10) {
      if (curCtrl) ctrlPts.push([curCtrl.x, curCtrl.y]);
      curCtrl = { x: parseFloat(value) };
    } else if (code === 20 && curCtrl !== null) {
      curCtrl.y = parseFloat(value);
    } else if (code === 11) {
      if (curFit) fitPts.push([curFit.x, curFit.y]);
      curFit = { x: parseFloat(value) };
    } else if (code === 21 && curFit !== null) {
      curFit.y = parseFloat(value);
    }
  }
  if (curCtrl) ctrlPts.push([curCtrl.x, curCtrl.y]);
  if (curFit) fitPts.push([curFit.x, curFit.y]);

  const closed = Boolean(flags & 1);

  if (ctrlPts.length >= 2 && knots.length === ctrlPts.length + degree + 1) {
    if (weights.length === 0) weights = new Array(ctrlPts.length).fill(1.0);
    try {
      return [sampleSpline(degree, knots, ctrlPts, weights, nSamples), closed];
    } catch (e) {
      // sigue al respaldo
    }
  }
  if (fitPts.length) return [fitPts, closed];
  return [ctrlPts, closed];
}

// --- Extracción de segmentos "crudos" por entidad ---

function entityToSegment(etype, codes, arcSegments = 16, splineSamples = 40) {
  if (etype === "LINE") {
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    for (const [code, value] of codes) {
      if (code === 10) x1 = parseFloat(value);
      else if (code === 20) y1 = parseFloat(value);
      else if (code === 11) x2 = parseFloat(value);
      else if (code === 21) y2 = parseFloat(value);
    }
    return [[[x1, y1], [x2, y2]], false];
  }

  if (etype === "CIRCLE") {
    let cx = 0, cy = 0, r = 0;
    for (const [code, value] of codes) {
      if (code === 10) cx = parseFloat(value);
      else if (code === 20) cy = parseFloat(value);
      else if (code === 40) r = parseFloat(value);
    }
    const n = arcSegments * 4;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return [pts, true];
  }

  if (etype === "ARC") {
    let cx = 0, cy = 0, r = 0, a1 = 0, a2 = 360;
    for (const [code, value] of codes) {
      if (code === 10) cx = parseFloat(value);
      else if (code === 20) cy = parseFloat(value);
      else if (code === 40) r = parseFloat(value);
      else if (code === 50) a1 = parseFloat(value);
      else if (code === 51) a2 = parseFloat(value);
    }
    if (a2 < a1) a2 += 360;
    const n = Math.max(2, Math.floor((arcSegments * (a2 - a1)) / 90) + 1);
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const a = ((a1 + ((a2 - a1) * k) / n) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return [pts, false];
  }

  if (etype === "SPLINE") {
    const [pts, closed] = parseSpline(codes, splineSamples);
    return [pts, closed];
  }

  if (etype === "LWPOLYLINE") {
    const verts = [];
    let cur = null;
    let closed = false;
    for (const [code, value] of codes) {
      if (code === 70) closed = Boolean(parseInt(parseFloat(value), 10) & 1);
      else if (code === 10) {
        if (cur) verts.push(cur);
        cur = { x: parseFloat(value) };
      } else if (code === 20 && cur) {
        cur.y = parseFloat(value);
      } else if (code === 42 && cur) {
        cur.bulge = parseFloat(value);
      }
    }
    if (cur) verts.push(cur);
    const pts = [];
    for (let idx = 0; idx < verts.length; idx++) {
      const v = verts[idx];
      const p1 = [v.x, v.y];
      pts.push(p1);
      const bulge = v.bulge || 0;
      if (bulge) {
        let nxt = null;
        if (idx + 1 < verts.length) nxt = verts[idx + 1];
        else if (closed) nxt = verts[0];
        if (nxt) {
          const p2 = [nxt.x, nxt.y];
          const arcPts = bulgeToArcPoints(p1, p2, bulge, arcSegments);
          pts.push(...arcPts.slice(0, -1));
        }
      }
    }
    return [pts, closed];
  }

  return null;
}

function entitiesWithVertexGroups(entities) {
  const out = [];
  let i = 0;
  while (i < entities.length) {
    const [etype, codes] = entities[i];
    if (etype === "POLYLINE") {
      let closed = false;
      for (const [code, value] of codes) {
        if (code === 70) closed = Boolean(parseInt(parseFloat(value), 10) & 1);
      }
      const pts = [];
      let j = i + 1;
      while (j < entities.length && entities[j][0] === "VERTEX") {
        let vx = null, vy = null;
        for (const [code, value] of entities[j][1]) {
          if (code === 10) vx = parseFloat(value);
          else if (code === 20) vy = parseFloat(value);
        }
        if (vx !== null && vy !== null) pts.push([vx, vy]);
        j++;
      }
      if (j < entities.length && entities[j][0] === "SEQEND") j++;
      out.push(["_POLYLINE_RESOLVED", [pts, closed]]);
      i = j;
      continue;
    }
    out.push([etype, codes]);
    i++;
  }
  return out;
}

function pointsEqual(a, b, tol) {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;
}

function chainOpenSegments(segments, tol) {
  const remaining = segments.map((s) => s.slice());
  const closedLoops = [];
  const leftoverOpen = [];

  while (remaining.length) {
    let chain = remaining.shift();
    if (chain.length < 2) continue;
    let progressed = true;
    while (progressed) {
      progressed = false;
      if (pointsEqual(chain[0], chain[chain.length - 1], tol) && chain.length > 2) break;
      const start = chain[0];
      const end = chain[chain.length - 1];
      for (let idx = 0; idx < remaining.length; idx++) {
        const other = remaining[idx];
        if (pointsEqual(end, other[0], tol)) {
          chain = chain.concat(other.slice(1));
        } else if (pointsEqual(end, other[other.length - 1], tol)) {
          chain = chain.concat(other.slice().reverse().slice(1));
        } else if (pointsEqual(start, other[other.length - 1], tol)) {
          chain = other.slice(0, -1).concat(chain);
        } else if (pointsEqual(start, other[0], tol)) {
          chain = other.slice().reverse().slice(0, -1).concat(chain);
        } else {
          continue;
        }
        remaining.splice(idx, 1);
        progressed = true;
        break;
      }
    }
    if (pointsEqual(chain[0], chain[chain.length - 1], tol) && chain.length > 2) {
      closedLoops.push(chain.slice(0, -1));
    } else {
      leftoverOpen.push(chain);
    }
  }
  return [closedLoops, leftoverOpen];
}

function polygonAreaLocal(points) {
  let a = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// Carga un DXF (contenido de texto ya leído) y devuelve
// { outer, holes, warning }. Lanza Error si no hay contornos cerrados.
function loadDxfPiece(text, opts = {}) {
  const {
    arcSegments = 16,
    splineSamples = 40,
    joinTolerance = 0.01,
  } = opts;

  const pairs = readGroupCodes(text);
  let entities = iterEntities(pairs);
  entities = entitiesWithVertexGroups(entities);

  const closedLoops = [];
  const openSegments = [];

  for (const [etype, payload] of entities) {
    if (etype === "_POLYLINE_RESOLVED") {
      const [pts, closed] = payload;
      if (pts.length < 2) continue;
      if (closed || pointsEqual(pts[0], pts[pts.length - 1], joinTolerance)) {
        closedLoops.push(
          pointsEqual(pts[0], pts[pts.length - 1], joinTolerance) ? pts.slice(0, -1) : pts
        );
      } else {
        openSegments.push(pts);
      }
      continue;
    }

    const result = entityToSegment(etype, payload, arcSegments, splineSamples);
    if (result === null) continue;
    const [pts, closed] = result;
    if (pts.length < 2) continue;
    if (closed || pointsEqual(pts[0], pts[pts.length - 1], joinTolerance)) {
      closedLoops.push(
        pointsEqual(pts[0], pts[pts.length - 1], joinTolerance) ? pts.slice(0, -1) : pts
      );
    } else {
      openSegments.push(pts);
    }
  }

  const [joinedLoops, leftover] = chainOpenSegments(openSegments, joinTolerance);
  closedLoops.push(...joinedLoops);

  let loops = closedLoops.filter((l) => l.length >= 3);
  loops = loops.filter((l) => polygonAreaLocal(l) > 1.0);

  if (loops.length === 0) {
    throw new Error(
      "El DXF no contiene ningún contorno cerrado reconocible. Si el dibujo tiene tramos sueltos que no llegan a cerrar el contorno, revisá que no haya micro-huecos entre segmentos."
    );
  }

  loops.sort((a, b) => polygonAreaLocal(b) - polygonAreaLocal(a));
  const outer = loops[0];
  const holes = loops.slice(1);
  let warning = null;
  if (leftover.length) {
    warning = `${leftover.length} tramo(s) sueltos no forman un contorno cerrado y se ignoraron (suelen ser líneas de doblez/plegado o alivios de esquina; no afectan el corte).`;
  }
  return { outer, holes, warning };
}

// --- Escritura de DXF de salida ---

const HEADER = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
0
70
0
62
7
6
CONTINUOUS
0
LAYER
2
PIEZAS
70
0
62
1
6
CONTINUOUS
0
LAYER
2
CHAPA
70
0
62
5
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

const FOOTER = `0
ENDSEC
0
EOF
`;

function polylineEntity(points, layer = "PIEZAS", closed = true) {
  const lines = ["0", "LWPOLYLINE", "8", layer, "90", String(points.length), "70", closed ? "1" : "0"];
  for (const [x, y] of points) {
    lines.push("10", x.toFixed(6), "20", y.toFixed(6));
  }
  return lines.join("\n") + "\n";
}

// placedPieces: [{ points: [[x,y],...], holes: [[[x,y],...], ...] }, ...]
// ya en coordenadas absolutas dentro de la chapa. Devuelve el texto DXF.
function saveDxfLayout(placedPieces, sheetW, sheetH, drawSheetOutline = true) {
  const body = [];
  if (drawSheetOutline) {
    const sheetPts = [
      [0, 0],
      [sheetW, 0],
      [sheetW, sheetH],
      [0, sheetH],
    ];
    body.push(polylineEntity(sheetPts, "CHAPA", true));
  }
  for (const piece of placedPieces) {
    body.push(polylineEntity(piece.points, "PIEZAS", true));
    for (const hole of piece.holes || []) {
      body.push(polylineEntity(hole, "PIEZAS", true));
    }
  }
  return HEADER + body.join("") + FOOTER;
}

export { loadDxfPiece, saveDxfLayout };

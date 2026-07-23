// geometry.js
// Utilidades geométricas para el nesting: transformaciones de polígonos y
// rasterización a grilla (bitmap) para detección de colisiones.
//
// La rasterización usa el algoritmo clásico de "scanline fill" (regla
// even-odd) fila por fila de la grilla -- para polígonos simples (no
// auto-intersectantes, que es siempre el caso de un contorno de pieza o
// de un agujero) da exactamente el mismo resultado que el test punto-en-
// poligono que usaba matplotlib.path.Path en la version Python, pero es
// más rápido (evalúa por intersección de borde, no punto por punto).

import { squaredDistanceTransform } from "./fft.js";

function polygonArea(points) {
  let a = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function polygonBounds(points) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, y] of points) {
    if (x < minx) minx = x;
    if (y < miny) miny = y;
    if (x > maxx) maxx = x;
    if (y > maxy) maxy = y;
  }
  return [minx, miny, maxx, maxy];
}

function rotatePoints(points, angleDeg, origin = [0, 0]) {
  const a = (angleDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const [ox, oy] = origin;
  return points.map(([x, y]) => {
    const dx = x - ox;
    const dy = y - oy;
    return [dx * ca - dy * sa + ox, dx * sa + dy * ca + oy];
  });
}

function translatePoints(points, dx, dy) {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

function normalizeToOrigin(points) {
  const [minx, miny] = polygonBounds(points);
  return [translatePoints(points, -minx, -miny), [minx, miny]];
}

// Rellena `mask` (Uint8Array h*w) marcando `value` (0 o 1) las celdas cuyo
// centro cae dentro de `poly` (regla even-odd), vía scanline por fila.
function fillPolygonMask(mask, w, h, minx, miny, cellMm, marginCells, poly, value) {
  if (poly.length < 3) return;
  const n = poly.length;
  for (let row = 0; row < h; row++) {
    const cy = (row - marginCells + 0.5) * cellMm + miny;
    // Intersecciones de la linea horizontal y=cy con cada borde del poligono.
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % n];
      // Convencion half-open [min,max) para no contar dos veces un vertice
      // exactamente sobre la linea de escaneo.
      const ylo = Math.min(y1, y2);
      const yhi = Math.max(y1, y2);
      if (cy >= ylo && cy < yhi) {
        const t = (cy - y1) / (y2 - y1);
        xs.push(x1 + t * (x2 - x1));
      }
    }
    if (xs.length === 0) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xStart = xs[k];
      const xEnd = xs[k + 1];
      // Convertimos el rango real [xStart,xEnd) a indices de columna cuyo
      // centro cae adentro.
      let colStart = Math.ceil((xStart - minx) / cellMm - 0.5 + marginCells);
      let colEnd = Math.floor((xEnd - minx) / cellMm - 0.5 + marginCells);
      if (colStart < 0) colStart = 0;
      if (colEnd > w - 1) colEnd = w - 1;
      const rowOffset = row * w;
      for (let col = colStart; col <= colEnd; col++) {
        mask[rowOffset + col] = value;
      }
    }
  }
}

// Devuelve { mask: Uint8Array(h*w), w, h, origin: [ox, oy] }.
// `origin` es la esquina inferior-izquierda real (mm) de la celda (0,0),
// igual semantica que la version Python.
function rasterizePolygon(points, holes, cellMm, marginCells = 1) {
  const [minx, miny, maxx, maxy] = polygonBounds(points);
  let w = Math.ceil((maxx - minx) / cellMm) + 2 * marginCells;
  let h = Math.ceil((maxy - miny) / cellMm) + 2 * marginCells;
  w = Math.max(w, 1);
  h = Math.max(h, 1);

  const mask = new Uint8Array(w * h);
  fillPolygonMask(mask, w, h, minx, miny, cellMm, marginCells, points, 1);
  for (const hole of holes || []) {
    fillPolygonMask(mask, w, h, minx, miny, cellMm, marginCells, hole, 0);
  }

  return { mask, w, h, origin: [minx - marginCells * cellMm, miny - marginCells * cellMm] };
}

// Dilata `mask` (Uint8Array w*h) `cells` celdas mediante transformada de
// distancia euclidiana (equivalente exacto a la convolucion con un disco
// circular que usaba la version Python via FFT, pero en O(w*h)).
function dilateMask(mask, w, h, cells) {
  if (cells <= 0) return mask;
  const d2 = squaredDistanceTransform(mask, h, w);
  const out = new Uint8Array(w * h);
  const r2 = cells * cells;
  for (let i = 0; i < w * h; i++) out[i] = d2[i] <= r2 ? 1 : 0;
  return out;
}

export {
  polygonArea,
  polygonBounds,
  rotatePoints,
  translatePoints,
  normalizeToOrigin,
  rasterizePolygon,
  dilateMask,
};

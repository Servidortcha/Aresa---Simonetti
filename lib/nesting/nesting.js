// nesting.js
// Algoritmo de nesting: ubica todas las piezas (con sus cantidades y
// rotación libre) dentro de una o más chapas, minimizando desperdicio.
// Puerto fiel de nesting.py -- ver ese archivo para la explicación
// detallada de la estrategia (rasterización + correlación FFT +
// heurística de mayor-área-primero + bottom-left).

import * as geo from "./geometry.js";
import { buildIntegralImage, maskTrueOffsets, findBestPlacementIntegral } from "./collision.js";

function buildPieceVariants(points, holes, anglesDeg, cellMm, spacingMm) {
  const dilationCells = spacingMm > 0 ? Math.max(1, Math.ceil(spacingMm / 2 / cellMm)) : 0;
  const variants = {};
  for (const ang of anglesDeg) {
    const rotated = geo.rotatePoints(points, ang);
    const rotatedHoles = (holes || []).map((h) => geo.rotatePoints(h, ang));
    const [normPts, offset] = geo.normalizeToOrigin(rotated);
    const normHoles = rotatedHoles.map((h) => geo.translatePoints(h, -offset[0], -offset[1]));
    const { mask, w, h, origin } = geo.rasterizePolygon(normPts, normHoles, cellMm, dilationCells + 1);
    const maskD = geo.dilateMask(mask, w, h, dilationCells);
    variants[ang] = {
      mask: maskD,
      shapeH: h,
      shapeW: w,
      maskOrigin: origin,
      normPts,
      normHoles,
      offsets: maskTrueOffsets(maskD, h, w),
    };
  }
  return variants;
}



function autoParams(parts) {
  const totalQty = parts.reduce((s, p) => s + Number(p.qty), 0) || 1;
  let minDim = null;
  for (const p of parts) {
    const [minx, miny, maxx, maxy] = geo.polygonBounds(p.points);
    const d = Math.min(maxx - minx, maxy - miny);
    if (d > 0 && (minDim === null || d < minDim)) minDim = d;
  }
  if (!minDim) minDim = 50.0;
  const cellMm = Math.max(1.0, Math.min(5.0, minDim / 12.0));

  let rotationStepDeg;
  if (totalQty > 80) rotationStepDeg = 30.0;
  else if (totalQty > 30) rotationStepDeg = 20.0;
  else if (totalQty > 10) rotationStepDeg = 12.0;
  else rotationStepDeg = 6.0;

  return [Math.round(cellMm * 100) / 100, rotationStepDeg];
}

function fitsWithinWidth(points, holes, sheetWMm, spacingMm, cellMm, angles) {
  const variants = buildPieceVariants(points, holes, angles, cellMm, spacingMm);
  const wCellsLimit = Math.max(1, Math.floor(sheetWMm / cellMm));
  return Object.values(variants).some((v) => v.shapeW <= wCellsLimit);
}

function rangeAngles(step) {
  const out = [];
  for (let a = 0; a < 360; a += step) out.push(a);
  return out;
}

// Coloca todas las piezas en UNA chapa de tamaño fijo (sheetWMm x sheetHMm).
// parts: [{ part_id, name, points, holes, qty }, ...]
function nest(parts, sheetWMm, sheetHMm, opts = {}) {
  const {
    spacingMm = 3.0,
    cellMm = 4.0,
    allowRotation = true,
    rotationStepDeg = 15.0,
    onProgress = null,
    variantsCache = {},
  } = opts;

  const angles = allowRotation ? rangeAngles(rotationStepDeg) : [0.0];

  const sheetWCells = Math.max(1, Math.floor(sheetWMm / cellMm));
  const sheetHCells = Math.max(1, Math.floor(sheetHMm / cellMm));

  const instances = [];
  for (const p of parts) {
    const area = geo.polygonArea(p.points);
    for (let i = 0; i < Number(p.qty); i++) {
      instances.push({ part_id: p.part_id, name: p.name, points: p.points, holes: p.holes || [], area });
    }
  }
  instances.sort((a, b) => b.area - a.area);

  function getVariants(inst) {
    const key = inst.part_id;
    if (!variantsCache[key]) {
      variantsCache[key] = buildPieceVariants(inst.points, inst.holes, angles, cellMm, spacingMm);
    }
    return variantsCache[key];
  }

  const sheets = []; // cada uno: { occ: Uint8Array, w, h, maxY, maxX, pieces: [] }
  const unplaced = [];

  const total = instances.length;
  instances.forEach((inst, idx) => {
    const variants = getVariants(inst);

    const fitsAnySheetSize = Object.values(variants).some(
      (v) => v.shapeH <= sheetHCells && v.shapeW <= sheetWCells
    );
    if (!fitsAnySheetSize) {
      unplaced.push(inst);
      if (onProgress) onProgress(idx + 1, total, false);
      return;
    }

    let placed = false;
    // Tamaño máximo de mascara entre todos los angulos candidatos (ya no
    // hace falta para el padding de FFT, pero lo dejamos calculado por si
    // se necesita para diagnósticos).

    for (const sheet of sheets) {
      let best = null; // { score, ang, row, col }
      const curMaxY = sheet.maxY || 0;
      const curMaxX = sheet.maxX || 0;

      if (sheet.pieces.length === 0) {
        // Chapa recien creada y vacia: cualquier angulo entra en (0,0) sin
        // necesidad de buscar nada. La mejor eleccion es, entre los
        // angulos candidatos, el que menos area (shapeH*shapeW) ocupe.
        for (const [angStr, v] of Object.entries(variants)) {
          if (v.shapeH > sheet.h || v.shapeW > sheet.w) continue;
          const score = [v.shapeH * v.shapeW, v.shapeH, v.shapeW, 0, 0];
          if (best === null || compareScores(score, best.score) < 0) {
            best = { score, ang: Number(angStr), row: 0, col: 0 };
          }
        }
      } else {
        const sheetIntegral = buildIntegralImage(sheet.occ, sheet.h, sheet.w);
        for (const [angStr, v] of Object.entries(variants)) {
          if (v.shapeH > sheet.h || v.shapeW > sheet.w) continue;
          const pos = findBestPlacementIntegral(sheet.occ, sheet.h, sheet.w, sheetIntegral, v.mask, v.shapeH, v.shapeW, v.offsets, curMaxY, curMaxX);
          if (pos === null) continue;
          const [row, col] = pos;
          const newMaxY = Math.max(curMaxY, row + v.shapeH);
          const newMaxX = Math.max(curMaxX, col + v.shapeW);
          const score = [newMaxY * newMaxX, newMaxY, newMaxX, row, col];
          if (best === null || compareScores(score, best.score) < 0) {
            best = { score, ang: Number(angStr), row, col };
          }
        }
      }

      if (best !== null) {
        const v = variants[best.ang];
        placePieceOnSheet(sheet, v, best, inst, cellMm);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const occ = new Uint8Array(sheetWCells * sheetHCells);
      const sheet = { occ, w: sheetWCells, h: sheetHCells, maxY: 0, maxX: 0, pieces: [] };
      // Chapa nueva: mismo atajo que arriba (sin busqueda, cualquier
      // angulo entra en (0,0); elegimos el que menos area ocupe).
      let best = null;
      for (const [angStr, v] of Object.entries(variants)) {
        if (v.shapeH > sheet.h || v.shapeW > sheet.w) continue;
        const score = [v.shapeH * v.shapeW, v.shapeH, v.shapeW, 0, 0];
        if (best === null || compareScores(score, best.score) < 0) {
          best = { score, ang: Number(angStr), row: 0, col: 0 };
        }
      }
      if (best !== null) {
        const v = variants[best.ang];
        placePieceOnSheet(sheet, v, best, inst, cellMm);
        sheets.push(sheet);
      } else {
        unplaced.push(inst);
      }
    }

    if (onProgress) onProgress(idx + 1, total, placed);
  });

  const resultSheets = sheets.map((sheet) => {
    const usedArea = sheet.pieces.reduce((s, p) => s + p.area, 0);
    const sheetArea = sheetWMm * sheetHMm;
    return {
      width: sheetWMm,
      height: sheetHMm,
      pieces: sheet.pieces,
      used_area_mm2: usedArea,
      utilization_pct: sheetArea ? Math.round((10000 * usedArea) / sheetArea) / 100 : 0,
    };
  });

  return [resultSheets, unplaced];
}

function compareScores(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function placePieceOnSheet(sheet, v, best, inst, cellMm) {
  const { row, col, ang } = best;
  const mh = v.shapeH;
  const mw = v.shapeW;
  for (let y = 0; y < mh; y++) {
    const srcOff = y * mw;
    const dstOff = (row + y) * sheet.w + col;
    for (let x = 0; x < mw; x++) {
      if (v.mask[srcOff + x]) sheet.occ[dstOff + x] = 1;
    }
  }
  sheet.maxY = Math.max(sheet.maxY || 0, row + mh);
  sheet.maxX = Math.max(sheet.maxX || 0, col + mw);
  const dx = col * cellMm - v.maskOrigin[0];
  const dy = row * cellMm - v.maskOrigin[1];
  const absPts = geo.translatePoints(v.normPts, dx, dy);
  const absHoles = v.normHoles.map((h) => geo.translatePoints(h, dx, dy));
  sheet.pieces.push({ part_id: inst.part_id, name: inst.name, angle: ang, points: absPts, holes: absHoles, area: inst.area });
}

// Acomoda todas las piezas en una tira de ancho fijo (sheetWMm), calculando
// automáticamente el largo mínimo necesario. Si `maxLengthMm` está
// definido y no alcanza, deja el resto para la próxima chapa (se maneja
// desde afuera, llamando de nuevo con las piezas restantes).
function nestStrip(parts, sheetWMm, opts = {}) {
  let { spacingMm = 3.0, cellMm = null, allowRotation = true, rotationStepDeg = null, maxLengthMm = null, onProgress = null } = opts;

  if (cellMm === null || rotationStepDeg === null) {
    const [autoCell, autoRot] = autoParams(parts);
    if (cellMm === null) {
      // Si el espaciado pedido es mas chico que la resolucion pensada
      // solo en base al tamano de pieza, la afinamos: sino, el margen de
      // seguridad (que se redondea siempre hacia arriba, ver
      // buildPieceVariants) terminaria exigiendo mucho mas espaciado del
      // pedido, solo por el tamano de celda.
      cellMm = spacingMm > 0 ? Math.min(autoCell, Math.max(0.5, spacingMm / 2)) : autoCell;
    }
    if (rotationStepDeg === null) rotationStepDeg = autoRot;
  }

  const angles = allowRotation ? rangeAngles(rotationStepDeg) : [0.0];

  const placeableParts = [];
  const impossible = [];
  for (const p of parts) {
    if (fitsWithinWidth(p.points, p.holes || [], sheetWMm, spacingMm, cellMm, angles)) {
      placeableParts.push(p);
    } else {
      impossible.push({ name: p.name });
    }
  }

  if (placeableParts.length === 0) return [null, impossible];

  const totalArea = placeableParts.reduce((s, p) => s + geo.polygonArea(p.points) * Number(p.qty), 0);
  let guessH = Math.max(sheetWMm * 0.25, sheetWMm ? (totalArea * 1.6) / sheetWMm : 500.0, 80.0);
  if (maxLengthMm) guessH = Math.min(guessH, maxLengthMm);

  const MAX_GRID_CELLS = 1_500_000;
  const estimatedHForSizing = maxLengthMm || guessH * 3.0;
  const minCellForMemory = Math.sqrt((sheetWMm * estimatedHForSizing) / MAX_GRID_CELLS);
  if (minCellForMemory > cellMm) cellMm = Math.round(minCellForMemory * 100) / 100;

  let sheets = [];
  let unplaced = [];
  let attempts = 0;
  const variantsCache = {};
  while (true) {
    attempts++;
    [sheets, unplaced] = nest(placeableParts, sheetWMm, guessH, {
      spacingMm,
      cellMm,
      allowRotation,
      rotationStepDeg,
      onProgress,
      variantsCache,
    });
    const ok = sheets.length <= 1 && unplaced.length === 0;
    const reachedCap = maxLengthMm && guessH >= maxLengthMm;
    if (ok || attempts >= 6 || reachedCap) break;
    guessH = maxLengthMm ? Math.min(guessH * 1.7, maxLengthMm) : guessH * 1.7;
  }

  for (const u of unplaced) impossible.push({ name: u.name });

  if (!sheets.length || !sheets[0].pieces.length) return [null, impossible];

  const sheet = sheets[0];
  const allPts = [];
  for (const p of sheet.pieces) {
    for (const pt of p.points) allPts.push(pt);
    for (const h of p.holes) for (const pt of h) allPts.push(pt);
  }
  const maxY = Math.max(...allPts.map((pt) => pt[1]));
  const usedLength = Math.min(guessH, maxY + spacingMm / 2.0);

  const usedArea = sheet.pieces.reduce((s, p) => s + p.area, 0);
  const sheetArea = sheetWMm * usedLength;
  const result = {
    width: sheetWMm,
    height: Math.round(usedLength * 10) / 10,
    pieces: sheet.pieces,
    used_area_mm2: usedArea,
    utilization_pct: sheetArea ? Math.round((10000 * usedArea) / sheetArea) / 100 : 0,
  };
  return [result, impossible];
}

// Orquesta el proceso completo: reparte todas las piezas en tantas chapas
// como haga falta (si hay un largo maximo configurado), acumulando piezas
// no ubicables. Puerto de la logica que en la version Python vivia en
// app.py (la ruta /optimize).
function optimizeAll(parts, sheetWMm, opts = {}) {
  const sheets = [];
  let remaining = parts.map((p) => ({ ...p }));
  const impossibleNames = new Set();

  for (let i = 0; i < 20; i++) {
    // tope de seguridad de chapas por corrida
    if (!remaining.length) break;
    const [sheet, impossible] = nestStrip(remaining, sheetWMm, opts);
    for (const imp of impossible) impossibleNames.add(imp.name);
    if (sheet === null || !sheet.pieces.length) break;
    sheets.push(sheet);

    const placedCount = {};
    for (const p of sheet.pieces) {
      placedCount[p.part_id] = (placedCount[p.part_id] || 0) + 1;
    }
    const nextRemaining = [];
    for (const p of remaining) {
      const used = placedCount[p.part_id] || 0;
      const leftQty = p.qty - used;
      if (leftQty > 0 && !impossibleNames.has(p.name)) {
        nextRemaining.push({ ...p, qty: leftQty });
      }
    }
    remaining = nextRemaining;
    if (!opts.maxLengthMm) break; // sin tope de largo, una sola chapa alcanza siempre
  }

  const unplaced = [...impossibleNames].map((name) => ({ name }));
  for (const p of remaining) {
    if (!impossibleNames.has(p.name)) unplaced.push({ name: p.name });
  }

  return { sheets, unplaced };
}

export { nest, nestStrip, optimizeAll, autoParams, buildPieceVariants };

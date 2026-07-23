// collision.js
// Búsqueda de la posición "bottom-left" sin colisión para una máscara
// dentro de la chapa, usando una tabla de sumas acumuladas (integral
// image / summed-area table) en vez de FFT.
//
// Idea: la mayor parte de una chapa suele estar vacía (sobre todo al
// principio). Con una tabla de sumas acumuladas podemos saber en O(1)
// si una región rectangular de la chapa está completamente vacía -- si
// lo está, la pieza entra ahí seguro (ya que la máscara siempre cabe
// dentro de su propio rectángulo delimitador), sin tener que revisar
// celda por celda. Solo cuando esa región tiene algo ocupado hace falta
// el chequeo exacto (celda por celda de la máscara, con salida
// anticipada apenas se encuentra una colisión real).
//
// Esto termina siendo bastante más rápido que la convolución FFT para
// este caso tipico (pieza chica moviendose sobre una chapa grande),
// porque evita el costo fijo de transformar toda la chapa a cada rato.

function buildIntegralImage(mask, h, w) {
  // integral[y][x] = suma de mask[0..y-1][0..x-1] (tamaño (h+1) x (w+1),
  // con la fila/columna 0 en cero, convencion estandar).
  const integral = new Uint32Array((h + 1) * (w + 1));
  const iw = w + 1;
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += mask[y * w + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
    }
  }
  return integral;
}

function regionSum(integral, iw, y0, x0, y1, x1) {
  // Suma de mask[y0..y1) x [x0..x1), via inclusion-exclusion.
  return (
    integral[y1 * iw + x1] -
    integral[y0 * iw + x1] -
    integral[y1 * iw + x0] +
    integral[y0 * iw + x0]
  );
}

// Precalcula, para una mascara binaria (Uint8Array maskH*maskW), la lista
// de offsets (dy,dx) donde vale 1 -- para el chequeo exacto con salida
// anticipada.
function maskTrueOffsets(mask, maskH, maskW) {
  const offsets = [];
  for (let y = 0; y < maskH; y++) {
    const rowOff = y * maskW;
    for (let x = 0; x < maskW; x++) {
      if (mask[rowOff + x]) offsets.push(y * maskW + x); // offset lineal relativo, reconstruimos dy,dx al usarlo
    }
  }
  return offsets;
}

// Busca la primera posicion (bottom-left: fila ascendente, luego columna
// ascendente) donde `mask` (maskH x maskW) no colisiona con `sheetOcc`
// (sheetH x sheetW). `sheetIntegral` es la tabla de sumas acumuladas de
// sheetOcc (ver buildIntegralImage), y `maskOffsets`/`maskTrue` son el
// resultado de maskTrueOffsets(mask,...) reutilizable entre llamadas con
// la misma mascara.
function findPlacementIntegral(sheetOcc, sheetH, sheetW, sheetIntegral, mask, maskH, maskW, maskOffsets) {
  if (maskH > sheetH || maskW > sheetW) return null;
  const outH = sheetH - maskH + 1;
  const outW = sheetW - maskW + 1;
  const iw = sheetW + 1;

  for (let row = 0; row < outH; row++) {
    for (let col = 0; col < outW; col++) {
      const sum = regionSum(sheetIntegral, iw, row, col, row + maskH, col + maskW);
      if (sum === 0) {
        // La region entera esta vacia: la mascara, este como este,
        // entra seguro (esta contenida en su propio rectangulo).
        return [row, col];
      }
      // Chequeo exacto, con salida anticipada apenas hay colision.
      let collision = false;
      for (let k = 0; k < maskOffsets.length; k++) {
        const relOffset = maskOffsets[k];
        const dy = Math.floor(relOffset / maskW);
        const dx = relOffset % maskW;
        if (sheetOcc[(row + dy) * sheetW + (col + dx)]) {
          collision = true;
          break;
        }
      }
      if (!collision) return [row, col];
    }
  }
  return null;
}

export { buildIntegralImage, regionSum, maskTrueOffsets, findPlacementIntegral };

// fft.js
// FFT radix-2 (Cooley-Tukey) para números reales, más utilidades de
// convolución 2D (usadas para "engordar" la máscara de una pieza según
// el espaciado, y para encontrar posiciones sin colisión mediante
// correlación) y transformada de distancia (usada para la dilatación).
//
// Puerto fiel del uso que el proyecto Python original le daba a
// scipy.signal.fftconvolve, pero implementado desde cero en JS puro
// (sin dependencias), para poder correr 100% en el navegador.

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// FFT 1D in-place, iterativa (Cooley-Tukey), sobre arreglos de Float64
// re/im de largo potencia de 2. invert=true hace la inversa (sin dividir
// por n; el llamador debe dividir si quiere la IFFT normalizada).
function fft1d(re, im, invert) {
  const n = re.length;
  // bit-reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((invert ? 1 : -1) * 2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

function fft2dRaw(re, im, fh, fw, invert) {
  for (let y = 0; y < fh; y++) {
    const rowRe = re.subarray(y * fw, y * fw + fw);
    const rowIm = im.subarray(y * fw, y * fw + fw);
    fft1d(rowRe, rowIm, invert);
  }
  const colRe = new Float64Array(fh);
  const colIm = new Float64Array(fh);
  for (let x = 0; x < fw; x++) {
    for (let y = 0; y < fh; y++) {
      colRe[y] = re[y * fw + x];
      colIm[y] = im[y * fw + x];
    }
    fft1d(colRe, colIm, invert);
    for (let y = 0; y < fh; y++) {
      re[y * fw + x] = colRe[y];
      im[y * fw + x] = colIm[y];
    }
  }
}

// FFT 2D directa de `mat` (h x w, real) con padding de ceros hasta (fh,fw).
function fft2dForwardPadded(mat, h, w, fh, fw) {
  const re = new Float64Array(fh * fw);
  const im = new Float64Array(fh * fw);
  for (let y = 0; y < h; y++) {
    const rowOffset = y * fw;
    const srcOffset = y * w;
    for (let x = 0; x < w; x++) re[rowOffset + x] = mat[srcOffset + x];
  }
  fft2dRaw(re, im, fh, fw, false);
  return { re, im };
}

// Multiplica dos espectros (punto a punto, complejo) y aplica la FFT
// inversa, devolviendo solo la parte real (fh x fw).
function multiplyAndInverse(Are, Aim, Bre, Bim, fh, fw) {
  const n = fh * fw;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    outRe[i] = Are[i] * Bre[i] - Aim[i] * Bim[i];
    outIm[i] = Are[i] * Bim[i] + Aim[i] * Bre[i];
  }
  fft2dRaw(outRe, outIm, fh, fw, true);
  const norm = fh * fw;
  const real = new Float64Array(n);
  for (let i = 0; i < n; i++) real[i] = outRe[i] / norm;
  return real;
}

function extractValidRegion(full, fullW, h1, w1, h2, w2) {
  const outH = h1 - h2 + 1;
  const outW = w1 - w2 + 1;
  const data = new Float64Array(outH * outW);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      data[y * outW + x] = full[(y + h2 - 1) * fullW + (x + w2 - 1)];
    }
  }
  return { data, outH, outW };
}

function flipKernel(kernel, h2, w2) {
  const flipped = new Float64Array(h2 * w2);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      flipped[y * w2 + x] = kernel[(h2 - 1 - y) * w2 + (w2 - 1 - x)];
    }
  }
  return flipped;
}

// Prepara el FFT de la chapa UNA sola vez para un tamaño de padding dado
// (fh,fw) -- pensado para reutilizarse contra varios kernels (uno por
// cada ángulo candidato de una misma pieza), ya que la chapa no cambia
// entre esos intentos.
function prepareSheetFFT(sheet, h1, w1, fh, fw) {
  return fft2dForwardPadded(sheet, h1, w1, fh, fw);
}

// Correlación 'valid' reutilizando un FFT de chapa ya preparado (ver
// prepareSheetFFT). `fh`/`fw` deben ser >= nextPow2(h1+h2-1) y
// nextPow2(w1+w2-1) para el kernel mas grande que se vaya a usar.
function correlateValidCached(sheetFFT, h1, w1, kernel, h2, w2, fh, fw) {
  if (h2 > h1 || w2 > w1) return { data: new Float64Array(0), outH: 0, outW: 0 };
  const flipped = flipKernel(kernel, h2, w2);
  const B = fft2dForwardPadded(flipped, h2, w2, fh, fw);
  const full = multiplyAndInverse(sheetFFT.re, sheetFFT.im, B.re, B.im, fh, fw);
  return extractValidRegion(full, fw, h1, w1, h2, w2);
}

// Correlación 2D modo 'valid' entre `sheet` (h1 x w1) y `kernel` (h2 x w2),
// equivalente a scipy.signal.fftconvolve(sheet, kernel[::-1,::-1], mode="valid").
// Devuelve una matriz de (h1-h2+1) x (w1-w2+1); result[row*outW+col] es la
// suma de sheet[row..row+h2, col..col+w2] * kernel (sin voltear), es decir
// "cuánto se superpone" la máscara del kernel puesta en esa posición.
function correlateValid(sheet, h1, w1, kernel, h2, w2) {
  if (h2 > h1 || w2 > w1) return { data: new Float64Array(0), outH: 0, outW: 0 };
  const outH = h1 - h2 + 1;
  const outW = w1 - w2 + 1;
  const fh = nextPow2(h1 + h2 - 1);
  const fw = nextPow2(w1 + w2 - 1);
  const sheetFFT = prepareSheetFFT(sheet, h1, w1, fh, fw);
  return correlateValidCached(sheetFFT, h1, w1, kernel, h2, w2, fh, fw);
}

// --- Transformada de distancia euclidiana al cuadrado, 1D (Felzenszwalb &
// Huttenlocher), usada para hacer dilatación circular exacta en O(n) por
// fila/columna en vez de convolucionar con un kernel circular.
function distTransform1D(f, n, INF) {
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s;
    while (true) {
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      if (s <= z[k]) {
        k--;
      } else {
        break;
      }
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
  return d;
}

// Distancia euclidiana (al cuadrado) de cada celda de `mask` (Uint8Array,
// h x w, 1 = "objeto") a la celda "1" más cercana. Estándar en 2 pasadas
// (columnas, luego filas) de la transformada 1D de Felzenszwalb-Huttenlocher.
function squaredDistanceTransform(mask, h, w) {
  const INF = 1e20;
  const g = new Float64Array(h * w);
  // pasada por columnas
  const colBuf = new Float64Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) colBuf[y] = mask[y * w + x] ? 0 : INF;
    const d = distTransform1D(colBuf, h, INF);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  // pasada por filas
  const out = new Float64Array(h * w);
  const rowBuf = new Float64Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) rowBuf[x] = g[y * w + x];
    const d = distTransform1D(rowBuf, w, INF);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

export {
  fft1d,
  correlateValid,
  squaredDistanceTransform,
  nextPow2,
  prepareSheetFFT,
  correlateValidCached,
};

/**
 * 点拡がり関数 (PSF) と見え方シミュレーション。
 *
 * 理論:
 *   瞳孔関数  P(x,y) = A(x,y) · exp( i · 2π/λ · W(x,y) )
 *     A: 開口（瞳内 1, 瞳外 0）, W: 波面収差 [m]
 *   PSF = |FT{P}|²
 *   網膜像 = 物体（点光源 / ランドルト環） ⊛ PSF（畳み込み）
 *
 * 屈折異常は Power Vector (M, J0, J45) を経由して Zernike 係数 (c20, c22, c2-2) に
 * 変換し、波面 W に与える。デフォーカス D[D] と瞳半径 r[m] の関係は
 * c20 = -M·r²/(4√3) （Thibos et al. 2002 標準形）。
 *
 * 実装メモ:
 *   - 自前 radix-2 FFT を使用（外部依存なし）。
 *   - グリッドサイズ N×N（N=128 が既定）。瞳の有効径は N/2 サンプルにとり、
 *     残りはゼロパディング（FFT 後の角度解像度を細かくする目的）。
 *   - 教育目的のため絶対値ではなく「向きと桁」の正しさを優先。
 */

/** Zernike 係数（OSA/ANSI 順、主要項のみ）[m]。 */
export interface ZernikeCoeffs {
  defocus?: number; // Z(2,0)
  astig0?: number; // Z(2,2) 0/90°乱視
  astig45?: number; // Z(2,-2) 斜乱視
  comaX?: number; // Z(3,1)
  comaY?: number; // Z(3,-1)
  spherical?: number; // Z(4,0) 球面収差
}

export interface PupilConfig {
  /** 瞳半径 [m]。 */
  pupilRadius: number;
  /** 波長 [m]（既定 555nm: 明所視ピーク）。 */
  wavelength?: number;
  /** 瞳面サンプリング数（N×N）。 */
  gridSize?: number;
  /**
   * 出力 PSF の視野角 [arcmin]。指定すると瞳の有効サンプル数 Nactive を
   * これに合わせて調整し、瞳径によらず PSF の視野が一定になる。
   * 未指定時は Nactive = N/2 固定。
   */
  fovArcmin?: number;
}

/**
 * PupilConfig から瞳の有効サンプル数 Nactive を決定する内部ヘルパ。
 * fovArcmin 指定時: Nactive = FOV·2r/λ（整数に丸め、N 以下にクランプ）。
 */
function decideNactive(cfg: PupilConfig, N: number): number {
  if (cfg.fovArcmin == null) return Math.floor(N / 2);
  const lambda = cfg.wavelength ?? 555e-9;
  const fovRad = (cfg.fovArcmin / 60) * (Math.PI / 180);
  const Nactive = Math.round((fovRad * 2 * cfg.pupilRadius) / lambda);
  return Math.max(8, Math.min(N, Nactive));
}

/** 1次元の複素数配列（実部・虚部）。 */
export interface Complex2D {
  size: number;
  re: Float64Array;
  im: Float64Array;
}

/**
 * デフォーカス量 [D] を Zernike デフォーカス係数 [m] に変換する。
 * Thibos 標準形: c20 = -M·r²/(4√3)。
 */
export function defocusDioptersToZernike(diopters: number, pupilRadius: number): number {
  return -(diopters * pupilRadius * pupilRadius) / (4 * Math.sqrt(3));
}

/**
 * 屈折値（球面・円柱・軸）+ 瞳半径から OSA Zernike (c20, c22, c2-2) を返す。
 * Power Vector: M = S + C/2, J0 = -C/2·cos2θ, J45 = -C/2·sin2θ
 *   c20  = -M ·r²/(4√3)
 *   c22  = -J0·r²/(2√6)
 *   c2-2 = -J45·r²/(2√6)
 */
export function refractionToZernike(
  sphereD: number,
  cylinderD: number,
  axisDeg: number,
  pupilRadius: number,
): { c20: number; c22: number; c2m2: number } {
  const M = sphereD + cylinderD / 2;
  const theta = (axisDeg * Math.PI) / 180;
  const J0 = (-cylinderD / 2) * Math.cos(2 * theta);
  const J45 = (-cylinderD / 2) * Math.sin(2 * theta);
  const r2 = pupilRadius * pupilRadius;
  return {
    c20: -(M * r2) / (4 * Math.sqrt(3)),
    c22: -(J0 * r2) / (2 * Math.sqrt(6)),
    c2m2: -(J45 * r2) / (2 * Math.sqrt(6)),
  };
}

/**
 * 1D Cooley-Tukey radix-2 in-place FFT。
 * N は 2 のべき乗。inverse=true で逆変換（1/N 正規化込み）。
 */
function fft1d(re: Float64Array, im: Float64Array, inverse = false): void {
  const N = re.length;
  // ビット反転並べ替え
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const theta = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(theta);
    const wIm = Math.sin(theta);
    for (let i = 0; i < N; i += len) {
      let pRe = 1;
      let pIm = 0;
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + half] * pRe - im[i + k + half] * pIm;
        const bIm = re[i + k + half] * pIm + im[i + k + half] * pRe;
        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + half] = aRe - bRe;
        im[i + k + half] = aIm - bIm;
        const tRe = pRe * wRe - pIm * wIm;
        const tIm = pRe * wIm + pIm * wRe;
        pRe = tRe;
        pIm = tIm;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < N; i++) {
      re[i] /= N;
      im[i] /= N;
    }
  }
}

/**
 * 2D FFT（N×N、N は 2 のべき乗）。in-place。行 → 列の順に 1D FFT を適用。
 */
export function fft2d(re: Float64Array, im: Float64Array, N: number, inverse = false): void {
  const row = new Float64Array(N);
  const rowIm = new Float64Array(N);
  // 行
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      row[x] = re[y * N + x];
      rowIm[x] = im[y * N + x];
    }
    fft1d(row, rowIm, inverse);
    for (let x = 0; x < N; x++) {
      re[y * N + x] = row[x];
      im[y * N + x] = rowIm[x];
    }
  }
  // 列
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      row[y] = re[y * N + x];
      rowIm[y] = im[y * N + x];
    }
    fft1d(row, rowIm, inverse);
    for (let y = 0; y < N; y++) {
      re[y * N + x] = row[y];
      im[y * N + x] = rowIm[y];
    }
  }
}

/**
 * 複素瞳孔関数を生成する。
 * 瞳の有効径は floor(N/2) サンプル、残りはゼロパディング（PSF の角度解像度向上）。
 */
export function buildPupilFunction(z: ZernikeCoeffs, cfg: PupilConfig): Complex2D {
  const N = cfg.gridSize ?? 128;
  const lambda = cfg.wavelength ?? 555e-9;
  const r = cfg.pupilRadius;
  const re = new Float64Array(N * N);
  const im = new Float64Array(N * N);
  const c20 = z.defocus ?? 0;
  const c22 = z.astig0 ?? 0;
  const c2m2 = z.astig45 ?? 0;
  const Nactive = decideNactive(cfg, N);
  const dxPupil = (2 * r) / Nactive;
  const k = (2 * Math.PI) / lambda;
  const cx = N / 2;
  const cy = N / 2;
  for (let y = 0; y < N; y++) {
    const yp = (y - cy) * dxPupil;
    for (let x = 0; x < N; x++) {
      const xp = (x - cx) * dxPupil;
      const rho2 = (xp * xp + yp * yp) / (r * r);
      if (rho2 > 1) continue;
      const phi = Math.atan2(yp, xp);
      // OSA Zernike 正規化
      const Z20 = Math.sqrt(3) * (2 * rho2 - 1);
      const Z22 = Math.sqrt(6) * rho2 * Math.cos(2 * phi);
      const Z2m2 = Math.sqrt(6) * rho2 * Math.sin(2 * phi);
      const W = c20 * Z20 + c22 * Z22 + c2m2 * Z2m2;
      const phase = k * W;
      const idx = y * N + x;
      re[idx] = Math.cos(phase);
      im[idx] = Math.sin(phase);
    }
  }
  return { size: N, re, im };
}

/** PSF と角度サンプリング情報をまとめた結果。 */
export interface PsfResult {
  /** PSF（強度、正規化済み、中心化済み）N×N の行優先配列。 */
  psf: Float64Array;
  /** 1 辺のサンプル数。 */
  size: number;
  /** PSF サンプルの角度間隔 [rad]。 */
  angularStep: number;
}

/**
 * 瞳孔関数から PSF を計算する。
 *   PSF = |FT{P}|²
 *   返り値は中心化（DC を中央に）し、合計=1 に正規化。
 *   angularStep = λ / (N · dx_pupil)
 */
export function computePSF(pupil: Complex2D, cfg: PupilConfig): PsfResult {
  const N = pupil.size;
  const lambda = cfg.wavelength ?? 555e-9;
  const r = cfg.pupilRadius;
  const Nactive = decideNactive(cfg, N);
  const dxPupil = (2 * r) / Nactive;
  // in-place FFT のため複製
  const re = new Float64Array(pupil.re);
  const im = new Float64Array(pupil.im);
  fft2d(re, im, N);
  // 強度
  const raw = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) {
    raw[i] = re[i] * re[i] + im[i] * im[i];
  }
  // FFT shift（DC を中央へ）
  const shifted = new Float64Array(N * N);
  const half = N >> 1;
  for (let y = 0; y < N; y++) {
    const ys = (y + half) % N;
    for (let x = 0; x < N; x++) {
      const xs = (x + half) % N;
      shifted[ys * N + xs] = raw[y * N + x];
    }
  }
  // 正規化（合計=1）
  let sum = 0;
  for (let i = 0; i < N * N; i++) sum += shifted[i];
  if (sum > 0) {
    for (let i = 0; i < N * N; i++) shifted[i] /= sum;
  }
  const angularStep = lambda / (N * dxPupil);
  return { psf: shifted, size: N, angularStep };
}

/** 屈折値・瞳径・グリッド設定から PSF を一気に計算する高レベル API。 */
export function computePsfFromRefraction(input: {
  sphereD: number;
  cylinderD: number;
  axisDeg: number;
  pupilRadius: number;
  wavelength?: number;
  gridSize?: number;
  /** 指定すると PSF 視野が瞳径によらず一定（[arcmin]）。 */
  fovArcmin?: number;
}): PsfResult {
  const cfg: PupilConfig = {
    pupilRadius: input.pupilRadius,
    wavelength: input.wavelength,
    gridSize: input.gridSize,
    fovArcmin: input.fovArcmin,
  };
  const { c20, c22, c2m2 } = refractionToZernike(
    input.sphereD,
    input.cylinderD,
    input.axisDeg,
    input.pupilRadius,
  );
  const pupil = buildPupilFunction({ defocus: c20, astig0: c22, astig45: c2m2 }, cfg);
  return computePSF(pupil, cfg);
}

/**
 * 任意距離・任意視力のランドルト環の角度サイズを返す。
 * 20/20（小数視力 1.0）でギャップ 1 分角、環全体 5 分角。
 */
export function landoltAngularSizeArcmin(decimalAcuity: number): {
  gapArcmin: number;
  ringArcmin: number;
} {
  const gap = 1 / decimalAcuity; // 視力の逆数 [分角]
  return { gapArcmin: gap, ringArcmin: gap * 5 };
}

/** 物理サイズ [m] と視距離 [m] から視角 [rad] を返す。 */
export function angularSize(physicalSizeM: number, distanceM: number): number {
  return 2 * Math.atan(physicalSizeM / 2 / distanceM);
}

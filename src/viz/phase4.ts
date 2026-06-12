/**
 * Phase 5 マウント: PSF と視標の畳み込みで「網膜にどう映るか」を描画する。
 * （ファイル名は履歴上 phase4.ts のまま。UI 上の番号は main.ts で定義。）
 *
 * 計算:
 *   1) 屈折値 → Zernike → 瞳孔関数 → FFT → PSF
 *   2) 視標を PSF と同じ角度サンプリングで描画
 *   3) FFT 畳み込みで網膜像を取得
 *   4) Canvas2D にグレースケール表示
 *
 * 表示仕様:
 *   - 視野は 30 分角固定（瞳径に依らず PSF 計算側で吸収）
 *   - N=128 のグリッドで計算、ビューポートに最大正方形で表示
 *   - 計算は requestAnimationFrame でデバウンス
 */

import { computePsfFromRefraction, fft2d } from '../optics/psf';
import { renderTarget } from './targetBitmap';
import { mountControlsPhase4, type SimState4 } from './controlsPhase4';
import type { PhaseHandle } from './phase1';

const GRID_N = 256;
const FOV_ARCMIN = 60;

export function mountPhase4(viewport: HTMLElement, panel: HTMLElement): PhaseHandle {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_N;
  canvas.height = GRID_N;
  canvas.style.background = '#000';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.position = 'absolute';
  canvas.style.top = '50%';
  canvas.style.left = '50%';
  canvas.style.transform = 'translate(-50%, -50%)';
  viewport.appendChild(canvas);

  const updateDisplaySize = () => {
    const W = viewport.clientWidth;
    const H = viewport.clientHeight;
    const size = Math.max(160, Math.min(W, H) - 24);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  };
  updateDisplaySize();
  window.addEventListener('resize', updateDisplaySize);

  const controls = mountControlsPhase4(panel);

  let raf: number | null = null;

  const applyState = (s: SimState4) => {
    if (raf != null) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = null;
      const r = s.pupilDiameterMM / 1000 / 2;
      // 無調節モデル: 視距離 d の有限物体は +1/d D の調節要求を生む。
      // 眼が調節しなければ、その分だけ実効デフォーカス（網膜面でのピントずれ）が増える。
      // 例) -3D の近視眼が 0.33m を見れば effectiveSphereD ≈ 0 で鮮明、無限遠ではぼやける。
      const accomDemandD = 1 / s.distanceM;
      const effectiveSphereD = s.sphereD + accomDemandD;
      const psfRes = computePsfFromRefraction({
        sphereD: effectiveSphereD,
        cylinderD: s.cylinderD,
        axisDeg: s.axisDeg,
        pupilRadius: r,
        gridSize: GRID_N,
        fovArcmin: FOV_ARCMIN,
      });

      const sizeArcmin = 5 / s.acuityDecimal;
      const target = renderTarget({
        type: s.target,
        sizeArcmin: sizeArcmin,
        orientationDeg: s.orientationDeg,
        text: s.text,
        gridSize: GRID_N,
        pixelAngularStep: psfRes.angularStep,
      });

      const image =
        s.target === 'point' ? psfRes.psf : convolve(target, psfRes.psf, GRID_N);
      drawToCanvas(canvas, image, GRID_N);

      const M_equiv = s.sphereD + s.cylinderD / 2;
      const M_effective = effectiveSphereD + s.cylinderD / 2;
      const physSizeMM =
        (sizeArcmin / 60) * (Math.PI / 180) * s.distanceM * 1000;
      const acuityNote =
        s.target === 'point'
          ? '<span class="hint">（点光源モードでは視標サイズは表示に使われません）</span>'
          : '';
      controls.setReadout(`
        <div class="kv"><span>等価球面（屈折異常）</span><b class="${
          M_equiv < 0 ? 'neg' : M_equiv > 0 ? 'pos' : ''
        }">${fmtD(M_equiv)} D</b></div>
        <div class="kv"><span>調節要求（1/視距離）</span><b class="${
          accomDemandD > 0 ? 'pos' : ''
        }">${fmtD(accomDemandD)} D</b></div>
        <div class="kv"><span>実効デフォーカス（網膜面）</span><b class="${
          M_effective < 0 ? 'neg' : M_effective > 0 ? 'pos' : ''
        }">${fmtD(M_effective)} D</b></div>
        <div class="kv"><span>視標角度サイズ</span><b>${sizeArcmin.toFixed(
          2,
        )} 分角</b>${acuityNote}</div>
        <div class="kv"><span>視距離 ${s.distanceM.toFixed(
          1,
        )} m での物理サイズ</span><b>${physSizeMM.toFixed(2)} mm</b></div>
        <div class="kv"><span>表示視野</span><b>${FOV_ARCMIN} 分角（固定）</b></div>
      `);
    });
  };

  controls.onChange(applyState);
  applyState(controls.state);

  return {
    dispose() {
      if (raf != null) cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateDisplaySize);
      viewport.innerHTML = '';
      panel.innerHTML = '';
    },
  };
}

function fmtD(d: number): string {
  return (d >= 0 ? '+' : '') + d.toFixed(2);
}

/**
 * 視標と PSF の循環畳み込み（FFT 経由）。
 * psfShifted は DC が中央。畳み込みカーネルとして使うため [0,0] に unshift する。
 */
function convolve(target: Float64Array, psfShifted: Float64Array, N: number): Float64Array {
  const psfK = new Float64Array(N * N);
  const half = N >> 1;
  for (let y = 0; y < N; y++) {
    const ys = (y + half) % N;
    for (let x = 0; x < N; x++) {
      const xs = (x + half) % N;
      psfK[y * N + x] = psfShifted[ys * N + xs];
    }
  }
  const tRe = new Float64Array(target);
  const tIm = new Float64Array(N * N);
  const pRe = psfK;
  const pIm = new Float64Array(N * N);
  fft2d(tRe, tIm, N);
  fft2d(pRe, pIm, N);
  for (let i = 0; i < N * N; i++) {
    const ar = tRe[i];
    const ai = tIm[i];
    const br = pRe[i];
    const bi = pIm[i];
    tRe[i] = ar * br - ai * bi;
    tIm[i] = ar * bi + ai * br;
  }
  fft2d(tRe, tIm, N, true);
  return tRe;
}

/** 強度配列をグレースケールで Canvas に描画（min→0, max→255）。 */
function drawToCanvas(canvas: HTMLCanvasElement, data: Float64Array, N: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(N, N);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < N * N; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  for (let i = 0; i < N * N; i++) {
    const v = range > 1e-12 ? (data[i] - min) / range : 0;
    const px = Math.max(0, Math.min(255, Math.round(255 * v)));
    const k = i * 4;
    img.data[k] = px;
    img.data[k + 1] = px;
    img.data[k + 2] = px;
    img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

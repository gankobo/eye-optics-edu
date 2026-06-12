/**
 * Phase 2 / 3 用の小型 PSF オーバーレイ。
 *
 * 3D シーンの右上に「設定パラメータでの点光源の見え方」を
 * 96 CSS px の正方形 Canvas で表示する。
 *
 * 入力は (sphereD, cylinderD [マイナス円柱], axisDeg, pupilDiameterMM) を受け取り、
 * computePsfFromRefraction で PSF を計算してグレースケール表示する。
 * リサイズや再計算は requestAnimationFrame でデバウンスする。
 *
 * 注意: 親要素 (.viewport) には `canvas { width:100% !important }` が効くため、
 * オーバーレイ canvas のサイズは inline + !important で強制指定している。
 */

import { computePsfFromRefraction } from '../optics/psf';

const GRID_N = 128; // FFT 用に 2 の冪
const DISPLAY_PX = 96;
const FOV_ARCMIN = 60;

export interface PsfOverlayState {
  sphereD: number;
  cylinderD: number;
  axisDeg: number;
  pupilDiameterMM: number;
}

export interface PsfOverlayAPI {
  update(state: PsfOverlayState): void;
  dispose(): void;
}

export function createPsfOverlay(parent: HTMLElement): PsfOverlayAPI {
  const box = document.createElement('div');
  box.style.position = 'absolute';
  box.style.top = '8px';
  box.style.right = '8px';
  box.style.background = 'rgba(255,255,255,0.88)';
  box.style.padding = '4px 6px 5px';
  box.style.borderRadius = '6px';
  box.style.fontSize = '10px';
  box.style.color = '#444';
  box.style.pointerEvents = 'none';
  box.style.userSelect = 'none';
  box.style.lineHeight = '1.2';
  box.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
  box.style.zIndex = '2';

  const label = document.createElement('div');
  label.textContent = '点光源の見え方';
  label.style.textAlign = 'center';
  label.style.marginBottom = '3px';
  label.style.whiteSpace = 'nowrap';
  box.appendChild(label);

  const canvas = document.createElement('canvas');
  canvas.width = GRID_N;
  canvas.height = GRID_N;
  canvas.style.display = 'block';
  canvas.style.background = '#000';
  canvas.style.imageRendering = 'pixelated';
  // .viewport canvas の !important ルールを上書きするため setProperty で important 指定
  canvas.style.setProperty('width', DISPLAY_PX + 'px', 'important');
  canvas.style.setProperty('height', DISPLAY_PX + 'px', 'important');
  box.appendChild(canvas);

  parent.appendChild(box);

  let raf: number | null = null;

  const compute = (s: PsfOverlayState) => {
    const r = s.pupilDiameterMM / 1000 / 2;
    const psfRes = computePsfFromRefraction({
      sphereD: s.sphereD,
      cylinderD: s.cylinderD,
      axisDeg: s.axisDeg,
      pupilRadius: r,
      gridSize: GRID_N,
      fovArcmin: FOV_ARCMIN,
    });
    drawPsf(canvas, psfRes.psf, GRID_N);
  };

  return {
    update(state) {
      if (raf != null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = null;
        compute(state);
      });
    },
    dispose() {
      if (raf != null) cancelAnimationFrame(raf);
      box.remove();
    },
  };
}

/** PSF 強度を最大値で正規化してグレースケール描画。 */
function drawPsf(canvas: HTMLCanvasElement, data: Float64Array, N: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(N, N);
  let max = 0;
  for (let i = 0; i < N * N; i++) {
    const v = data[i];
    if (v > max) max = v;
  }
  if (max <= 0) max = 1;
  const inv = 255 / max;
  for (let i = 0; i < N * N; i++) {
    const px = Math.max(0, Math.min(255, Math.round(data[i] * inv)));
    const k = i * 4;
    img.data[k] = px;
    img.data[k + 1] = px;
    img.data[k + 2] = px;
    img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

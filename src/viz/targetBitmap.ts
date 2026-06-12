/**
 * 視標ビットマップ生成（角度空間でラスタライズ）。
 *
 * 出力は強度 Float64Array（行優先 N×N）：
 *   - landolt / echart / text: 背景=1（白）、視標=0（黒）
 *   - point: 背景=0（黒）、中央 1 ピクセル=1（点光源）
 *
 * 角度サンプル間隔 pixelAngularStep は PSF と合わせる前提。これにより
 * 同一グリッド上で畳み込み可能（リサンプル不要）。
 */

export type TargetType = 'landolt' | 'point' | 'echart' | 'text';

export interface TargetParams {
  type: TargetType;
  /** 視標全体の角度サイズ [arcmin]。 */
  sizeArcmin: number;
  /**
   * ランドルト環 / E チャートの「開いている方向」[°]
   *   0=右, 90=上, 180=左, 270=下
   */
  orientationDeg?: number;
  /** type='text' のときの文字列。 */
  text?: string;
  /** 出力グリッド辺長（ピクセル）。 */
  gridSize: number;
  /** 1 ピクセルあたりの角度 [rad]。 */
  pixelAngularStep: number;
}

export function renderTarget(p: TargetParams): Float64Array {
  const N = p.gridSize;
  const center = N / 2;
  const sizeRad = (p.sizeArcmin / 60) * (Math.PI / 180);
  const sizePx = sizeRad / p.pixelAngularStep;

  if (p.type === 'point') {
    const data = new Float64Array(N * N);
    const i = Math.floor(center);
    data[i * N + i] = 1;
    return data;
  }

  const data = new Float64Array(N * N).fill(1);

  if (p.type === 'landolt') {
    drawLandolt(data, N, center, sizePx, p.orientationDeg ?? 0);
  } else if (p.type === 'echart') {
    drawEChart(data, N, center, sizePx, p.orientationDeg ?? 0);
  } else if (p.type === 'text') {
    drawText(data, N, sizePx, p.text ?? 'あ');
  }
  return data;
}

/**
 * ランドルト環: 視力 1.0 規格に従い、外径=視標サイズ、環幅=1/5、ギャップ幅=1/5。
 * gapDirDeg は「ギャップが向いている方向」（0=右,90=上,180=左,270=下）。
 */
function drawLandolt(
  data: Float64Array,
  N: number,
  center: number,
  sizePx: number,
  gapDirDeg: number,
): void {
  const outer = sizePx / 2;
  const inner = outer * 0.6; // 環幅 = 1/5 視標サイズ
  const gapHalfAng = Math.atan2(sizePx / 10, outer);
  const gapDirRad = (gapDirDeg * Math.PI) / 180;
  for (let y = 0; y < N; y++) {
    const dy = y - center;
    for (let x = 0; x < N; x++) {
      const dx = x - center;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < inner || r > outer) continue;
      // 画面 y は下向きが正なので -dy で数学的な角度系に揃える
      const ang = Math.atan2(-dy, dx);
      let diff = ang - gapDirRad;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) < gapHalfAng) continue;
      data[y * N + x] = 0;
    }
  }
}

/**
 * E チャート: 5×5 グリッドで E 字を描く。dirDeg は「開いている方向」（=ギャップ方向）。
 *   dirDeg=0   : 開きが右 → 標準の E
 *   dirDeg=180 : 開きが左 → ⊐
 */
function drawEChart(
  data: Float64Array,
  N: number,
  center: number,
  sizePx: number,
  dirDeg: number,
): void {
  const half = sizePx / 2;
  const bar = sizePx / 5;
  const rad = (dirDeg * Math.PI) / 180;
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);
  for (let y = 0; y < N; y++) {
    const dy = y - center;
    for (let x = 0; x < N; x++) {
      const dx = x - center;
      // 画面座標 (dx, -dy) を、開き方向 dirDeg の逆回転で E のローカル座標へ
      const ux = dx;
      const uy = -dy;
      const ex = cs * ux + sn * uy;
      const ey = -sn * ux + cs * uy;
      if (Math.abs(ex) > half || Math.abs(ey) > half) continue;
      // 左側の縦棒
      if (ex < -half + bar) {
        data[y * N + x] = 0;
        continue;
      }
      // 上・中・下の横棒
      const topMid = half - bar / 2;
      const botMid = -half + bar / 2;
      if (
        Math.abs(ey - topMid) < bar / 2 ||
        Math.abs(ey) < bar / 2 ||
        Math.abs(ey - botMid) < bar / 2
      ) {
        data[y * N + x] = 0;
      }
    }
  }
}

/**
 * 文字列を Canvas にラスタライズして輝度配列に取り込む。
 * かな・数字・英字に対応（フォントは日本語フォールバック）。
 */
function drawText(data: Float64Array, N: number, sizePx: number, text: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, N, N);
  ctx.fillStyle = '#000';
  const fontSize = Math.max(4, Math.round(sizePx));
  ctx.font = `${fontSize}px "Hiragino Sans", "Noto Sans JP", "Meiryo", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, N / 2, N / 2);
  const img = ctx.getImageData(0, 0, N, N);
  for (let i = 0; i < N * N; i++) {
    const k = i * 4;
    const luma = (img.data[k] + img.data[k + 1] + img.data[k + 2]) / (3 * 255);
    data[i] = luma;
  }
}

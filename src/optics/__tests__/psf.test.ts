/**
 * psf.ts の数値検証 — 遠視 / 近視 / 乱視における波面・PSF が
 * 理論的に正しい振る舞いをするかを確認する。
 *
 * 検証の柱:
 *  1) Power Vector → Zernike (refractionToZernike) の数式が
 *     Thibos 標準形と一致する（純球面・純乱視・斜乱視）。
 *  2) 任意の屈折状態に対し、子午線ごとの実効デフォーカスが
 *     P(θ) = S + C·sin²(θ - θ_axis) と一致する（波面から逆算）。
 *  3) PSF（|FT{P}|²）の物理性: 全エネルギー保存・回折限界・
 *     デフォーカスでの拡がり・乱視軸による異方性回転。
 *
 * 物理的論拠:
 *  W(ρ,φ) = c20·√3(2ρ²-1) + c22·√6·ρ²cos(2φ) + c2-2·√6·ρ²sin(2φ)
 *  子午線 θ に沿った変位 r = ρR から計算した有効デフォーカス D_θ は
 *  W_θ(r) ≈ −D_θ·r²/2 + const と表せ、D_θ = S + C·sin²(θ−θ_axis)。
 */

import { describe, expect, it } from 'vitest';
import {
  refractionToZernike,
  defocusDioptersToZernike,
  buildPupilFunction,
  computePsfFromRefraction,
} from '../psf';

const R = 0.002; // 瞳半径 2mm
const SQRT3 = Math.sqrt(3);
const SQRT6 = Math.sqrt(6);

describe('refractionToZernike — Power Vector → Zernike', () => {
  it('純球面 (S=+2, C=0): c20 = -M·R²/(4√3), c22=c2-2=0', () => {
    const { c20, c22, c2m2 } = refractionToZernike(2, 0, 0, R);
    const expectedC20 = -(2 * R * R) / (4 * SQRT3);
    expect(c20).toBeCloseTo(expectedC20, 15);
    expect(c22).toBeCloseTo(0, 15);
    expect(c2m2).toBeCloseTo(0, 15);
  });

  it('近視 (S=-3): c20 が球面の符号反転で得られる', () => {
    const myo = refractionToZernike(-3, 0, 0, R).c20;
    const hyp = refractionToZernike(+3, 0, 0, R).c20;
    expect(myo).toBeCloseTo(-hyp, 15);
  });

  it('defocusDioptersToZernike と refractionToZernike(S,0,0) が一致', () => {
    for (const D of [-5, -1.5, 0, 0.75, 4]) {
      const a = defocusDioptersToZernike(D, R);
      const b = refractionToZernike(D, 0, 0, R).c20;
      expect(a).toBeCloseTo(b, 15);
    }
  });

  it('純乱視 軸 0° (S=0, C=-2): J0=1, J45=0 → c22 = -R²/(2√6), c2-2=0', () => {
    const { c20, c22, c2m2 } = refractionToZernike(0, -2, 0, R);
    // M = -1 → c20 = R²/(4√3)
    expect(c20).toBeCloseTo((R * R) / (4 * SQRT3), 15);
    expect(c22).toBeCloseTo(-(R * R) / (2 * SQRT6), 15);
    expect(c2m2).toBeCloseTo(0, 15);
  });

  it('純乱視 軸 90° (S=0, C=-2): J0=-1, J45=0 → c22 が符号反転', () => {
    const ax0 = refractionToZernike(0, -2, 0, R);
    const ax90 = refractionToZernike(0, -2, 90, R);
    expect(ax90.c20).toBeCloseTo(ax0.c20, 15);
    expect(ax90.c22).toBeCloseTo(-ax0.c22, 15);
    expect(ax90.c2m2).toBeCloseTo(0, 15);
  });

  it('斜乱視 軸 45° (S=0, C=-2): J0=0, J45=1 → c22=0, c2-2≠0', () => {
    const { c22, c2m2 } = refractionToZernike(0, -2, 45, R);
    expect(c22).toBeCloseTo(0, 12);
    expect(c2m2).toBeCloseTo(-(R * R) / (2 * SQRT6), 15);
  });
});

/**
 * 波面 W(x,y) を Zernike 係数から復元するヘルパ。
 * 単位: x,y は [m]、戻り値も [m]。
 */
function W(c: { c20: number; c22: number; c2m2: number }, x: number, y: number): number {
  const rho2 = (x * x + y * y) / (R * R);
  const phi = Math.atan2(y, x);
  const Z20 = SQRT3 * (2 * rho2 - 1);
  const Z22 = SQRT6 * rho2 * Math.cos(2 * phi);
  const Z2m2 = SQRT6 * rho2 * Math.sin(2 * phi);
  return c.c20 * Z20 + c.c22 * Z22 + c.c2m2 * Z2m2;
}

/**
 * 子午線方向 θ_meridian に沿った 2 点 (中心 / 縁) の波面差から
 * 有効デフォーカス D を逆算する: W_edge - W_center = -D·R²/2
 */
function defocusAlongMeridian(c: { c20: number; c22: number; c2m2: number }, thetaDeg: number): number {
  const th = (thetaDeg * Math.PI) / 180;
  const x = R * Math.cos(th);
  const y = R * Math.sin(th);
  const dW = W(c, x, y) - W(c, 0, 0);
  return -(2 * dW) / (R * R);
}

describe('子午線方向の実効デフォーカス (波面から逆算)', () => {
  it('純球面 +2D は全方向で +2D', () => {
    const c = refractionToZernike(2, 0, 0, R);
    for (const th of [0, 30, 60, 90, 135]) {
      expect(defocusAlongMeridian(c, th)).toBeCloseTo(2, 12);
    }
  });

  it('純球面 -4D は全方向で -4D（近視）', () => {
    const c = refractionToZernike(-4, 0, 0, R);
    for (const th of [0, 45, 90, 120]) {
      expect(defocusAlongMeridian(c, th)).toBeCloseTo(-4, 12);
    }
  });

  it('S=0 C=-2 軸 0°: 水平 0°=0D, 垂直 90°=-2D（負乱視規約: 軸 = 弱主経線）', () => {
    const c = refractionToZernike(0, -2, 0, R);
    expect(defocusAlongMeridian(c, 0)).toBeCloseTo(0, 12);
    expect(defocusAlongMeridian(c, 90)).toBeCloseTo(-2, 12);
    // 45° は中間 (P = S + C·sin²(45°) = -1)
    expect(defocusAlongMeridian(c, 45)).toBeCloseTo(-1, 12);
  });

  it('S=0 C=-2 軸 90°: 垂直 0D, 水平 -2D（90° 回転で入れ替わる）', () => {
    const c = refractionToZernike(0, -2, 90, R);
    expect(defocusAlongMeridian(c, 90)).toBeCloseTo(0, 12);
    expect(defocusAlongMeridian(c, 0)).toBeCloseTo(-2, 12);
  });

  it('S=+1 C=-3 軸 30°: P(30°)=+1, P(120°)=-2 （主経線で公式と一致）', () => {
    const c = refractionToZernike(1, -3, 30, R);
    expect(defocusAlongMeridian(c, 30)).toBeCloseTo(1, 12);
    expect(defocusAlongMeridian(c, 120)).toBeCloseTo(-2, 12);
  });

  it('一般式 P(θ) = S + C·sin²(θ-θ_axis) を 12 方向で照合', () => {
    const S = 0.5;
    const C = -2.5;
    const ax = 67;
    const c = refractionToZernike(S, C, ax, R);
    for (let deg = 0; deg < 180; deg += 15) {
      const phi = ((deg - ax) * Math.PI) / 180;
      const expected = S + C * Math.sin(phi) * Math.sin(phi);
      expect(defocusAlongMeridian(c, deg)).toBeCloseTo(expected, 10);
    }
  });
});

const N_PSF = 64;
const FOV = 60;

/** PSF の重心からの半径方向 2 次モーメント [arcmin²] を返す（ブラー指標）。 */
function rmsArcmin(psf: Float64Array, N: number, dthetaRad: number): number {
  let sum = 0;
  let mx = 0;
  let my = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = psf[y * N + x];
      sum += v;
      mx += v * x;
      my += v * y;
    }
  }
  mx /= sum;
  my /= sum;
  let m2 = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = psf[y * N + x];
      const dx = (x - mx) * dthetaRad;
      const dy = (y - my) * dthetaRad;
      m2 += v * (dx * dx + dy * dy);
    }
  }
  const arcminPerRad = (180 * 60) / Math.PI;
  return Math.sqrt(m2 / sum) * arcminPerRad;
}

/** PSF の重心 (x,y モーメント)。アライメント確認用。 */
function centroid(psf: Float64Array, N: number): { mx: number; my: number } {
  let sum = 0;
  let mx = 0;
  let my = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = psf[y * N + x];
      sum += v;
      mx += v * x;
      my += v * y;
    }
  }
  return { mx: mx / sum, my: my / sum };
}

/** 主軸の方向（PSF 共分散行列の固有ベクトル）を返す [°、0–180]。 */
function principalAxisDeg(psf: Float64Array, N: number): number {
  let sum = 0;
  let mx = 0;
  let my = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = psf[y * N + x];
      sum += v;
      mx += v * x;
      my += v * y;
    }
  }
  mx /= sum;
  my /= sum;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = psf[y * N + x];
      const dx = x - mx;
      const dy = y - my;
      sxx += v * dx * dx;
      syy += v * dy * dy;
      sxy += v * dx * dy;
    }
  }
  // 主軸角 = 0.5 atan2(2sxy, sxx-syy)
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let deg = (ang * 180) / Math.PI;
  if (deg < 0) deg += 180;
  return deg;
}

describe('PSF (|FT{P}|²) の物理性', () => {
  it('合計エネルギーが 1 に正規化されている', () => {
    const { psf } = computePsfFromRefraction({
      sphereD: 0,
      cylinderD: 0,
      axisDeg: 0,
      pupilRadius: R,
      gridSize: N_PSF,
      fovArcmin: FOV,
    });
    let s = 0;
    for (const v of psf) s += v;
    expect(s).toBeCloseTo(1, 8);
  });

  it('デフォーカス 0 では PSF が中心に強くピーク（≈ 回折限界）', () => {
    const { psf } = computePsfFromRefraction({
      sphereD: 0,
      cylinderD: 0,
      axisDeg: 0,
      pupilRadius: R,
      gridSize: N_PSF,
      fovArcmin: FOV,
    });
    // 中心 1 ピクセルが全体の少なくとも 5% を占めること（強くピークしている指標）
    const cx = N_PSF / 2;
    const cy = N_PSF / 2;
    const peak = psf[cy * N_PSF + cx];
    expect(peak).toBeGreaterThan(0.05);
  });

  it('デフォーカス絶対値が増えるほど PSF が広がる', () => {
    const conf = {
      cylinderD: 0,
      axisDeg: 0,
      pupilRadius: R,
      gridSize: N_PSF,
      fovArcmin: FOV,
    };
    const a = computePsfFromRefraction({ sphereD: 0, ...conf });
    const b = computePsfFromRefraction({ sphereD: 1, ...conf });
    const c = computePsfFromRefraction({ sphereD: 3, ...conf });
    const rA = rmsArcmin(a.psf, a.size, a.angularStep);
    const rB = rmsArcmin(b.psf, b.size, b.angularStep);
    const rC = rmsArcmin(c.psf, c.size, c.angularStep);
    expect(rA).toBeLessThan(rB);
    expect(rB).toBeLessThan(rC);
  });

  it('デフォーカスの符号反転 (+D / -D) で同じ PSF が得られる', () => {
    const conf = {
      cylinderD: 0,
      axisDeg: 0,
      pupilRadius: R,
      gridSize: N_PSF,
      fovArcmin: FOV,
    };
    const pos = computePsfFromRefraction({ sphereD: 2, ...conf });
    const neg = computePsfFromRefraction({ sphereD: -2, ...conf });
    // 全ピクセルで一致（FFT の対称性により厳密に同じ）
    let maxDiff = 0;
    for (let i = 0; i < pos.psf.length; i++) {
      const d = Math.abs(pos.psf[i] - neg.psf[i]);
      if (d > maxDiff) maxDiff = d;
    }
    expect(maxDiff).toBeLessThan(1e-10);
  });

  it('純乱視 (S=0, C=-2, axis=0) で PSF が異方的 — 主軸 ≈ 水平/垂直', () => {
    const { psf, size, angularStep } = computePsfFromRefraction({
      sphereD: 0,
      cylinderD: -2,
      axisDeg: 0,
      pupilRadius: R,
      gridSize: N_PSF,
      fovArcmin: FOV,
    });
    void angularStep;
    // 主軸が 0° 近傍か 90° 近傍（垂直方向にぼけ広がる、もしくは水平方向）
    const ax = principalAxisDeg(psf, size);
    const distTo0 = Math.min(ax, 180 - ax);
    const distTo90 = Math.abs(ax - 90);
    expect(Math.min(distTo0, distTo90)).toBeLessThan(15);
  });

  it('乱視軸を 90° 回転すると PSF の主軸も 90° 回転する', () => {
    const conf = {
      sphereD: 0,
      cylinderD: -2,
      pupilRadius: R,
      gridSize: N_PSF,
      fovArcmin: FOV,
    };
    const a = computePsfFromRefraction({ ...conf, axisDeg: 0 });
    const b = computePsfFromRefraction({ ...conf, axisDeg: 90 });
    const axA = principalAxisDeg(a.psf, a.size);
    const axB = principalAxisDeg(b.psf, b.size);
    let diff = Math.abs(axA - axB);
    if (diff > 90) diff = 180 - diff;
    expect(diff).toBeGreaterThan(75);
  });

  it('斜乱視 (axis=45°) で PSF 主軸も 45°/135° 近傍', () => {
    const { psf, size } = computePsfFromRefraction({
      sphereD: 0,
      cylinderD: -2,
      axisDeg: 45,
      pupilRadius: R,
      gridSize: N_PSF,
      fovArcmin: FOV,
    });
    const ax = principalAxisDeg(psf, size);
    const distTo45 = Math.abs(ax - 45);
    const distTo135 = Math.abs(ax - 135);
    expect(Math.min(distTo45, distTo135)).toBeLessThan(15);
  });

  it('PSF 重心はほぼ画像中心（デフォーカスでシフトしない）', () => {
    const { psf, size } = computePsfFromRefraction({
      sphereD: 2,
      cylinderD: -1.5,
      axisDeg: 30,
      pupilRadius: R,
      gridSize: N_PSF,
      fovArcmin: FOV,
    });
    const { mx, my } = centroid(psf, size);
    expect(Math.abs(mx - size / 2)).toBeLessThan(1.5);
    expect(Math.abs(my - size / 2)).toBeLessThan(1.5);
  });
});

describe('buildPupilFunction — 瞳孔関数の境界', () => {
  it('瞳外は (re,im) = 0、瞳内は |P| = 1', () => {
    const z = refractionToZernike(1, 0, 0, R);
    const N = 32;
    const pupil = buildPupilFunction(
      { defocus: z.c20, astig0: z.c22, astig45: z.c2m2 },
      { pupilRadius: R, gridSize: N, fovArcmin: FOV },
    );
    // 中心: 確実に瞳内
    const center = (N / 2) * N + N / 2;
    const mag2 = pupil.re[center] ** 2 + pupil.im[center] ** 2;
    expect(mag2).toBeCloseTo(1, 12);

    // コーナー: 確実に瞳外 (≫ R)
    expect(pupil.re[0]).toBe(0);
    expect(pupil.im[0]).toBe(0);
  });

  it('デフォーカス 0 のとき瞳孔関数は (1, 0) 一定（位相 = 0）', () => {
    const N = 32;
    const pupil = buildPupilFunction(
      { defocus: 0, astig0: 0, astig45: 0 },
      { pupilRadius: R, gridSize: N, fovArcmin: FOV },
    );
    // 全ての瞳内サンプルが実部 ≈ 1、虚部 ≈ 0
    let maxImag = 0;
    let nIn = 0;
    for (let i = 0; i < N * N; i++) {
      const mag = pupil.re[i] ** 2 + pupil.im[i] ** 2;
      if (mag > 0.5) {
        nIn++;
        if (Math.abs(pupil.im[i]) > maxImag) maxImag = Math.abs(pupil.im[i]);
        expect(pupil.re[i]).toBeCloseTo(1, 12);
      }
    }
    expect(nIn).toBeGreaterThan(10);
    expect(maxImag).toBeLessThan(1e-12);
  });
});

describe('computePSF — 角度サンプル間隔', () => {
  it('N が十分大きいとき angularStep · N が指定 FOV と一致する', () => {
    // N が小さいと Nactive が N でクランプされ FOV が狭まる。
    // phase4.ts と同じ N=256 で確認する。
    const { angularStep, size } = computePsfFromRefraction({
      sphereD: 0,
      cylinderD: 0,
      axisDeg: 0,
      pupilRadius: R,
      gridSize: 256,
      fovArcmin: FOV,
    });
    const totalArcmin = (angularStep * size * 180 * 60) / Math.PI;
    expect(Math.abs(totalArcmin - FOV)).toBeLessThan(FOV * 0.05);
  });

  it('N が小さく Nactive がクランプされたときの理論値と一致する', () => {
    // この場合 angularStep · N = λ · Nactive / (2r) ≈ λ · N / (2r)
    const lambda = 555e-9;
    const N = 64;
    const { angularStep, size } = computePsfFromRefraction({
      sphereD: 0,
      cylinderD: 0,
      axisDeg: 0,
      pupilRadius: R,
      gridSize: N,
      fovArcmin: FOV,
    });
    const totalRad = angularStep * size;
    const expectedRad = (lambda * N) / (2 * R);
    expect(totalRad).toBeCloseTo(expectedRad, 8);
  });
});

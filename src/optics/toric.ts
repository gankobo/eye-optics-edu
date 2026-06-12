/**
 * Toric IOL シミュレーション用の Power Vector 合成と仮想眼構築。
 *
 * 物理モデル（自前の一貫定義）:
 *   ある経線角度 θ における屈折値を
 *     D(θ) = M + R · cos(2(θ − φ_weak))
 *   と書く。
 *     M       = (D_max + D_min) / 2  ：等価球面
 *     R       = (D_max − D_min) / 2  ：振幅（≥ 0）
 *     φ_weak  ：D_max（弱主経線、屈折力が小さい方）の経線軸 [rad]
 *   power vector 表現:
 *     J0  = R · cos(2 φ_weak)
 *     J45 = R · sin(2 φ_weak)
 *   3 成分 (M, J0, J45) は単純な加算で合成できる。
 *
 *   ユーザー入力は常に「強主経線軸」（屈折力が大きい方の経線軸）。
 *   内部で φ_weak = 強主経線軸 + π/2 に変換する。
 *
 * 教育的意図:
 *   角膜乱視と IOL 乱視を power vector で合成し、IOL の軸角度を回すと
 *   残余乱視がどう変わるかを直感的に示す。
 *   IOL 軸を角膜の強主経線に直交させた瞬間に打ち消し合うことを体験する。
 */

import { makeEye, type EyeParamsMM } from './eyeModel';
import { ocularRefraction } from './paraxial';
import type { OpticalSystem } from './types';

export interface PowerVector {
  M: number; // 等価球面 [D]
  J0: number; // 0/90 軸の乱視成分 [D]
  J45: number; // 45/135 軸の乱視成分 [D]
}

export interface SphCylAxis {
  /** 等価球面 [D]。 */
  M: number;
  /** 円柱度数 [D]（マイナス表記。0 以下）。 */
  C: number;
  /** 強主経線軸 [rad]（0 ≤ θ < π）。屈折力が大きい方の経線。 */
  axisRad: number;
}

/**
 * 2 経線の屈折値と強主経線軸から power vector を作る。
 * D_strong : 強主経線の屈折値 [D]（屈折力大 → 値は小、近視寄り）
 * D_weak   : 弱主経線の屈折値 [D]（屈折力小 → 値は大、遠視寄り）
 *            通常 D_strong ≤ D_weak。
 * strongAxisDeg : 強主経線の軸角度 [°]
 */
export function powerVectorFromMeridians(
  D_strong: number,
  D_weak: number,
  strongAxisDeg: number,
): PowerVector {
  const M = (D_strong + D_weak) / 2;
  const R = (D_weak - D_strong) / 2;
  const phi_weak = (strongAxisDeg * Math.PI) / 180 + Math.PI / 2;
  return {
    M,
    J0: R * Math.cos(2 * phi_weak),
    J45: R * Math.sin(2 * phi_weak),
  };
}

/**
 * (球面 S, 円柱 C[マイナス表記], 強主経線軸) → power vector。
 * マイナス表記: D_weak = S, D_strong = S + C（C < 0 で D_strong < D_weak）
 */
export function powerVectorFromSCA(S: number, C: number, strongAxisDeg: number): PowerVector {
  return powerVectorFromMeridians(S + C, S, strongAxisDeg);
}

/** power vector → (M, C, 強主経線軸)。C はマイナス表記、axisRad ∈ [0, π)。 */
export function scaFromPowerVector(pv: PowerVector): SphCylAxis {
  const R = Math.sqrt(pv.J0 * pv.J0 + pv.J45 * pv.J45);
  const phi_weak = R > 1e-12 ? 0.5 * Math.atan2(pv.J45, pv.J0) : 0;
  let strongAxis = phi_weak - Math.PI / 2;
  while (strongAxis < 0) strongAxis += Math.PI;
  while (strongAxis >= Math.PI) strongAxis -= Math.PI;
  return {
    M: pv.M,
    C: -2 * R,
    axisRad: strongAxis,
  };
}

export function addPowerVectors(a: PowerVector, b: PowerVector): PowerVector {
  return { M: a.M + b.M, J0: a.J0 + b.J0, J45: a.J45 + b.J45 };
}

/**
 * 「眼屈折 targetRef [D]（遠視 +、近視 −）を持つ仮想眼」の角膜半径を二分法で求める。
 * 半径大 → 屈折力小 → 遠視寄り、半径小 → 屈折力大 → 近視寄り。
 */
export function cornealRadiusFromRefractionMM(
  targetRef: number,
  axialLengthMM: number,
  params: EyeParamsMM = {},
): number {
  let lo = 5.0;
  let hi = 12.0;
  // ref(r) は r について単調増加（半径大 → 屈折力弱 → 屈折値大）。
  // 目標 target に対し ref(mid) < target なら r をさらに大きく取りに行く。
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const eye = makeEye({ ...params, axialLengthMM, cornealRadiusMM: mid });
    const ref = ocularRefraction(eye);
    if (ref < targetRef) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface ToricInput {
  /** 角膜の強主経線半径 [mm]（屈折力大 = 半径小）。 */
  corneaSteepRadiusMM: number;
  /** 角膜の弱主経線半径 [mm]。 */
  corneaFlatRadiusMM: number;
  /** 角膜の強主経線軸 [°]（0〜180）。 */
  corneaAxisDeg: number;
  /** IOL の円柱度数 [D]（マイナス表記、0 以下）。 */
  iolCylinderD: number;
  /** IOL の強主経線軸 [°]（0〜180）。 */
  iolAxisDeg: number;
  /** 眼軸長 [mm]。 */
  axialLengthMM: number;
}

export interface ToricResult {
  corneaPV: PowerVector;
  iolPV: PowerVector;
  residualPV: PowerVector;
  residualSCA: SphCylAxis;
  /** 角膜乱視量 [D]（マイナス表記、≤ 0）。 */
  corneaCylinderD: number;
  /** 角膜の強主経線軸 [rad]。 */
  corneaAxisRad: number;
  /** 残余乱視を再現する仮想眼の強主経線半径 [mm]。 */
  effectiveSteepRadiusMM: number;
  /** 残余乱視を再現する仮想眼の弱主経線半径 [mm]。 */
  effectiveFlatRadiusMM: number;
  /** 強経線屈折 [D]（残余乱視ベース、近視寄りで小さい値）。 */
  steepRefractionD: number;
  /** 弱経線屈折 [D]（残余乱視ベース、遠視寄りで大きい値）。 */
  flatRefractionD: number;
}

/**
 * 角膜と IOL の乱視を power vector で合成し、残余乱視と
 * それを再現する「仮想角膜半径ペア」を求める。
 */
export function computeToric(input: ToricInput): ToricResult {
  // --- 角膜の主経線屈折 ---
  const steepEye = makeEye({
    axialLengthMM: input.axialLengthMM,
    cornealRadiusMM: input.corneaSteepRadiusMM,
  });
  const flatEye = makeEye({
    axialLengthMM: input.axialLengthMM,
    cornealRadiusMM: input.corneaFlatRadiusMM,
  });
  const D_strong_c = ocularRefraction(steepEye); // 半径小 → 近視寄り → 値は小
  const D_weak_c = ocularRefraction(flatEye); // 半径大 → 遠視寄り → 値は大

  const corneaPV = powerVectorFromMeridians(D_strong_c, D_weak_c, input.corneaAxisDeg);
  const C_c = -(D_weak_c - D_strong_c); // マイナス表記の角膜円柱

  // --- IOL の乱視成分 + 球面成分（角膜の M をぴったり打ち消す前提） ---
  // 教育上の建前: IOL の球面度数は「角膜の等価球面と眼軸長に合わせて常に正しく選定済み」
  // とする。ユーザーは円柱量と軸だけを操作する。
  // → 残余等価球面 M = corneaPV.M + iolPV.M = 0 になるよう、IOL 側の M を −corneaPV.M に置く。
  // これにより焦線群は常に網膜を中心に前後対称に並び、IOL 軸の合致だけが教育の主役になる。
  const iolPV = powerVectorFromMeridians(input.iolCylinderD, 0, input.iolAxisDeg);
  iolPV.M = -corneaPV.M;

  // --- 合成残余 ---
  const residualPV = addPowerVectors(corneaPV, iolPV);
  const residualSCA = scaFromPowerVector(residualPV);

  // --- 残余乱視を再現する強・弱経線屈折と仮想角膜半径 ---
  // D_strong_res = M + C / 2 （C < 0 なので強の方が小さい）
  // D_weak_res   = M − C / 2
  const D_strong_res = residualSCA.M + residualSCA.C / 2;
  const D_weak_res = residualSCA.M - residualSCA.C / 2;

  const effSteepR = cornealRadiusFromRefractionMM(D_strong_res, input.axialLengthMM);
  const effFlatR = cornealRadiusFromRefractionMM(D_weak_res, input.axialLengthMM);

  return {
    corneaPV,
    iolPV,
    residualPV,
    residualSCA,
    corneaCylinderD: C_c,
    corneaAxisRad: (input.corneaAxisDeg * Math.PI) / 180,
    effectiveSteepRadiusMM: effSteepR,
    effectiveFlatRadiusMM: effFlatR,
    steepRefractionD: D_strong_res,
    flatRefractionD: D_weak_res,
  };
}

/** 残余乱視を再現する仮想眼（強経線用・弱経線用）を作る補助。 */
export function makeEffectiveEyes(result: ToricResult, axialLengthMM: number): {
  steepEye: OpticalSystem;
  flatEye: OpticalSystem;
} {
  return {
    steepEye: makeEye({ axialLengthMM, cornealRadiusMM: result.effectiveSteepRadiusMM }),
    flatEye: makeEye({ axialLengthMM, cornealRadiusMM: result.effectiveFlatRadiusMM }),
  };
}

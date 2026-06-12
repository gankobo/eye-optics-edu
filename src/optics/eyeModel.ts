/**
 * 模型眼の構築。
 *
 * 設計上の重要点（教育的にも要）:
 *   眼内ガス／シリコンオイルの屈折効果は「水晶体後面」での屈折率差の変化として現れる。
 *   したがって水晶体を 1 枚の薄レンズに集約してはこの効果を再現できない。
 *   本モデルは水晶体を前面・後面の 2 面で表し、硝子体腔の屈折率 nVit を可変にする。
 *
 * 注意: 半径などのプリセット値はおおよその生理値であり、正常眼が厳密に正視に
 *   ならない場合がある。docs/optics-spec.md の「校正」節に従い、必要なら微調整する。
 *   臨床絶対値ではなく「変化の向きと桁」を理解させることが本教材の目的。
 */

import type { OpticalSystem, TamponadeMedium } from './types';

/** 媒質の屈折率（一般的な代表値）。 */
export const N = {
  air: 1.0,
  aqueous: 1.336, // 房水
  lens: 1.42, // 水晶体（等価）
  vitreous: 1.336, // 硝子体
  gas: 1.0, // SF6/C3F8 など（≈空気）
  siliconeOil: 1.4, // シリコンオイル代表値
} as const;

/** タンポナーデ媒質 → 硝子体腔屈折率。 */
export function vitreousIndex(medium: TamponadeMedium): number {
  switch (medium) {
    case 'gas':
      return N.gas;
    case 'silicone-oil':
      return N.siliconeOil;
    case 'vitreous':
    default:
      return N.vitreous;
  }
}

/** mm 入力をまとめて受け取り内部 SI 単位へ変換する眼パラメータ。 */
export interface EyeParamsMM {
  cornealRadiusMM?: number; // 角膜曲率半径
  lensAnteriorRadiusMM?: number; // 水晶体前面
  lensPosteriorRadiusMM?: number; // 水晶体後面（後方凸なので負）
  acdMM?: number; // 前房深度（角膜頂点→水晶体前面）
  lensThicknessMM?: number; // 水晶体厚
  axialLengthMM?: number; // 眼軸長（角膜頂点→網膜）
  vitreousN?: number; // 硝子体腔屈折率
  phakic?: boolean; // 有水晶体か（false=無水晶体: 水晶体面を除去）
}

const DEFAULTS: Required<Omit<EyeParamsMM, 'vitreousN' | 'phakic'>> = {
  cornealRadiusMM: 7.8,
  lensAnteriorRadiusMM: 10.0,
  lensPosteriorRadiusMM: -6.0,
  acdMM: 3.6,
  lensThicknessMM: 3.6,
  axialLengthMM: 24.0,
};

/**
 * 模型眼を構築する。phakic=false（無水晶体）では水晶体 2 面を除去する。
 * 無水晶体＋オイルでは硝子体腔の前面が凸メニスカスとして働き
 * 屈折変化が逆転（近視化）する点は spec で解説する。
 */
export function makeEye(params: EyeParamsMM = {}): OpticalSystem {
  const p = { ...DEFAULTS, ...params };
  const phakic = params.phakic ?? true;
  const nVit = params.vitreousN ?? N.vitreous;

  const Rc = p.cornealRadiusMM / 1000;
  const Rla = p.lensAnteriorRadiusMM / 1000;
  const Rlp = p.lensPosteriorRadiusMM / 1000;
  const acd = p.acdMM / 1000;
  const tl = p.lensThicknessMM / 1000;
  const axial = p.axialLengthMM / 1000;

  if (phakic) {
    return {
      n0: N.air,
      surfaces: [
        { R: Rc, nAfter: N.aqueous, dAfter: acd, label: '角膜' },
        { R: Rla, nAfter: N.lens, dAfter: tl, label: '水晶体前面' },
        { R: Rlp, nAfter: nVit, dAfter: 0, label: '水晶体後面' },
      ],
      retinaFromLastSurface: axial - (acd + tl),
    };
  }
  // 無水晶体: 角膜のみ。硝子体腔の屈折率が像側媒質となる。
  return {
    n0: N.air,
    surfaces: [{ R: Rc, nAfter: nVit, dAfter: 0, label: '角膜' }],
    retinaFromLastSurface: axial,
  };
}

/** 媒質を切り替えた眼を作るショートカット。 */
export function makeEyeWithMedium(medium: TamponadeMedium, params: EyeParamsMM = {}): OpticalSystem {
  return makeEye({ ...params, vitreousN: vitreousIndex(medium) });
}

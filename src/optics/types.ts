/**
 * 光学コアの共有型定義。
 * 単位は内部的にすべて SI（メートル m / ラジアン rad / ジオプター D）で統一する。
 * UI 層で mm・度・小数視力などへ変換する。単位の取り違えを防ぐため、
 * プリセット入力には mm を受け取るヘルパ（eyeModel.ts）を用意している。
 */

/** 屈折面（球面）。光は +z 方向に進む。 */
export interface Surface {
  /** 曲率半径 [m]。曲率中心が面より後方(+z側)にあれば正、前方なら負。 */
  R: number;
  /** この面を通過した後ろ側の媒質の屈折率。 */
  nAfter: number;
  /** 次の面までの物理距離 [m]（最終面では網膜までを別途指定するため 0）。 */
  dAfter: number;
  /** 教育表示用のラベル（任意）。 */
  label?: string;
}

/** 近軸追跡に必要な眼の光学系一式。 */
export interface OpticalSystem {
  /** 角膜頂点側（物体側）の屈折率。通常は空気 1.0。 */
  n0: number;
  /** 角膜頂点から順に並べた屈折面。 */
  surfaces: Surface[];
  /** 最終面から網膜までの距離 [m]。 */
  retinaFromLastSurface: number;
}

/** 近軸光線の状態（高さと近軸スロープ）。 */
export interface RayState {
  /** 光軸からの高さ [m]。 */
  y: number;
  /** 近軸スロープ（≒角度 [rad]）。 */
  u: number;
  /** 現在の媒質屈折率。 */
  n: number;
  /** 光軸方向の位置 [m]（角膜頂点を 0 とする）。 */
  z: number;
}

/** 硝子体腔を満たす媒質の種類。 */
export type TamponadeMedium = 'vitreous' | 'gas' | 'silicone-oil';

/** 乱視の主経線ごとの結像情報。 */
export interface SturmInterval {
  /** 前焦線の網膜換算位置 [m]（角膜頂点から）。 */
  anteriorFocalLineZ: number;
  /** 後焦線の網膜換算位置 [m]。 */
  posteriorFocalLineZ: number;
  /** 最小錯乱円の位置 [m]（ジオプター空間の中点）。 */
  circleOfLeastConfusionZ: number;
  /** 等価球面屈折 [D]。 */
  sphericalEquivalent: number;
}

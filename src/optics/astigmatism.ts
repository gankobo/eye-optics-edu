/**
 * 乱視（スツルムの円錐）の計算。
 *
 * 2 つの主経線に異なる角膜屈折力を与え、それぞれの結像位置（焦線）を求める。
 * 最小錯乱円はジオプター空間の中点（= 等価球面の結像位置）に生じる。
 *
 * 簡易モデルとして、角膜曲率半径を経線ごとに変えた 2 つの眼を作り、
 * それぞれの後側焦点位置を比較する。
 */

import type { EyeParamsMM } from './eyeModel';
import { makeEye } from './eyeModel';
import {
  imageDistanceFromCornea,
  ocularRefraction,
  traceBundle,
  type RayPath,
} from './paraxial';
import type { OpticalSystem, SturmInterval } from './types';

export interface AstigmatismInput extends EyeParamsMM {
  /** 強主経線の角膜曲率半径 [mm]（より強い屈折力 = 半径が小さい）。 */
  steepRadiusMM: number;
  /** 弱主経線の角膜曲率半径 [mm]。 */
  flatRadiusMM: number;
}

/**
 * スツルムの円錐の各要素位置（角膜頂点からの距離 [m]）と等価球面屈折を返す。
 *   Lobj: 物体バージェンス [D]（既定 0 = 無限遠平行光、すなわち後側焦点）。
 *   焦線位置・最小錯乱円位置は Lobj に依存し、等価球面屈折は眼の固有値。
 */
export function sturmConoid(input: AstigmatismInput, Lobj = 0): SturmInterval {
  const { steepRadiusMM, flatRadiusMM, ...rest } = input;

  const steepEye = makeEye({ ...rest, cornealRadiusMM: steepRadiusMM });
  const flatEye = makeEye({ ...rest, cornealRadiusMM: flatRadiusMM });

  // 強主経線 = 屈折力大 → 結像が手前（前焦線）
  const anteriorFocalLineZ = imageDistanceFromCornea(steepEye, Lobj);
  const posteriorFocalLineZ = imageDistanceFromCornea(flatEye, Lobj);

  // 等価球面屈折は眼の固有値（無限遠遠点バージェンスの平均）
  const steepRef = ocularRefraction(steepEye);
  const flatRef = ocularRefraction(flatEye);
  const sphericalEquivalent = (steepRef + flatRef) / 2;

  // 最小錯乱円は 2 焦線のジオプター（バージェンス）空間の中点に来る。
  const dioptricMidZ = harmonicMidpoint(anteriorFocalLineZ, posteriorFocalLineZ);

  return {
    anteriorFocalLineZ,
    posteriorFocalLineZ,
    circleOfLeastConfusionZ: dioptricMidZ,
    sphericalEquivalent,
  };
}

/**
 * 2 つの結像距離のジオプター空間中点に対応する位置。
 * バージェンス V=n/z が線形なので、中点バージェンスから位置へ戻す。
 * 像側媒質屈折率は両経線で共通とみなす（n は約分されるため位置比に効かない）。
 */
function harmonicMidpoint(z1: number, z2: number): number {
  const v1 = 1 / z1;
  const v2 = 1 / z2;
  const vMid = (v1 + v2) / 2;
  return 1 / vMid;
}

/**
 * 3D 描画用に、強主経線と弱主経線の眼系・光束・スツルム要素位置をまとめて返す。
 *   - steepSystem / flatSystem: 2 経線それぞれの近軸眼系（角膜半径だけ違う）
 *   - steepBundle / flatBundle: 各経線方向の光束（paraxial 平面で 1D 計算）
 *   - sturm: 前焦線・後焦線・最小錯乱円の z 位置 [m]
 * 3D 配置側で steepBundle は軸角度方向、flatBundle は直交方向に回転して描画する。
 */
export interface AstigmaticBundle {
  steepSystem: OpticalSystem;
  flatSystem: OpticalSystem;
  steepBundle: RayPath[];
  flatBundle: RayPath[];
  sturm: SturmInterval;
}

export function buildAstigmaticBundle(
  input: AstigmatismInput,
  opts: { Lobj: number; pupilDiameter: number; nRays?: number },
): AstigmaticBundle {
  const { steepRadiusMM, flatRadiusMM, ...rest } = input;
  const steepSystem = makeEye({ ...rest, cornealRadiusMM: steepRadiusMM });
  const flatSystem = makeEye({ ...rest, cornealRadiusMM: flatRadiusMM });

  const n = opts.nRays ?? 7;
  const steepBundle = traceBundle(steepSystem, opts.Lobj, opts.pupilDiameter, n);
  const flatBundle = traceBundle(flatSystem, opts.Lobj, opts.pupilDiameter, n);

  const sturm = sturmConoid(input, opts.Lobj);

  return { steepSystem, flatSystem, steepBundle, flatBundle, sturm };
}

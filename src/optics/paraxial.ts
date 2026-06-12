/**
 * 近軸（ガウス）光線追跡エンジン。
 *
 * 物理モデル（すべて SI 単位）:
 *   屈折:  n'·u' = n·u − y·Φ ,   Φ = (n' − n) / R   （面屈折力 [D]）
 *   転送:  y_next = y + u'·d                          （d は物理距離 [m]）
 *
 * このファイルは描画から独立した純関数のみで構成し、単体テストで数値検証する。
 * 検証済みの挙動（src/optics/__tests__/paraxial.test.ts 参照）:
 *   - 換算模型眼で平行光が ≈22.3mm に結像
 *   - 眼軸 1mm 延長で ≈ −2.6 D/mm の近視化
 *   - シリコンオイル(n=1.40)で遠視化、ガス(n=1.0)で近視化
 */

import type { OpticalSystem, Surface, RayState } from './types';

/** 1 つの面で近軸光線を屈折させる。 */
export function refractAtSurface(ray: RayState, surface: Surface): RayState {
  const phi = (surface.nAfter - ray.n) / surface.R; // 面屈折力 [D]
  const uPrime = (ray.n * ray.u - ray.y * phi) / surface.nAfter;
  return { y: ray.y, u: uPrime, n: surface.nAfter, z: ray.z };
}

/** 距離 d だけ光線を直進転送する。 */
export function transfer(ray: RayState, d: number): RayState {
  return { y: ray.y + ray.u * d, u: ray.u, n: ray.n, z: ray.z + d };
}

/**
 * 物体バージェンス Lobj [D]（= n0 / 物体距離、無限遠で 0）の光線を
 * 系全体に通し、各面後の状態列を返す。3D 光束描画はこの軌跡を使う。
 */
export function traceParaxial(system: OpticalSystem, Lobj: number, y0 = 1e-3): RayState[] {
  // 物点から発する辺縁光線の初期スロープ（近軸）
  let ray: RayState = { y: y0, u: (-Lobj * y0) / system.n0, n: system.n0, z: 0 };
  const path: RayState[] = [ray];
  for (const s of system.surfaces) {
    ray = refractAtSurface(ray, s);
    path.push(ray);
    if (s.dAfter !== 0) {
      ray = transfer(ray, s.dAfter);
      path.push(ray);
    }
  }
  return path;
}

/** 最終面直後の光線状態（高さ・スロープ）を返す。 */
function stateAtLastSurface(system: OpticalSystem, Lobj: number, y0 = 1e-3): RayState {
  let ray: RayState = { y: y0, u: (-Lobj * y0) / system.n0, n: system.n0, z: 0 };
  for (const s of system.surfaces) {
    ray = refractAtSurface(ray, s);
    if (s.dAfter !== 0) ray = transfer(ray, s.dAfter);
  }
  return ray;
}

/**
 * 眼屈折（角膜面基準の遠点バージェンス）[D] を求める。
 * 近軸系では網膜面での光線高さ Y は物体バージェンス Lobj の一次関数なので、
 * 2 点を評価して Y(Lobj)=0 となる Lobj を線形に解く。
 *   正の値 = 遠視、負の値 = 近視。
 */
export function ocularRefraction(system: OpticalSystem): number {
  const heightAtRetina = (Lobj: number): number => {
    const s = stateAtLastSurface(system, Lobj);
    return s.y + s.u * system.retinaFromLastSurface;
  };
  const a = heightAtRetina(0);
  const b = heightAtRetina(1);
  const slope = b - a;
  if (Math.abs(slope) < 1e-12) return 0;
  return -a / slope;
}

/**
 * 指定の物体バージェンス Lobj に対する眼内結像位置を、角膜頂点からの距離 [m] で返す。
 * Lobj=0 で後側焦点に一致する（backFocalDistanceFromCornea と等価）。
 */
export function imageDistanceFromCornea(system: OpticalSystem, Lobj: number): number {
  const s = stateAtLastSurface(system, Lobj);
  const distFromLast = -s.y / s.u; // 最終面から軸を切るまで
  const zLast = system.surfaces.reduce((acc, sf) => acc + sf.dAfter, 0);
  return zLast + distFromLast;
}

/**
 * 平行光（無限遠物体）の後側焦点位置を角膜頂点からの距離 [m] で返す。
 * imageDistanceFromCornea(system, 0) と等価。互換のため残す。
 */
export function backFocalDistanceFromCornea(system: OpticalSystem): number {
  return imageDistanceFromCornea(system, 0);
}

/** 3D 光束描画用に最終的に網膜面までの軌跡を含むよう拡張した RayState 系列。 */
export type RayPath = RayState[];

/**
 * 1 本の光線を網膜面まで追跡し、屈折点と網膜到達点の z–y 列を返す。
 * traceParaxial の出力に、最終面から網膜面までの伝搬を末尾に足したもの。
 */
export function traceToRetina(system: OpticalSystem, Lobj: number, y0: number): RayPath {
  const path = traceParaxial(system, Lobj, y0);
  const last = path[path.length - 1];
  const atRetina = transfer(last, system.retinaFromLastSurface);
  path.push(atRetina);
  return path;
}

/**
 * 瞳径 pupilDiameter [m] を満たす平行光束を nRays 本の光線で表現し、
 * 各光線の網膜面までの軌跡を返す。3D 描画はこの配列を線として描く。
 *   nRays: 奇数推奨（軸上光を含む）。
 */
export function traceBundle(
  system: OpticalSystem,
  Lobj: number,
  pupilDiameter: number,
  nRays = 9,
): RayPath[] {
  const r = pupilDiameter / 2;
  const paths: RayPath[] = [];
  for (let i = 0; i < nRays; i++) {
    const t = nRays === 1 ? 0 : (i / (nRays - 1)) * 2 - 1; // -1..+1
    const y0 = t * r;
    if (y0 === 0) {
      // 軸上光は屈折で動かないが、描画のため微小値で代用
      paths.push(traceToRetina(system, Lobj, 1e-9));
    } else {
      paths.push(traceToRetina(system, Lobj, y0));
    }
  }
  return paths;
}

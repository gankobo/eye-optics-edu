/**
 * Phase 2: スツルムの円錐の 3D 斜めビュー。
 *
 * 表現:
 *   - PerspectiveCamera で斜め上から眼球と光束を見下ろす。
 *   - 強主経線（steep）の光束は y 軸方向に広がるリボン状（前焦線=横線に集光）
 *   - 弱主経線（flat）の光束は x 軸方向に広がるリボン状（後焦線=縦線に集光）
 *   - 軸角度に応じて全体を z 軸まわりに回転する（円柱軸が斜めのときの表現）。
 *   - 前焦線（横）・後焦線（縦）・最小錯乱円（円）を実体マーカーで描く。
 *
 * 教育意図:
 *   円柱度数を増やすと2焦線が離れていく様子、最小錯乱円が等価球面位置にあること、
 *   軸角度を回すと2焦線が同期して回ることを直感的に観察できる。
 */

import * as THREE from 'three';
import type { OpticalSystem } from '../optics/types';
import type { RayPath } from '../optics/paraxial';
import type { AstigmaticBundle } from '../optics/astigmatism';

const M2MM = 1000;

export interface SturmSceneUpdate {
  bundle: AstigmaticBundle;
  /** 強主経線の軸角度 [rad]（0 で水平経線が強主経線）。 */
  axisAngleRad: number;
  pupilDiameter: number;
  /**
   * toric IOL マーカーの描画指定（Phase 3 用）。
   * 与えるとリング状の IOL アウトラインと強主経線方向の 2 ドットを描画する。
   */
  iolMarker?: {
    /** IOL の強主経線軸 [rad]。 */
    axisRad: number;
    /** 角膜頂点からの IOL 位置 [mm]。 */
    zMM: number;
  };
  /**
   * 角膜の主経線方向マーカー（Phase 2 / 3 共通）。
   * 与えると角膜リング上に強主経線（赤タブ）と弱主経線（青タブ）を描画する。
   */
  corneaMarker?: {
    /** 角膜の強主経線軸 [rad]。 */
    axisRad: number;
  };
}

export interface SturmSceneAPI {
  update(opts: SturmSceneUpdate): void;
  dispose(): void;
}

export function createSturmScene(container: HTMLElement): SturmSceneAPI {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xf6f7fb);

  const scene = new THREE.Scene();

  // 斜め俯瞰の Perspective カメラ。眼球中心 (z≈14mm) を見る。
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  const lookTarget = new THREE.Vector3(14, 0, 0);
  // lookTarget からの基本カメラオフセット（横長レイアウト時の標準位置）
  const baseCameraOffset = new THREE.Vector3(14, 14, 36);
  const baseDistance = baseCameraOffset.length();
  // 確保したい水平視野サイズ [mm]（眼球全体＋マーカーが入る幅）
  const TARGET_H_MM = 34;
  const MAX_PULLBACK = 2.5;
  const FOV_TAN_HALF = Math.tan((35 * Math.PI) / 180 / 2);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = Math.max(w / h, 0.3);
    camera.aspect = aspect;
    // 「TARGET_H_MM が水平に収まる最小カメラ距離」を計算し、ベース距離より大きければ
    // その比率でカメラを後退させる。広いアスペクトでは scale=1 で従来通りの見え方を維持。
    const minDistance = TARGET_H_MM / (2 * FOV_TAN_HALF * aspect);
    const scale = Math.min(Math.max(1, minDistance / baseDistance), MAX_PULLBACK);
    camera.position.copy(lookTarget).add(baseCameraOffset.clone().multiplyScalar(scale));
    camera.lookAt(lookTarget);
    camera.updateProjectionMatrix();
    render();
  };

  // ライト（マーカーをほんの少し立体的に見せるため）
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 0.4);
  dir.position.set(20, 20, 30);
  scene.add(dir);

  // 永続: 光軸（長めのガイド線）
  const axisPts = [new THREE.Vector3(-10, 0, 0), new THREE.Vector3(40, 0, 0)];
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(axisPts),
      new THREE.LineBasicMaterial({ color: 0xb5b9c2 }),
    ),
  );

  // 動的グループ
  const dynamicGroup = new THREE.Group();
  scene.add(dynamicGroup);

  const render = () => renderer.render(scene, camera);

  container.appendChild(renderer.domElement);
  resize();
  window.addEventListener('resize', resize);

  function clearDynamic() {
    for (const child of [...dynamicGroup.children]) {
      dynamicGroup.remove(child);
      const o = child as THREE.Mesh | THREE.Line;
      o.geometry?.dispose?.();
      const m = (o as any).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m?.dispose();
    }
  }

  /**
   * 1経線分の光束を、与えられた「広がり方向の単位ベクトル dir」に沿って描画する。
   * paraxial は y_z 2D の結果。dir = (0,1,0) なら y 方向に広がるリボン（強主経線）、
   * dir = (1,0,0) なら x 方向に広がるリボン（弱主経線）として 3D に展開する。
   */
  function drawMeridianBundle(
    paths: RayPath[],
    dir: THREE.Vector3,
    color: number,
  ) {
    for (const path of paths) {
      const first = path[0];
      // 入射側（-8mm）まで前置き
      const preZmm = -8;
      const preYmm = first.y * M2MM - first.u * 8; // 平行光なら first.u=0 で first.y そのまま
      const points: THREE.Vector3[] = [];
      const addPt = (zMM: number, hMM: number) => {
        // hMM は paraxial の y 高さ（mm）。これを dir 方向に展開。
        const p = new THREE.Vector3(zMM, 0, 0);
        p.addScaledVector(dir, hMM);
        points.push(p);
      };
      addPt(preZmm, preYmm);
      for (const s of path) addPt(s.z * M2MM, s.y * M2MM);
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      dynamicGroup.add(
        new THREE.Line(
          geom,
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78 }),
        ),
      );
    }
  }

  function drawEyeAnatomy(system: OpticalSystem, hideLensSurfaces = false) {
    // 角膜・水晶体・網膜を 3D 環状（リング）として表現:
    // 各屈折面を z=zVertex に位置する縦の円（半径 5mm）で示す。
    // 教育的には簡略化版で十分（断面より3Dでの位置関係が伝わる）。
    // hideLensSurfaces=true: 水晶体（前面・後面）リングを描画しない。
    //   Phase 3 では橙の IOL リングが代わりに描かれるため重複を避ける。
    let cum = 0;
    for (const s of system.surfaces) {
      const zMM = cum * M2MM;
      cum += s.dAfter;
      const isCornea = s.label === '角膜';
      if (hideLensSurfaces && !isCornea) continue;
      const ringGeom = new THREE.TorusGeometry(5, 0.15, 8, 48);
      ringGeom.rotateY(Math.PI / 2); // YZ 平面に立てる
      const color = isCornea ? 0x2c7fb8 : 0x5fa55a;
      const mesh = new THREE.Mesh(
        ringGeom,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
      );
      mesh.position.x = zMM;
      dynamicGroup.add(mesh);
    }
    // 網膜（リングを赤で大きめ）
    const retinaZmm = (cum + system.retinaFromLastSurface) * M2MM;
    const rg = new THREE.TorusGeometry(7, 0.2, 8, 64);
    rg.rotateY(Math.PI / 2);
    const rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xe05a5a, transparent: true, opacity: 0.65 }));
    rm.position.x = retinaZmm;
    dynamicGroup.add(rm);
  }

  /**
   * スツルム3要素のマーカー描画。
   * 前焦線（強経線方向に集光）→ 強経線の dir に直交する方向に走る線分（パワークロス）。
   *  ※ 強経線方向に「集光」したあと、直交方向に広がっているため。
   */
  function drawSturmMarkers(
    bundle: AstigmaticBundle,
    steepDir: THREE.Vector3,
    flatDir: THREE.Vector3,
    pupilDiameter: number,
  ) {
    const halfBlurMM = (pupilDiameter * 1000) / 4; // ラフな焦線長さ目安
    const ant = bundle.sturm.anteriorFocalLineZ * M2MM; // 強経線屈折=焦点が手前
    const post = bundle.sturm.posteriorFocalLineZ * M2MM;
    const clc = bundle.sturm.circleOfLeastConfusionZ * M2MM;

    // 前焦線: 強経線で集光 → flat 方向に伸びる線
    addLineMarker(ant, flatDir, halfBlurMM, 0xe05a5a);
    // 後焦線: 弱経線で集光 → steep 方向に伸びる線
    addLineMarker(post, steepDir, halfBlurMM, 0x4f7df0);
    // 最小錯乱円: 半径 ~half/√2 の円リング
    addCircleMarker(clc, halfBlurMM * 0.7, 0x9b5de5);
  }

  function addLineMarker(zMM: number, dir: THREE.Vector3, halfLenMM: number, color: number) {
    const p1 = new THREE.Vector3(zMM, 0, 0).addScaledVector(dir, halfLenMM);
    const p2 = new THREE.Vector3(zMM, 0, 0).addScaledVector(dir, -halfLenMM);
    const g = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, linewidth: 4 }));
    dynamicGroup.add(line);
    // 強調用に太めの小球マーカーも添える
    for (const p of [p1, p2]) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 12),
        new THREE.MeshBasicMaterial({ color }),
      );
      s.position.copy(p);
      dynamicGroup.add(s);
    }
  }

  function addCircleMarker(zMM: number, radiusMM: number, color: number) {
    const seg = 48;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      pts.push(new THREE.Vector3(zMM, Math.cos(t) * radiusMM, Math.sin(t) * radiusMM));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    dynamicGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color, linewidth: 3 })));
  }

  function update(opts: SturmSceneUpdate) {
    clearDynamic();
    drawEyeAnatomy(opts.bundle.steepSystem, !!opts.iolMarker); // 形状は両系で同じ（角膜半径だけ違う）

    // 軸角度に応じて単位方向ベクトルを計算（光軸まわりに回転）
    // 規約: 軸 0° = 水平（Z 軸方向）、軸 90° = 垂直（Y 軸方向）。
    // 例) 倒乱視 (強主経線軸=0°, 水平): steepDir = (0,0,1) 水平、flatDir = (0,1,0) 垂直
    //     → 前焦線（flat 方向に伸びる）= 垂直、後焦線（steep 方向に伸びる）= 水平 ✓
    const a = opts.axisAngleRad;
    const steepDir = new THREE.Vector3(0, Math.sin(a), Math.cos(a));
    const flatDir = new THREE.Vector3(0, Math.cos(a), -Math.sin(a));

    drawMeridianBundle(opts.bundle.steepBundle, steepDir, 0xe05a5a);
    drawMeridianBundle(opts.bundle.flatBundle, flatDir, 0x4f7df0);
    drawSturmMarkers(opts.bundle, steepDir, flatDir, opts.pupilDiameter);

    if (opts.iolMarker) drawIolMarker(opts.iolMarker.zMM, opts.iolMarker.axisRad);
    if (opts.corneaMarker) drawCorneaMeridianMarker(opts.corneaMarker.axisRad);

    render();
  }

  /**
   * 角膜の強・弱主経線方向マーカー。
   * 光束が屈折する角膜頂点（z=0）に、角膜リング外側へ短いタブを 4 本生やす:
   *   強主経線（steep, 赤）= この経線が前焦線（赤）を生む
   *   弱主経線（flat, 青）= この経線が後焦線（青）を生む
   * 軸 0° = 水平、軸 90° = 垂直 の規約に合わせる。
   */
  function drawCorneaMeridianMarker(axisRad: number) {
    const zMM = 0; // 角膜頂点
    const innerR = 5.0; // 角膜リングの半径
    const tabLen = 1.4; // 外側へ伸ばすタブの長さ [mm]
    const steepDir = new THREE.Vector3(0, Math.sin(axisRad), Math.cos(axisRad));
    const flatDir = new THREE.Vector3(0, Math.cos(axisRad), -Math.sin(axisRad));
    addCorneaTab(zMM, steepDir, innerR, tabLen, 0xe05a5a);
    addCorneaTab(zMM, flatDir, innerR, tabLen, 0x4f7df0);
  }

  function addCorneaTab(
    zMM: number,
    dir: THREE.Vector3,
    innerR: number,
    lenMM: number,
    color: number,
  ) {
    for (const sign of [1, -1]) {
      const p1 = new THREE.Vector3(zMM, 0, 0).addScaledVector(dir, sign * innerR);
      const p2 = new THREE.Vector3(zMM, 0, 0).addScaledVector(dir, sign * (innerR + lenMM));
      const g = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      dynamicGroup.add(
        new THREE.Line(g, new THREE.LineBasicMaterial({ color, linewidth: 4 })),
      );
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 12),
        new THREE.MeshBasicMaterial({ color }),
      );
      tip.position.copy(p2);
      dynamicGroup.add(tip);
    }
  }

  /**
   * toric IOL マーカー: IOL 光学部の薄い橙リング + 中心を貫く橙点線。
   *
   * 臨床慣習との整合:
   *   実臨床の toric IOL の刻印マーカーは「IOL の弱主経線（円柱量が最小の軸）」を示し、
   *   外科医はそのマーカーを角膜の強主経線に合わせて挿入する
   *   → IOL の強主経線が角膜の弱主経線と重なり、乱視が打ち消される。
   *
   *   入力 `axisRad` は内部慣習で「IOL の強主経線軸」。
   *   描画では 90° ずらして「弱主経線方向」に点線を引き、実臨床の見え方に合わせる。
   */
  function drawIolMarker(zMM: number, axisRad: number) {
    const radius = 3.0; // 光学部の半径目安 [mm]
    // 点線方向 = IOL 弱主経線方向（= 強主経線軸 + 90°）。
    // 軸 0° = 水平、軸 90° = 垂直の規約に合わせる。
    const markerRad = axisRad + Math.PI / 2;
    const dir = new THREE.Vector3(0, Math.sin(markerRad), Math.cos(markerRad));

    // IOL 光学部のアウトライン（橙、TorusGeometry で実体描画。
    // LineBasicMaterial の linewidth は WebGL 制限で効かないため、太さを出すには実体ジオメトリにする）。
    const ringGeom = new THREE.TorusGeometry(radius, 0.25, 10, 64);
    ringGeom.rotateY(Math.PI / 2);
    const ringMesh = new THREE.Mesh(
      ringGeom,
      new THREE.MeshBasicMaterial({ color: 0xff9933, transparent: true, opacity: 0.7 }),
    );
    ringMesh.position.x = zMM;
    dynamicGroup.add(ringMesh);

    // 中心を貫く橙点線（直径方向）。実臨床の toric IOL の軸マーカー（中央線）を模す。
    // 線の太さを出すため、SphereGeometry の球を等間隔に並べて点線を表現。
    const nDots = 9;
    const sphRad = 0.25;
    for (let i = 0; i < nDots; i++) {
      const t = -1 + (2 * i) / (nDots - 1); // -1 .. +1
      const p = new THREE.Vector3(zMM, 0, 0).addScaledVector(dir, t * radius);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(sphRad, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff9933 }),
      );
      dot.position.copy(p);
      dynamicGroup.add(dot);
    }
  }

  function dispose() {
    window.removeEventListener('resize', resize);
    clearDynamic();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return { update, dispose };
}

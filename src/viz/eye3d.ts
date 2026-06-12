/**
 * 眼球側面ビューの Three.js シーン構築（Phase 1）。
 *
 * 設計:
 *   - OrthographicCamera で y–z 平面（光軸 z + 高さ y）を真横から眺める。
 *   - 描画は mm 単位（光学コアは SI [m] なので 1000 倍してから配置）。
 *   - 屈折面（角膜・水晶体前後）は曲率半径に従って円弧で描く。
 *   - 網膜は眼軸長位置の縦線として簡略表示（焦点との前後関係を即座に読める）。
 *   - 光束は paraxial.traceBundle の各経路を Line として描く。
 *
 * 教育意図:
 *   軸性近視（眼軸延長）と屈折性近視（角膜屈折力増）を同一画面でスライダ比較できる。
 *   焦点マーカーが網膜線の前にあれば近視、後ろにあれば遠視として直感的に読める。
 */

import * as THREE from 'three';
import type { OpticalSystem } from '../optics/types';
import { traceBundle, imageDistanceFromCornea } from '../optics/paraxial';

const M2MM = 1000;

export interface EyeSceneUpdate {
  system: OpticalSystem;
  /** 物体バージェンス Lobj [D]（0=無限遠平行光）。 */
  Lobj: number;
  /** 描画用瞳径 [m]。 */
  pupilDiameter: number;
}

export interface EyeSceneAPI {
  update(opts: EyeSceneUpdate): void;
  dispose(): void;
}

export function createEyeScene(container: HTMLElement): EyeSceneAPI {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xf6f7fb);

  const resizeRenderer = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    return { w, h };
  };
  const { w: w0, h: h0 } = resizeRenderer();
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // ビュー: 横 ~50mm × 縦 ~30mm を初期として、コンテナアスペクトで補正。
  const halfHeightMM = 14;
  const setupCamera = (w: number, h: number) => {
    const aspect = w / h;
    const halfWidthMM = Math.max(halfHeightMM * aspect, 22);
    const centerXMM = 14; // 角膜頂点(0) と網膜(~24mm) の中間付近
    const cam = new THREE.OrthographicCamera(
      centerXMM - halfWidthMM,
      centerXMM + halfWidthMM,
      halfHeightMM,
      -halfHeightMM,
      -100,
      100,
    );
    cam.position.set(0, 0, 10);
    return cam;
  };
  let camera = setupCamera(w0, h0);

  // 永続オブジェクト（軸・凡例的なもの）と、更新で再生成するグループを分ける。
  const dynamicGroup = new THREE.Group();
  scene.add(dynamicGroup);

  // 光軸（常時表示・水平の薄いガイド線）
  const axisGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-10, 0, 0),
    new THREE.Vector3(40, 0, 0),
  ]);
  scene.add(new THREE.Line(axisGeom, new THREE.LineBasicMaterial({ color: 0xc5c8d0 })));

  const render = () => renderer.render(scene, camera);

  const onResize = () => {
    const { w, h } = resizeRenderer();
    camera = setupCamera(w, h);
    render();
  };
  window.addEventListener('resize', onResize);

  function clearDynamic() {
    for (const child of [...dynamicGroup.children]) {
      dynamicGroup.remove(child);
      (child as THREE.Line).geometry?.dispose();
      const mat = (child as THREE.Line).material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  }

  function buildEyeAnatomy(system: OpticalSystem): { axialLengthMM: number } {
    // 各面の頂点 z 位置を計算（[m]）
    const surfaceVertices: { zM: number; R: number; label?: string }[] = [];
    let cumZ = 0;
    for (const s of system.surfaces) {
      surfaceVertices.push({ zM: cumZ, R: s.R, label: s.label });
      cumZ += s.dAfter;
    }
    const retinaZM = cumZ + system.retinaFromLastSurface;

    // 屈折面の円弧（高さ ±5mm 程度まで描画）
    const arcHalfHeightMM = 5;
    const arcSegments = 64;
    for (const sv of surfaceVertices) {
      const zCenterM = sv.zM + sv.R; // 球心 z [m]
      const Rabs = Math.abs(sv.R);
      // 描く y 範囲: 半径以内かつ ±5mm 以内
      const yMaxMM = Math.min(arcHalfHeightMM, Rabs * M2MM * 0.95);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= arcSegments; i++) {
        const t = (i / arcSegments) * 2 - 1;
        const yMM = t * yMaxMM;
        const yM = yMM / M2MM;
        // 球面: (z - zCenter)^2 + y^2 = R^2
        // 表面 z = zCenter ± sqrt(R^2 - y^2)。R > 0 (中心が後方)なら表面は中心より前 → z = zCenter - sqrt
        // R < 0 (中心が前方)なら表面は中心より後 → z = zCenter + sqrt
        const sqrt = Math.sqrt(Math.max(0, Rabs * Rabs - yM * yM));
        const zM = sv.R > 0 ? zCenterM - sqrt : zCenterM + sqrt;
        pts.push(new THREE.Vector3(zM * M2MM, yMM, 0.1));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const color = sv.label === '角膜' ? 0x2c7fb8 : 0x5fa55a;
      const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
      dynamicGroup.add(new THREE.Line(geom, mat));
    }

    // 網膜（縦線、±7mm）
    const retinaPts = [
      new THREE.Vector3(retinaZM * M2MM, -7, 0.1),
      new THREE.Vector3(retinaZM * M2MM, 7, 0.1),
    ];
    const retinaGeom = new THREE.BufferGeometry().setFromPoints(retinaPts);
    dynamicGroup.add(
      new THREE.Line(retinaGeom, new THREE.LineBasicMaterial({ color: 0xe05a5a, linewidth: 3 })),
    );

    return { axialLengthMM: retinaZM * M2MM };
  }

  function buildRayBundle(system: OpticalSystem, Lobj: number, pupilDiameter: number) {
    const bundle = traceBundle(system, Lobj, pupilDiameter, 7);
    for (const path of bundle) {
      // 入射側（角膜より前）: -8mm から角膜頂点までの光線を前置き
      const first = path[0];
      const preIn = new THREE.Vector3(-8, first.y * M2MM - first.u * 8, 0);
      const pts: THREE.Vector3[] = [preIn];
      for (const s of path) pts.push(new THREE.Vector3(s.z * M2MM, s.y * M2MM, 0));
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      dynamicGroup.add(
        new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xf2a93b, transparent: true, opacity: 0.85 })),
      );
    }
  }

  function buildFocusMarker(system: OpticalSystem, Lobj: number) {
    // 物体バージェンス Lobj に対する結像位置にマーカー（小さな十字）を描く
    const bfdM = imageDistanceFromCornea(system, Lobj);
    const xMM = bfdM * 1000;
    const size = 1.2;
    const cross = [
      new THREE.Vector3(xMM - size, 0, 0.2),
      new THREE.Vector3(xMM + size, 0, 0.2),
      new THREE.Vector3(xMM, -size, 0.2),
      new THREE.Vector3(xMM, size, 0.2),
    ];
    // 2 本の線分として
    const g1 = new THREE.BufferGeometry().setFromPoints([cross[0], cross[1]]);
    const g2 = new THREE.BufferGeometry().setFromPoints([cross[2], cross[3]]);
    const mat = new THREE.LineBasicMaterial({ color: 0xd62828, linewidth: 2 });
    dynamicGroup.add(new THREE.Line(g1, mat));
    dynamicGroup.add(new THREE.Line(g2, mat));
  }

  function update(opts: EyeSceneUpdate) {
    clearDynamic();
    buildEyeAnatomy(opts.system);
    buildRayBundle(opts.system, opts.Lobj, opts.pupilDiameter);
    buildFocusMarker(opts.system, opts.Lobj);
    render();
  }

  function dispose() {
    window.removeEventListener('resize', onResize);
    clearDynamic();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return { update, dispose };
}

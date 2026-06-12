/**
 * Phase 3 マウント: toric IOL シミュレーション。
 * （ファイル名は履歴上 phaseToric.ts のまま。UI 上の番号は main.ts で定義。）
 *
 * 角膜と IOL の乱視を power vector で合成し、残余乱視に基づくスツルム円錐を
 * Phase 2 の 3D 斜めビュー（sturm3d）で表示する。
 * IOL の強主経線方向のマーカー（オレンジドット 2 個）を 3D に重ねて表示し、
 * 「IOL の軸を回す → 残余乱視が減る」体験を可能にする。
 */

import { N } from '../optics/eyeModel';
import { buildAstigmaticBundle } from '../optics/astigmatism';
import { computeToric } from '../optics/toric';
import { createSturmScene } from './sturm3d';
import { mountToricControls, type ToricState } from './controlsToric';
import { createPsfOverlay } from './psfOverlay';
import type { PhaseHandle } from './phase1';

// IOL の z 位置（水晶体前面に相当）。eyeModel.ts の DEFAULTS.acdMM と整合。
const IOL_Z_MM = 3.6;

export function mountPhaseToric(viewport: HTMLElement, panel: HTMLElement): PhaseHandle {
  const scene = createSturmScene(viewport);
  const psfOverlay = createPsfOverlay(viewport);
  const controls = mountToricControls(panel);

  const apply = (s: ToricState) => {
    const Lobj = s.objectAtInfinity ? 0 : -N.air / (s.objectDistanceCM / 100);
    const pupilDiameter = s.pupilDiameterMM / 1000;

    // UI スライダ「IOL マーカー軸」は実臨床のマーカーが指す向き（IOL 弱主経線方向）。
    // power vector 合成と 3D 描画は強主経線軸を期待するので +90° して渡す。
    const iolStrongAxisDeg = (s.iolAxisDeg + 90) % 180;

    const toric = computeToric({
      corneaSteepRadiusMM: s.corneaSteepRadiusMM,
      corneaFlatRadiusMM: s.corneaFlatRadiusMM,
      corneaAxisDeg: s.corneaAxisDeg,
      iolCylinderD: s.iolCylinderD,
      iolAxisDeg: iolStrongAxisDeg,
      axialLengthMM: s.axialLengthMM,
    });

    // 残余乱視に対応する仮想角膜半径ペアで、Phase 2 と同じ buildAstigmaticBundle を呼ぶ。
    const bundle = buildAstigmaticBundle(
      {
        steepRadiusMM: toric.effectiveSteepRadiusMM,
        flatRadiusMM: toric.effectiveFlatRadiusMM,
        axialLengthMM: s.axialLengthMM,
      },
      { Lobj, pupilDiameter, nRays: 7 },
    );

    scene.update({
      bundle,
      axisAngleRad: toric.residualSCA.axisRad,
      pupilDiameter,
      corneaMarker: { axisRad: (s.corneaAxisDeg * Math.PI) / 180 },
      iolMarker: {
        axisRad: (iolStrongAxisDeg * Math.PI) / 180,
        zMM: IOL_Z_MM,
      },
    });

    // PSF オーバーレイ: 残余乱視 (Power Vector) から生成。
    // toric.residualSCA: { M, C(≤0 マイナス円柱), axisRad(強主経線軸) }
    // PSF は弱主経線方向の sphere + マイナス円柱量 + マイナス円柱軸 (= 強主経線+90°) を期待。
    const accomDemandD = s.objectAtInfinity ? 0 : 100 / s.objectDistanceCM;
    const steepAxisDeg = (toric.residualSCA.axisRad * 180) / Math.PI;
    psfOverlay.update({
      sphereD: toric.flatRefractionD + accomDemandD,
      cylinderD: toric.residualSCA.C,
      axisDeg: (steepAxisDeg + 90) % 180,
      pupilDiameterMM: s.pupilDiameterMM,
    });

    // 読み出し
    const cornealCylAbs = Math.abs(toric.corneaCylinderD);
    const residualCylAbs = Math.abs(toric.residualSCA.C);
    const residualAxisDeg = (toric.residualSCA.axisRad * 180) / Math.PI;
    const reductionPct =
      cornealCylAbs > 1e-6
        ? ((cornealCylAbs - residualCylAbs) / cornealCylAbs) * 100
        : 0;

    controls.setReadout(`
      <div class="kv"><span>角膜乱視</span><b>${fmtD(toric.corneaCylinderD)} D × ${s.corneaAxisDeg}°</b></div>
      <div class="kv"><span>IOL 円柱</span><b>${fmtD(s.iolCylinderD)} D × ${s.iolAxisDeg}°</b></div>
      <div class="kv"><span>残余乱視</span><b class="${residualCylAbs < 0.25 ? 'pos' : 'neg'}">${fmtD(toric.residualSCA.C)} D × ${residualAxisDeg.toFixed(0)}°</b></div>
      <div class="kv"><span>乱視低減率</span><b>${reductionPct.toFixed(0)} %</b></div>
      <div class="kv"><span>等価球面</span><b>${fmtD(toric.residualSCA.M)} D</b></div>
      <div class="kv"><span>強経線屈折 / 弱経線屈折</span><b>${fmtD(toric.steepRefractionD)} / ${fmtD(toric.flatRefractionD)} D</b></div>
    `);
  };

  controls.onChange(apply);
  apply(controls.state);

  return {
    dispose() {
      psfOverlay.dispose();
      scene.dispose();
      viewport.innerHTML = '';
      panel.innerHTML = '';
    },
  };
}

function fmtD(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

/**
 * Phase 2 マウント: スツルムの円錐を 3D 斜めビューで表示。
 */
import { N } from '../optics/eyeModel';
import { buildAstigmaticBundle } from '../optics/astigmatism';
import { ocularRefraction } from '../optics/paraxial';
import { makeEye } from '../optics/eyeModel';
import { createSturmScene } from './sturm3d';
import { mountSturmControls, type SturmState } from './controlsSturm';
import type { PhaseHandle } from './phase1';

export function mountPhase2(viewport: HTMLElement, panel: HTMLElement): PhaseHandle {
  const scene = createSturmScene(viewport);
  const controls = mountSturmControls(panel);

  const apply = (s: SturmState) => {
    const Lobj = s.objectAtInfinity ? 0 : -N.air / (s.objectDistanceCM / 100);
    const pupilDiameter = s.pupilDiameterMM / 1000;
    const bundle = buildAstigmaticBundle(
      {
        steepRadiusMM: s.steepRadiusMM,
        flatRadiusMM: s.flatRadiusMM,
        axialLengthMM: s.axialLengthMM,
      },
      { Lobj, pupilDiameter, nRays: 7 },
    );
    scene.update({
      bundle,
      axisAngleRad: (s.axisDeg * Math.PI) / 180,
      pupilDiameter,
      corneaMarker: { axisRad: (s.axisDeg * Math.PI) / 180 },
    });

    // 数値読み出し
    const steepRef = ocularRefraction(
      makeEye({ axialLengthMM: s.axialLengthMM, cornealRadiusMM: s.steepRadiusMM }),
    );
    const flatRef = ocularRefraction(
      makeEye({ axialLengthMM: s.axialLengthMM, cornealRadiusMM: s.flatRadiusMM }),
    );
    const cylinder = steepRef - flatRef; // 円柱度数（強と弱の差）
    const sphericalEq = bundle.sturm.sphericalEquivalent;

    const antMM = bundle.sturm.anteriorFocalLineZ * 1000;
    const postMM = bundle.sturm.posteriorFocalLineZ * 1000;
    const clcMM = bundle.sturm.circleOfLeastConfusionZ * 1000;
    const retinaMM = s.axialLengthMM;
    const intervalMM = postMM - antMM;

    controls.setReadout(`
      <div class="kv"><span>強主経線 屈折</span><b>${fmt(steepRef)} D</b></div>
      <div class="kv"><span>弱主経線 屈折</span><b>${fmt(flatRef)} D</b></div>
      <div class="kv"><span>円柱度数</span><b>${fmt(cylinder)} D</b></div>
      <div class="kv"><span>等価球面</span><b>${fmt(sphericalEq)} D</b></div>
      <div class="kv"><span>前焦線 z</span><b>${antMM.toFixed(2)} mm</b></div>
      <div class="kv"><span>後焦線 z</span><b>${postMM.toFixed(2)} mm</b></div>
      <div class="kv"><span>最小錯乱円 z</span><b>${clcMM.toFixed(2)} mm（網膜=${retinaMM.toFixed(1)}）</b></div>
      <div class="kv"><span>スツルム間隔</span><b>${intervalMM.toFixed(2)} mm</b></div>
    `);
  };

  controls.onChange(apply);
  apply(controls.state);

  return {
    dispose() {
      scene.dispose();
      viewport.innerHTML = '';
      panel.innerHTML = '';
    },
  };
}

function fmt(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

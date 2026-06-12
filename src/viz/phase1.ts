/**
 * Phase 1 マウント: 軸性近視・屈折性近視の側面ビューと操作 UI を組み立てる。
 * タブ切替時に dispose で完全に解体できるよう、副作用はこのモジュール内で閉じる。
 */
import { makeEye, N } from '../optics/eyeModel';
import { ocularRefraction, imageDistanceFromCornea } from '../optics/paraxial';
import { createEyeScene } from './eye3d';
import { mountControls, type SimState } from './controls';

export interface PhaseHandle {
  dispose(): void;
}

export function mountPhase1(viewport: HTMLElement, panel: HTMLElement): PhaseHandle {
  const eyeScene = createEyeScene(viewport);
  const controls = mountControls(panel);

  const applyState = (s: SimState) => {
    const eye = makeEye({
      axialLengthMM: s.axialLengthMM,
      cornealRadiusMM: s.cornealRadiusMM,
    });
    const Lobj = s.objectAtInfinity ? 0 : -N.air / (s.objectDistanceCM / 100);
    const pupilDiameter = s.pupilDiameterMM / 1000;

    eyeScene.update({ system: eye, Lobj, pupilDiameter });

    const refrD = ocularRefraction(eye);
    // 表示用: 平行光（無限遠）後側焦点と、現在の物体距離での結像位置を両方持つ
    const bfdMM = imageDistanceFromCornea(eye, 0) * 1000;
    const imgMM = imageDistanceFromCornea(eye, Lobj) * 1000;
    const focusOffsetMM = imgMM - s.axialLengthMM;
    const refSign = refrD > 0.25 ? '遠視' : refrD < -0.25 ? '近視' : '正視';

    let typeNote = '';
    if (Math.abs(refrD) > 0.5) {
      const baseline = makeEye();
      const baselineRef = ocularRefraction(baseline);
      const axialOnly = makeEye({ axialLengthMM: s.axialLengthMM });
      const corneaOnly = makeEye({ cornealRadiusMM: s.cornealRadiusMM });
      const axialDelta = ocularRefraction(axialOnly) - baselineRef;
      const corneaDelta = ocularRefraction(corneaOnly) - baselineRef;
      if (Math.abs(axialDelta) > Math.abs(corneaDelta) * 1.5) {
        typeNote = '<span class="tag axial">主に軸性</span>';
      } else if (Math.abs(corneaDelta) > Math.abs(axialDelta) * 1.5) {
        typeNote = '<span class="tag refractive">主に屈折性</span>';
      } else {
        typeNote = '<span class="tag mixed">軸性＋屈折性 複合</span>';
      }
    }

    const objLabel = s.objectAtInfinity ? '無限遠平行光' : `物体 ${s.objectDistanceCM}cm`;
    controls.setReadout(`
      <div class="kv"><span>眼屈折</span><b class="${refrD < 0 ? 'neg' : refrD > 0 ? 'pos' : ''}">${refrD >= 0 ? '+' : ''}${refrD.toFixed(2)} D</b></div>
      <div class="kv"><span>分類</span><b>${refSign} ${typeNote}</b></div>
      <div class="kv"><span>後側焦点（∞物体）</span><b>角膜から ${bfdMM.toFixed(2)} mm</b></div>
      <div class="kv"><span>${objLabel} の結像</span><b>角膜から ${imgMM.toFixed(2)} mm</b></div>
      <div class="kv"><span>網膜との差</span><b class="${focusOffsetMM < 0 ? 'neg' : focusOffsetMM > 0 ? 'pos' : ''}">${focusOffsetMM >= 0 ? '+' : ''}${focusOffsetMM.toFixed(2)} mm（${focusOffsetMM < 0 ? '網膜より手前' : focusOffsetMM > 0 ? '網膜より後ろ' : '網膜上'}）</b></div>
    `);
  };

  controls.onChange(applyState);
  applyState(controls.state);

  return {
    dispose() {
      eyeScene.dispose();
      viewport.innerHTML = '';
      panel.innerHTML = '';
    },
  };
}

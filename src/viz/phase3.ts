/**
 * Phase 4 マウント: 眼内媒質置換と水晶体の有無を扱う側面ビュー。
 * （ファイル名は履歴上 phase3.ts のまま。UI 上の番号は main.ts で定義。）
 * Phase 1 の eye3d.ts をそのまま再利用し、controls だけ差し替える。
 *
 * 教育意図:
 *   標準眼との屈折変化量 [D] を読み出しに常時表示し、媒質置換や水晶体除去で
 *   屈折がどちらにどの程度動くかを定量的に把握できるようにする。
 */

import { makeEye, vitreousIndex, N } from '../optics/eyeModel';
import { ocularRefraction, imageDistanceFromCornea } from '../optics/paraxial';
import { createEyeScene } from './eye3d';
import { mountControlsPhase3, type SimState3 } from './controlsPhase3';
import type { PhaseHandle } from './phase1';

const MEDIUM_LABEL: Record<SimState3['medium'], string> = {
  vitreous: '硝子体（標準）',
  gas: 'ガス',
  'silicone-oil': 'シリコンオイル',
};

export function mountPhase3(viewport: HTMLElement, panel: HTMLElement): PhaseHandle {
  const eyeScene = createEyeScene(viewport);
  const controls = mountControlsPhase3(panel);

  const baselineEye = makeEye();
  const baselineRefr = ocularRefraction(baselineEye);

  const applyState = (s: SimState3) => {
    const eye = makeEye({
      vitreousN: vitreousIndex(s.medium),
      phakic: s.phakic,
    });
    const Lobj = s.objectAtInfinity ? 0 : -N.air / (s.objectDistanceCM / 100);
    const pupilDiameter = s.pupilDiameterMM / 1000;

    eyeScene.update({ system: eye, Lobj, pupilDiameter });

    const refrD = ocularRefraction(eye);
    const deltaD = refrD - baselineRefr;
    const imgMM = imageDistanceFromCornea(eye, Lobj) * 1000;
    const axialMM = 24.0;
    const focusOffsetMM = imgMM - axialMM;
    const refSign = refrD > 0.25 ? '遠視' : refrD < -0.25 ? '近視' : '正視';

    const objLabel = s.objectAtInfinity ? '無限遠平行光' : `物体 ${s.objectDistanceCM}cm`;
    const phakicLabel = s.phakic ? '水晶体あり' : '無水晶体';

    controls.setReadout(`
      <div class="kv"><span>媒質</span><b>${MEDIUM_LABEL[s.medium]}</b></div>
      <div class="kv"><span>水晶体</span><b>${phakicLabel}</b></div>
      <div class="kv"><span>眼屈折</span><b class="${refrD < 0 ? 'neg' : refrD > 0 ? 'pos' : ''}">${refrD >= 0 ? '+' : ''}${refrD.toFixed(2)} D（${refSign}）</b></div>
      <div class="kv"><span>標準眼との差</span><b class="${deltaD < 0 ? 'neg' : deltaD > 0 ? 'pos' : ''}">${deltaD >= 0 ? '+' : ''}${deltaD.toFixed(2)} D（${deltaD > 0 ? '遠視化' : deltaD < 0 ? '近視化' : '変化なし'}）</b></div>
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

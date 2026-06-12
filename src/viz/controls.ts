/**
 * Phase 1 用のスライダ UI と数値表示。
 *
 * 状態モデル（mm 単位入力、内部は SI に揃える側で変換）:
 *   - axialLengthMM: 眼軸長
 *   - cornealRadiusMM: 角膜曲率半径（小さいほど屈折力大 → 屈折性近視）
 *   - objectDistanceCM: 物体距離 [cm]（∞ は専用チェックボックス）
 *   - pupilDiameterMM: 描画用瞳径（光束の太さ）
 *
 * 教育意図:
 *   軸性近視（眼軸延長）と屈折性近視（角膜半径低下）を別々のスライダで操作し、
 *   同じ屈折値 [D] でも原因が異なることを体感させる。
 */

export interface SimState {
  axialLengthMM: number;
  cornealRadiusMM: number;
  objectAtInfinity: boolean;
  objectDistanceCM: number;
  pupilDiameterMM: number;
}

export const DEFAULT_STATE: SimState = {
  axialLengthMM: 24.0,
  cornealRadiusMM: 7.8,
  objectAtInfinity: true,
  objectDistanceCM: 33,
  pupilDiameterMM: 4.0,
};

export interface ControlsAPI {
  state: SimState;
  onChange(cb: (s: SimState) => void): void;
  setReadout(text: string): void;
}

export function mountControls(container: HTMLElement): ControlsAPI {
  const state: SimState = { ...DEFAULT_STATE };
  const listeners: Array<(s: SimState) => void> = [];

  container.innerHTML = `
    <div class="controls">
      <h2>パラメータ</h2>

      <label class="slider">
        <span class="slabel">眼軸長 <b id="r-axial">${state.axialLengthMM.toFixed(1)}</b> mm</span>
        <input id="s-axial" type="range" min="20" max="30" step="0.1" value="${state.axialLengthMM}">
        <span class="hint">＋方向で軸性近視へ</span>
      </label>

      <label class="slider">
        <span class="slabel">角膜曲率半径 <b id="r-cornea">${state.cornealRadiusMM.toFixed(2)}</b> mm</span>
        <input id="s-cornea" type="range" min="6.5" max="9.5" step="0.05" value="${state.cornealRadiusMM}">
        <span class="hint">小さいほど屈折力大 → 屈折性近視へ</span>
      </label>

      <label class="slider">
        <span class="slabel">瞳径 <b id="r-pupil">${state.pupilDiameterMM.toFixed(1)}</b> mm</span>
        <input id="s-pupil" type="range" min="1" max="7" step="0.1" value="${state.pupilDiameterMM}">
        <span class="hint">光束の太さ（描画用）</span>
      </label>

      <fieldset class="objfield">
        <legend>物体距離</legend>
        <label><input id="c-inf" type="checkbox" ${state.objectAtInfinity ? 'checked' : ''}> 無限遠（平行光）</label>
        <label class="slider">
          <span class="slabel">距離 <b id="r-obj">${state.objectDistanceCM}</b> cm</span>
          <input id="s-obj" type="range" min="10" max="200" step="1" value="${state.objectDistanceCM}" ${state.objectAtInfinity ? 'disabled' : ''}>
        </label>
      </fieldset>

      <div class="readout" id="readout">
        <em>計算中…</em>
      </div>

      <details class="howto">
        <summary>操作ヒント</summary>
        <ul>
          <li>眼軸長を伸ばす → 焦点が網膜より<b>手前</b>に来る = 近視</li>
          <li>角膜半径を小さくする → 角膜屈折力↑で焦点が<b>手前</b>に来る = 近視</li>
          <li>同じ −3D の近視でも、軸性と屈折性で眼の形が違うことを確認</li>
        </ul>
      </details>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T;

  const sAxial = $<HTMLInputElement>('#s-axial');
  const sCornea = $<HTMLInputElement>('#s-cornea');
  const sPupil = $<HTMLInputElement>('#s-pupil');
  const sObj = $<HTMLInputElement>('#s-obj');
  const cInf = $<HTMLInputElement>('#c-inf');

  const rAxial = $<HTMLElement>('#r-axial');
  const rCornea = $<HTMLElement>('#r-cornea');
  const rPupil = $<HTMLElement>('#r-pupil');
  const rObj = $<HTMLElement>('#r-obj');

  const emit = () => listeners.forEach((cb) => cb({ ...state }));

  sAxial.addEventListener('input', () => {
    state.axialLengthMM = parseFloat(sAxial.value);
    rAxial.textContent = state.axialLengthMM.toFixed(1);
    emit();
  });
  sCornea.addEventListener('input', () => {
    state.cornealRadiusMM = parseFloat(sCornea.value);
    rCornea.textContent = state.cornealRadiusMM.toFixed(2);
    emit();
  });
  sPupil.addEventListener('input', () => {
    state.pupilDiameterMM = parseFloat(sPupil.value);
    rPupil.textContent = state.pupilDiameterMM.toFixed(1);
    emit();
  });
  sObj.addEventListener('input', () => {
    state.objectDistanceCM = parseFloat(sObj.value);
    rObj.textContent = String(state.objectDistanceCM);
    emit();
  });
  cInf.addEventListener('change', () => {
    state.objectAtInfinity = cInf.checked;
    sObj.disabled = state.objectAtInfinity;
    emit();
  });

  const readout = $<HTMLElement>('#readout');

  return {
    state,
    onChange(cb) {
      listeners.push(cb);
    },
    setReadout(text) {
      readout.innerHTML = text;
    },
  };
}

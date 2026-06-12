/**
 * Phase 2 用 UI: 乱視（強主経線・弱主経線・軸角度）操作と読み出し。
 */

export interface SturmState {
  steepRadiusMM: number;   // 強主経線（屈折力大 = 半径小）
  flatRadiusMM: number;    // 弱主経線
  axisDeg: number;         // 強主経線の軸角度 [度]
  axialLengthMM: number;
  pupilDiameterMM: number;
  objectAtInfinity: boolean;
  objectDistanceCM: number;
}

export const DEFAULT_STURM_STATE: SturmState = {
  steepRadiusMM: 7.4,
  flatRadiusMM: 8.0,
  axisDeg: 0,
  axialLengthMM: 24.0,
  pupilDiameterMM: 4.0,
  objectAtInfinity: true,
  objectDistanceCM: 33,
};

export interface SturmControlsAPI {
  state: SturmState;
  onChange(cb: (s: SturmState) => void): void;
  setReadout(text: string): void;
}

export function mountSturmControls(container: HTMLElement): SturmControlsAPI {
  const state: SturmState = { ...DEFAULT_STURM_STATE };
  const listeners: Array<(s: SturmState) => void> = [];

  container.innerHTML = `
    <div class="controls">
      <h2>乱視パラメータ</h2>

      <label class="slider">
        <span class="slabel"><span class="sw" style="background:#e05a5a"></span>強主経線 角膜曲率半径 <b id="r-steep">${state.steepRadiusMM.toFixed(2)}</b> mm</span>
        <input id="s-steep" type="range" min="6.5" max="9.0" step="0.05" value="${state.steepRadiusMM}">
        <span class="hint">屈折力が大きい方（半径小）。前焦線を作る</span>
      </label>

      <label class="slider">
        <span class="slabel"><span class="sw" style="background:#4f7df0"></span>弱主経線 角膜曲率半径 <b id="r-flat">${state.flatRadiusMM.toFixed(2)}</b> mm</span>
        <input id="s-flat" type="range" min="6.5" max="9.0" step="0.05" value="${state.flatRadiusMM}">
        <span class="hint">屈折力が小さい方（半径大）。後焦線を作る</span>
      </label>

      <label class="slider">
        <span class="slabel"><span class="sw" style="background:#e05a5a"></span>強主経線の軸角度 <b id="r-axis">${state.axisDeg}</b>°</span>
        <input id="s-axis" type="range" min="0" max="180" step="5" value="${state.axisDeg}">
        <span class="hint">2 焦線が同期して回る</span>
      </label>

      <label class="slider">
        <span class="slabel">眼軸長 <b id="r-axial">${state.axialLengthMM.toFixed(1)}</b> mm</span>
        <input id="s-axial" type="range" min="20" max="30" step="0.1" value="${state.axialLengthMM}">
      </label>

      <label class="slider">
        <span class="slabel">瞳径 <b id="r-pupil">${state.pupilDiameterMM.toFixed(1)}</b> mm</span>
        <input id="s-pupil" type="range" min="1" max="7" step="0.1" value="${state.pupilDiameterMM}">
      </label>

      <fieldset class="objfield">
        <legend>物体距離</legend>
        <label><input id="c-inf" type="checkbox" ${state.objectAtInfinity ? 'checked' : ''}> 無限遠（平行光）</label>
        <label class="slider">
          <span class="slabel">距離 <b id="r-obj">${state.objectDistanceCM}</b> cm</span>
          <input id="s-obj" type="range" min="10" max="200" step="1" value="${state.objectDistanceCM}" ${state.objectAtInfinity ? 'disabled' : ''}>
        </label>
      </fieldset>

      <div class="readout" id="readout-sturm"><em>計算中…</em></div>

      <details class="howto">
        <summary>操作ヒント</summary>
        <ul>
          <li>2 つの半径を等しくする → 乱視ゼロ（前後焦線が一致）</li>
          <li>2 つの差を広げる → 円柱度数↑、2 焦線が離れる（スツルム間隔↑）</li>
          <li>最小錯乱円（紫の円）が等価球面の結像位置に来る</li>
          <li>軸角度を回すと、赤線（前焦線）と青線（後焦線）が同期して回転</li>
        </ul>
      </details>

      <div class="legend">
        <div><span class="sw" style="background:#e05a5a"></span>前焦線（強経線で集光）／角膜リングの赤タブ = 強主経線方向</div>
        <div><span class="sw" style="background:#4f7df0"></span>後焦線（弱経線で集光）／角膜リングの青タブ = 弱主経線方向</div>
        <div><span class="sw" style="background:#9b5de5"></span>最小錯乱円</div>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T;
  const sSteep = $<HTMLInputElement>('#s-steep');
  const sFlat = $<HTMLInputElement>('#s-flat');
  const sAxis = $<HTMLInputElement>('#s-axis');
  const sAxial = $<HTMLInputElement>('#s-axial');
  const sPupil = $<HTMLInputElement>('#s-pupil');
  const sObj = $<HTMLInputElement>('#s-obj');
  const cInf = $<HTMLInputElement>('#c-inf');

  const rSteep = $<HTMLElement>('#r-steep');
  const rFlat = $<HTMLElement>('#r-flat');
  const rAxis = $<HTMLElement>('#r-axis');
  const rAxial = $<HTMLElement>('#r-axial');
  const rPupil = $<HTMLElement>('#r-pupil');
  const rObj = $<HTMLElement>('#r-obj');

  const emit = () => listeners.forEach((cb) => cb({ ...state }));

  sSteep.addEventListener('input', () => {
    let v = parseFloat(sSteep.value);
    // 強主経線は弱主経線より曲率半径が大きくなれない（強=半径小、弱=半径大）。
    if (v > state.flatRadiusMM) {
      v = state.flatRadiusMM;
      sSteep.value = String(v);
    }
    state.steepRadiusMM = v;
    rSteep.textContent = state.steepRadiusMM.toFixed(2);
    emit();
  });
  sFlat.addEventListener('input', () => {
    let v = parseFloat(sFlat.value);
    if (v < state.steepRadiusMM) {
      v = state.steepRadiusMM;
      sFlat.value = String(v);
    }
    state.flatRadiusMM = v;
    rFlat.textContent = state.flatRadiusMM.toFixed(2);
    emit();
  });
  sAxis.addEventListener('input', () => {
    state.axisDeg = parseFloat(sAxis.value);
    rAxis.textContent = String(state.axisDeg);
    emit();
  });
  sAxial.addEventListener('input', () => {
    state.axialLengthMM = parseFloat(sAxial.value);
    rAxial.textContent = state.axialLengthMM.toFixed(1);
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

  const readout = $<HTMLElement>('#readout-sturm');

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

/**
 * Phase 3 用 UI: 角膜乱視（強/弱半径、軸角度）＋ toric IOL（円柱量、軸角度）。
 *
 * 教育意図:
 *   IOL の軸角度を回すと、角膜と IOL の合成乱視（残余乱視）がどう変わるかを観察。
 *   特に IOL 軸 = 角膜の強主経線 − 90° のとき打ち消し合うことを体験する。
 *
 * UI ノート:
 *   - 「IOL 軸を角膜軸に直交させる」ボタンで一発確認できるようにする。
 *   - 物体距離は無限遠 / cm 指定の切替（Phase 2 と同様）。
 */

export interface ToricState {
  // 角膜
  corneaSteepRadiusMM: number;
  corneaFlatRadiusMM: number;
  corneaAxisDeg: number;
  // IOL
  iolCylinderD: number;
  iolAxisDeg: number;
  // 眼パラメータ
  axialLengthMM: number;
  pupilDiameterMM: number;
  // 物点
  objectAtInfinity: boolean;
  objectDistanceCM: number;
}

export const DEFAULT_TORIC_STATE: ToricState = {
  corneaSteepRadiusMM: 7.4,
  corneaFlatRadiusMM: 8.0,
  corneaAxisDeg: 90, // 直乱視（強主経線が垂直）
  iolCylinderD: 0.0,
  iolAxisDeg: 0,
  axialLengthMM: 24.0,
  pupilDiameterMM: 4.0,
  objectAtInfinity: true,
  objectDistanceCM: 33,
};

export interface ToricControlsAPI {
  state: ToricState;
  onChange(cb: (s: ToricState) => void): void;
  setReadout(html: string): void;
  /** プログラム側から IOL 軸を更新（直交ボタン用）。 */
  setIolAxis(deg: number): void;
}

export function mountToricControls(container: HTMLElement): ToricControlsAPI {
  const state: ToricState = { ...DEFAULT_TORIC_STATE };
  const listeners: Array<(s: ToricState) => void> = [];

  container.innerHTML = `
    <div class="controls">
      <h2>角膜乱視</h2>

      <label class="slider">
        <span class="slabel"><span class="sw" style="background:#e05a5a"></span>強主経線 角膜曲率半径 <b id="r-cst">${state.corneaSteepRadiusMM.toFixed(2)}</b> mm</span>
        <input id="s-cst" type="range" min="6.5" max="9.0" step="0.05" value="${state.corneaSteepRadiusMM}">
      </label>

      <label class="slider">
        <span class="slabel"><span class="sw" style="background:#4f7df0"></span>弱主経線 角膜曲率半径 <b id="r-cfl">${state.corneaFlatRadiusMM.toFixed(2)}</b> mm</span>
        <input id="s-cfl" type="range" min="6.5" max="9.0" step="0.05" value="${state.corneaFlatRadiusMM}">
      </label>

      <label class="slider">
        <span class="slabel"><span class="sw" style="background:#e05a5a"></span>角膜 強主経線 軸 <b id="r-cax">${state.corneaAxisDeg}</b>°</span>
        <input id="s-cax" type="range" min="0" max="180" step="5" value="${state.corneaAxisDeg}">
        <span class="hint">90° = 直乱視、0/180° = 倒乱視</span>
      </label>

      <h2>toric IOL</h2>
      <p style="color: var(--muted); font-size: 0.78rem; margin: 0.2rem 0 0.6rem; line-height: 1.45;">※ IOL の球面度数は「角膜と眼軸長に合わせて常に最適選定された」前提です（ユーザーは円柱量と軸のみ操作）。</p>

      <label class="slider">
        <span class="slabel"><span class="sw" style="background:#ff9933"></span>IOL 円柱度数 <b id="r-icyl">${state.iolCylinderD.toFixed(2)}</b> D</span>
        <input id="s-icyl" type="range" min="-6" max="0" step="0.25" value="${state.iolCylinderD}">
        <span class="hint">負値で強さを表す（−6 D = T9 相当）</span>
      </label>

      <label class="slider">
        <span class="slabel"><span class="sw" style="background:#ff9933"></span>IOL マーカー軸 <b id="r-iax">${state.iolAxisDeg}</b>°</span>
        <input id="s-iax" type="range" min="0" max="180" step="1" value="${state.iolAxisDeg}">
        <span class="hint">実臨床の toric IOL の軸マーカーを再現</span>
      </label>

      <button id="b-perp" class="preset" type="button">IOL マーカー（橙ドット）を角膜強主経線（赤タブ）に合わせる</button>

      <h2>眼パラメータ</h2>

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

      <div class="readout" id="readout-toric"><em>計算中…</em></div>

      <details class="howto">
        <summary>操作ヒント</summary>
        <ul>
          <li>角膜乱視を作る（半径差を 0.6mm 以上に）</li>
          <li>IOL 円柱量を −3.0 D 程度に設定</li>
          <li>「IOL マーカーを角膜強主経線に合わせる」を押すと、橙ドットが赤タブに重なり残余乱視が最小になる（臨床の手術手順と同じ）</li>
          <li>軸を少しずつずらすと残余乱視がじわっと増える（術中の軸合わせ精度の重要性）</li>
        </ul>
      </details>

      <div class="legend">
        <div><span class="sw" style="background:#e05a5a"></span>前焦線（合成系の強経線）／角膜リングの赤タブ = 角膜 強主経線方向</div>
        <div><span class="sw" style="background:#4f7df0"></span>後焦線（合成系の弱経線）／角膜リングの青タブ = 角膜 弱主経線方向</div>
        <div><span class="sw" style="background:#9b5de5"></span>最小錯乱円</div>
        <div><span class="sw" style="background:#ff9933"></span>IOL マーカー（橙ドット）。赤タブと重ねれば乱視キャンセル。</div>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T;

  const sCst = $<HTMLInputElement>('#s-cst');
  const sCfl = $<HTMLInputElement>('#s-cfl');
  const sCax = $<HTMLInputElement>('#s-cax');
  const sIcyl = $<HTMLInputElement>('#s-icyl');
  const sIax = $<HTMLInputElement>('#s-iax');
  const sAxial = $<HTMLInputElement>('#s-axial');
  const sPupil = $<HTMLInputElement>('#s-pupil');
  const sObj = $<HTMLInputElement>('#s-obj');
  const cInf = $<HTMLInputElement>('#c-inf');
  const bPerp = $<HTMLButtonElement>('#b-perp');

  const rCst = $<HTMLElement>('#r-cst');
  const rCfl = $<HTMLElement>('#r-cfl');
  const rCax = $<HTMLElement>('#r-cax');
  const rIcyl = $<HTMLElement>('#r-icyl');
  const rIax = $<HTMLElement>('#r-iax');
  const rAxial = $<HTMLElement>('#r-axial');
  const rPupil = $<HTMLElement>('#r-pupil');
  const rObj = $<HTMLElement>('#r-obj');

  const readout = $<HTMLElement>('#readout-toric');

  const emit = () => listeners.forEach((cb) => cb({ ...state }));

  sCst.addEventListener('input', () => {
    let v = parseFloat(sCst.value);
    // 強主経線は弱主経線より曲率半径が大きくなれない（強=半径小、弱=半径大）。
    if (v > state.corneaFlatRadiusMM) {
      v = state.corneaFlatRadiusMM;
      sCst.value = String(v);
    }
    state.corneaSteepRadiusMM = v;
    rCst.textContent = state.corneaSteepRadiusMM.toFixed(2);
    emit();
  });
  sCfl.addEventListener('input', () => {
    let v = parseFloat(sCfl.value);
    if (v < state.corneaSteepRadiusMM) {
      v = state.corneaSteepRadiusMM;
      sCfl.value = String(v);
    }
    state.corneaFlatRadiusMM = v;
    rCfl.textContent = state.corneaFlatRadiusMM.toFixed(2);
    emit();
  });
  sCax.addEventListener('input', () => {
    state.corneaAxisDeg = parseFloat(sCax.value);
    rCax.textContent = String(state.corneaAxisDeg);
    emit();
  });
  sIcyl.addEventListener('input', () => {
    state.iolCylinderD = parseFloat(sIcyl.value);
    rIcyl.textContent = state.iolCylinderD.toFixed(2);
    emit();
  });
  sIax.addEventListener('input', () => {
    state.iolAxisDeg = parseFloat(sIax.value);
    rIax.textContent = String(state.iolAxisDeg);
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

  const setIolAxis = (deg: number) => {
    let d = deg;
    while (d < 0) d += 180;
    while (d >= 180) d -= 180;
    state.iolAxisDeg = Math.round(d);
    sIax.value = String(state.iolAxisDeg);
    rIax.textContent = String(state.iolAxisDeg);
    emit();
  };

  bPerp.addEventListener('click', () => {
    setIolAxis(state.corneaAxisDeg + 90);
  });

  return {
    state,
    onChange(cb) {
      listeners.push(cb);
    },
    setReadout(html) {
      readout.innerHTML = html;
    },
    setIolAxis,
  };
}

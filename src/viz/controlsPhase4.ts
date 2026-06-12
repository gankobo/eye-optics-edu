/**
 * Phase 4 用 UI: 屈折値（球面/円柱/軸）+ 瞳径 + 視距離 + 視力値 + 視標タイプ。
 *
 * 教育意図:
 *   球面・乱視の各要素が「見え方」にどう現れるかを直接体験する。
 *   瞳径は焦点深度・回折限界の体験、視力値は判別境界の体験を担う。
 *
 * UI ノート:
 *   - スライダは input イベントで状態更新、debounce は phase4.ts 側で処理。
 *   - 視標が向き付き（ランドルト/E）のときのみ向き選択肢を有効化。
 *   - 視標が text のときのみ文字入力を有効化。
 */

export type Phase4Target = 'landolt' | 'echart' | 'point' | 'text';

export interface SimState4 {
  sphereD: number;
  cylinderD: number;
  axisDeg: number;
  pupilDiameterMM: number;
  distanceM: number;
  acuityDecimal: number;
  target: Phase4Target;
  orientationDeg: number;
  text: string;
}

export const DEFAULT_STATE4: SimState4 = {
  sphereD: 0.0,
  cylinderD: 0.0,
  axisDeg: 0,
  pupilDiameterMM: 4.0,
  distanceM: 5.0,
  acuityDecimal: 1.0,
  target: 'landolt',
  orientationDeg: 0,
  text: 'あ',
};

export interface Controls4API {
  state: SimState4;
  onChange(cb: (s: SimState4) => void): void;
  setReadout(html: string): void;
}

export function mountControlsPhase4(container: HTMLElement): Controls4API {
  const state: SimState4 = { ...DEFAULT_STATE4 };
  const listeners: Array<(s: SimState4) => void> = [];

  container.innerHTML = `
    <div class="controls">
      <h2>パラメータ</h2>

      <label class="slider">
        <span class="slabel">球面度数 <b id="r-sph">${fmtD(state.sphereD)}</b> D</span>
        <input id="s-sph" type="range" min="-10" max="6" step="0.25" value="${state.sphereD}">
        <span class="hint">正=遠視, 負=近視</span>
      </label>

      <label class="slider">
        <span class="slabel">円柱度数 <b id="r-cyl">${fmtD(state.cylinderD)}</b> D</span>
        <input id="s-cyl" type="range" min="-6" max="0" step="0.25" value="${state.cylinderD}">
        <span class="hint">乱視の強さ（負値で表記）</span>
      </label>

      <label class="slider">
        <span class="slabel">乱視軸 <b id="r-ax">${state.axisDeg}</b> °</span>
        <input id="s-ax" type="range" min="0" max="180" step="5" value="${state.axisDeg}">
      </label>

      <label class="slider">
        <span class="slabel">瞳径 <b id="r-pup">${state.pupilDiameterMM.toFixed(1)}</b> mm</span>
        <input id="s-pup" type="range" min="1" max="7" step="0.1" value="${state.pupilDiameterMM}">
      </label>

      <label class="slider">
        <span class="slabel">視距離 <b id="r-dist">${state.distanceM.toFixed(1)}</b> m</span>
        <input id="s-dist" type="range" min="0.3" max="6" step="0.1" value="${state.distanceM}">
        <span class="hint">無調節モデル: 近づくほど +1/距離 D のデフォーカス増（例 0.33m=+3D）</span>
      </label>

      <label class="slider">
        <span class="slabel">視力値 <b id="r-ac">${state.acuityDecimal.toFixed(2)}</b></span>
        <input id="s-ac" type="range" min="0.2" max="2.0" step="0.05" value="${state.acuityDecimal}">
        <span class="hint">視標角度サイズ = 5/視力値 分角。点光源モードでは効果なし。</span>
      </label>

      <fieldset class="objfield">
        <legend>視標タイプ</legend>
        <label><input type="radio" name="ttype" value="landolt" checked> ランドルト環（C字）</label>
        <label><input type="radio" name="ttype" value="echart"> E チャート</label>
        <label><input type="radio" name="ttype" value="point"> 点光源（PSF 表示）</label>
        <label><input type="radio" name="ttype" value="text"> 文字</label>
      </fieldset>

      <fieldset class="objfield" id="orientField">
        <legend>向き（ランドルト / E）</legend>
        <label><input type="radio" name="ori" value="0" checked> 右 ▷</label>
        <label><input type="radio" name="ori" value="90"> 上 △</label>
        <label><input type="radio" name="ori" value="180"> 左 ◁</label>
        <label><input type="radio" name="ori" value="270"> 下 ▽</label>
      </fieldset>

      <fieldset class="objfield" id="textField" style="display:none">
        <legend>文字</legend>
        <input id="i-text" type="text" maxlength="3" value="${state.text}" style="width:4em; font-size:1rem; padding:0.2rem 0.4rem;">
        <span class="hint">かな・数字・英字 1〜3 文字</span>
      </fieldset>

      <div class="readout" id="readout4"><em>計算中…</em></div>

      <details class="howto">
        <summary>操作ヒント</summary>
        <ul>
          <li>球面度数を ±0 から動かすと、視標がぼやけていく</li>
          <li>瞳径を絞ると焦点深度が増え、デフォーカスでもぼけが減る</li>
          <li>円柱度数と軸を動かすと方向依存のぼけ（乱視）が出る</li>
          <li>視力値スライダで視標を小さくし、どこで判別不能になるか見る</li>
          <li>視距離を縮めると無調節モデルでぼけが増える（球面度数 −3D の眼は 0.33m で最もシャープ）</li>
        </ul>
      </details>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T;

  const sSph = $<HTMLInputElement>('#s-sph');
  const sCyl = $<HTMLInputElement>('#s-cyl');
  const sAx = $<HTMLInputElement>('#s-ax');
  const sPup = $<HTMLInputElement>('#s-pup');
  const sDist = $<HTMLInputElement>('#s-dist');
  const sAc = $<HTMLInputElement>('#s-ac');
  const rSph = $<HTMLElement>('#r-sph');
  const rCyl = $<HTMLElement>('#r-cyl');
  const rAx = $<HTMLElement>('#r-ax');
  const rPup = $<HTMLElement>('#r-pup');
  const rDist = $<HTMLElement>('#r-dist');
  const rAc = $<HTMLElement>('#r-ac');
  const iText = $<HTMLInputElement>('#i-text');
  const orientField = $<HTMLElement>('#orientField');
  const textField = $<HTMLElement>('#textField');
  const readout = $<HTMLElement>('#readout4');

  const emit = () => listeners.forEach((cb) => cb({ ...state }));

  sSph.addEventListener('input', () => {
    state.sphereD = parseFloat(sSph.value);
    rSph.textContent = fmtD(state.sphereD);
    emit();
  });
  sCyl.addEventListener('input', () => {
    state.cylinderD = parseFloat(sCyl.value);
    rCyl.textContent = fmtD(state.cylinderD);
    emit();
  });
  sAx.addEventListener('input', () => {
    state.axisDeg = parseInt(sAx.value, 10);
    rAx.textContent = String(state.axisDeg);
    emit();
  });
  sPup.addEventListener('input', () => {
    state.pupilDiameterMM = parseFloat(sPup.value);
    rPup.textContent = state.pupilDiameterMM.toFixed(1);
    emit();
  });
  sDist.addEventListener('input', () => {
    state.distanceM = parseFloat(sDist.value);
    rDist.textContent = state.distanceM.toFixed(1);
    emit();
  });
  sAc.addEventListener('input', () => {
    state.acuityDecimal = parseFloat(sAc.value);
    rAc.textContent = state.acuityDecimal.toFixed(2);
    emit();
  });

  for (const r of container.querySelectorAll<HTMLInputElement>('input[name="ttype"]')) {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      state.target = r.value as Phase4Target;
      const needsOrient = state.target === 'landolt' || state.target === 'echart';
      orientField.style.display = needsOrient ? '' : 'none';
      textField.style.display = state.target === 'text' ? '' : 'none';
      emit();
    });
  }
  for (const r of container.querySelectorAll<HTMLInputElement>('input[name="ori"]')) {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      state.orientationDeg = parseInt(r.value, 10);
      emit();
    });
  }
  iText.addEventListener('input', () => {
    state.text = iText.value || 'あ';
    emit();
  });

  return {
    state,
    onChange(cb) {
      listeners.push(cb);
    },
    setReadout(html) {
      readout.innerHTML = html;
    },
  };
}

function fmtD(d: number): string {
  return (d >= 0 ? '+' : '') + d.toFixed(2);
}

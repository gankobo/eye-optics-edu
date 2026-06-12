/**
 * Phase 4 用 UI: 眼内媒質置換と無水晶体眼。
 *
 * 状態モデル:
 *   - medium: 硝子体腔の媒質（標準/ガス/シリコンオイル）
 *   - phakic: 水晶体の有無（プリセットで一括設定、UI で個別変更はしない）
 *   - objectDistanceCM, objectAtInfinity, pupilDiameterMM: Phase 1 と同様
 *
 * UI:
 *   - プリセットボタン群（4 種）のみ。媒質と水晶体有無は組合せが固定。
 *     1. 標準眼（硝子体・水晶体あり）
 *     2. ガス充填（硝子体ガス置換・水晶体あり）
 *     3. シリコンオイル（硝子体オイル置換・水晶体あり）
 *     4. 無水晶体眼（硝子体・水晶体除去後）
 *
 * 教育意図:
 *   媒質変化は水晶体後面の屈折率差の変化として現れる。臨床的に意味のある
 *   4 プリセットに絞り、文献的裏付けの弱い自由組合せ（例: 無水晶体＋オイル）は
 *   UI から除外している。
 */

import type { TamponadeMedium } from '../optics/types';

export type Phase3Preset = 'standard' | 'gas' | 'silicone-oil' | 'aphakic';

export interface SimState3 {
  medium: TamponadeMedium;
  phakic: boolean;
  objectAtInfinity: boolean;
  objectDistanceCM: number;
  pupilDiameterMM: number;
}

export const DEFAULT_STATE3: SimState3 = {
  medium: 'vitreous',
  phakic: true,
  objectAtInfinity: true,
  objectDistanceCM: 33,
  pupilDiameterMM: 4.0,
};

const PRESETS: { id: Phase3Preset; label: string; medium: TamponadeMedium; phakic: boolean; hint: string }[] = [
  { id: 'standard', label: '標準眼', medium: 'vitreous', phakic: true, hint: '正常な硝子体・水晶体あり' },
  { id: 'gas', label: 'ガス充填', medium: 'gas', phakic: true, hint: 'SF6/C3F8 など n≈1.0' },
  { id: 'silicone-oil', label: 'シリコンオイル', medium: 'silicone-oil', phakic: true, hint: 'n≈1.40' },
  { id: 'aphakic', label: '無水晶体眼', medium: 'vitreous', phakic: false, hint: '水晶体除去・IOL なし' },
];

export interface Controls3API {
  state: SimState3;
  onChange(cb: (s: SimState3) => void): void;
  setReadout(text: string): void;
}

export function mountControlsPhase3(container: HTMLElement): Controls3API {
  const state: SimState3 = { ...DEFAULT_STATE3 };
  const listeners: Array<(s: SimState3) => void> = [];

  container.innerHTML = `
    <div class="controls">
      <h2>パラメータ</h2>

      <fieldset class="objfield">
        <legend>眼の状態プリセット</legend>
        <div class="presets">
          ${PRESETS.map(
            (p) => `
            <button class="preset" data-id="${p.id}" title="${p.hint}">
              <b>${p.label}</b>
              <span>${p.hint}</span>
            </button>`,
          ).join('')}
        </div>
      </fieldset>

      <label class="slider">
        <span class="slabel">瞳径 <b id="r-pupil3">${state.pupilDiameterMM.toFixed(1)}</b> mm</span>
        <input id="s-pupil3" type="range" min="1" max="7" step="0.1" value="${state.pupilDiameterMM}">
        <span class="hint">光束の太さ（描画用）</span>
      </label>

      <fieldset class="objfield">
        <legend>物体距離</legend>
        <label><input id="c-inf3" type="checkbox" ${state.objectAtInfinity ? 'checked' : ''}> 無限遠（平行光）</label>
        <label class="slider">
          <span class="slabel">距離 <b id="r-obj3">${state.objectDistanceCM}</b> cm</span>
          <input id="s-obj3" type="range" min="10" max="200" step="1" value="${state.objectDistanceCM}" ${state.objectAtInfinity ? 'disabled' : ''}>
        </label>
      </fieldset>

      <div class="readout" id="readout3">
        <em>計算中…</em>
      </div>

      <p class="hint" style="margin-top:0.6rem;line-height:1.55;border-left:3px solid var(--accent);padding:0.3rem 0.6rem;background:rgba(0,0,0,0.04)">
        ※ 水晶体は厚さ 3.6 mm・屈折率 1.42、前面半径 +10 mm／後面半径 −6 mm の凸メニスカスとして、
        実効屈折力 ≈ <b>22 D</b>（無調節）と仮定しています。媒質置換の効果は<b>水晶体後面での屈折率差変化</b>として現れます。
      </p>

      <details class="howto">
        <summary>操作ヒント</summary>
        <ul>
          <li>標準 → ガス: 水晶体後面の屈折率差が大きく増加し、強い近視化</li>
          <li>標準 → シリコンオイル: 屈折率差が縮小し、遠視化</li>
          <li>標準 → 無水晶体眼: 水晶体（≈22 D）が消失し、強い遠視化</li>
        </ul>
      </details>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T;

  const sPupil = $<HTMLInputElement>('#s-pupil3');
  const sObj = $<HTMLInputElement>('#s-obj3');
  const cInf = $<HTMLInputElement>('#c-inf3');

  const rPupil = $<HTMLElement>('#r-pupil3');
  const rObj = $<HTMLElement>('#r-obj3');

  const presetButtons = container.querySelectorAll<HTMLButtonElement>('.preset');

  const updatePresetActive = () => {
    for (const btn of presetButtons) {
      const id = btn.dataset.id as Phase3Preset;
      const p = PRESETS.find((x) => x.id === id)!;
      const active = state.medium === p.medium && state.phakic === p.phakic;
      btn.classList.toggle('active', active);
    }
  };
  updatePresetActive();

  const emit = () => listeners.forEach((cb) => cb({ ...state }));

  for (const btn of presetButtons) {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id as Phase3Preset;
      const p = PRESETS.find((x) => x.id === id);
      if (!p) return;
      state.medium = p.medium;
      state.phakic = p.phakic;
      updatePresetActive();
      emit();
    });
  }

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

  const readout = $<HTMLElement>('#readout3');

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

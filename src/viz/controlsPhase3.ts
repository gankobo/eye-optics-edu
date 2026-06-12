/**
 * Phase 3 用 UI: 眼内媒質置換と水晶体の有無。
 *
 * 状態モデル:
 *   - medium: 硝子体腔の媒質（標準/ガス/シリコンオイル）
 *   - phakic: 水晶体の有無
 *   - objectDistanceCM, objectAtInfinity, pupilDiameterMM: Phase 1 と同様
 *
 * UI:
 *   - プリセットボタン群: 1 クリックで medium と phakic を一括設定
 *   - 水晶体トグル: phakic のみ変更（プリセットと独立に効く）
 *     例「無水晶体プリセット → トグルON」で標準眼に戻る、
 *        「シリコンオイル → トグルOFF」で無水晶体+シリコンオイル（逆転近視化）。
 *
 * 教育意図:
 *   媒質変化は水晶体後面の屈折率差の変化として現れる。水晶体除去と媒質置換の
 *   組合せで、屈折変化の向きが切り替わることを体験させる。
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
        <legend>媒質プリセット</legend>
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

      <fieldset class="objfield">
        <legend>水晶体</legend>
        <label><input id="c-phakic" type="checkbox" ${state.phakic ? 'checked' : ''}> 水晶体あり（外すと無水晶体）</label>
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

      <details class="howto">
        <summary>操作ヒント</summary>
        <ul>
          <li>標準 → ガス: 水晶体後面の屈折率差が消え、強い遠視化</li>
          <li>標準 → シリコンオイル: 屈折率差が縮小し、遠視化</li>
          <li>水晶体ありシリコンオイルの状態で水晶体を外す → 角膜が高屈折率液面を作り近視化に逆転</li>
        </ul>
      </details>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T;

  const sPupil = $<HTMLInputElement>('#s-pupil3');
  const sObj = $<HTMLInputElement>('#s-obj3');
  const cInf = $<HTMLInputElement>('#c-inf3');
  const cPhakic = $<HTMLInputElement>('#c-phakic');

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
      cPhakic.checked = state.phakic;
      updatePresetActive();
      emit();
    });
  }

  cPhakic.addEventListener('change', () => {
    state.phakic = cPhakic.checked;
    updatePresetActive();
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

/**
 * エントリポイント: フェーズ切替タブと、現在アクティブなフェーズのマウント管理。
 *   - Phase 1: 軸性近視・屈折性近視（側面ビュー）
 *   - Phase 2: 乱視・スツルムの円錐（3D 斜めビュー）
 *   - Phase 3: toric IOL シミュレーション（Phase 2 流用、IOL マーカー付）
 *   - Phase 4: 眼内媒質置換・無水晶体（側面ビュー）
 *   - Phase 5: PSF による見え方シミュレーション（網膜像 Canvas）
 *   切替時には現フェーズを dispose してから次フェーズをマウント。
 *
 *   実装メモ: 内部ファイル名（phase3.ts / phase4.ts / phaseToric.ts）は履歴の都合で
 *   ユーザー向け Phase 番号と必ずしも一致しない。UI 上の番号順は下の PHASES 配列で定義。
 */
import { mountPhase1 } from './viz/phase1';
import { mountPhase2 } from './viz/phase2';
import { mountPhase3 } from './viz/phase3';
import { mountPhase4 } from './viz/phase4';
import { mountPhaseToric } from './viz/phaseToric';
import type { PhaseHandle } from './viz/phase1';
import './style.css';

type PhaseId = 'phase1' | 'phase2' | 'toric' | 'phase3' | 'phase4';

interface PhaseDef {
  id: PhaseId;
  label: string;
  sub: string;
  mount: (viewport: HTMLElement, panel: HTMLElement) => PhaseHandle;
}

const PHASES: PhaseDef[] = [
  {
    id: 'phase1',
    label: 'Phase 1',
    sub: '近視・遠視（軸性 vs 屈折性）',
    mount: mountPhase1,
  },
  {
    id: 'phase2',
    label: 'Phase 2',
    sub: '乱視・スツルムの円錐',
    mount: mountPhase2,
  },
  {
    id: 'toric',
    label: 'Phase 3',
    sub: 'toric IOL シミュレーション',
    mount: mountPhaseToric,
  },
  {
    id: 'phase3',
    label: 'Phase 4',
    sub: '眼内媒質置換・無水晶体',
    mount: mountPhase3,
  },
  {
    id: 'phase4',
    label: 'Phase 5',
    sub: 'PSF による見え方',
    mount: mountPhase4,
  },
];

const app = document.getElementById('app')!;
app.innerHTML = `
  <header>
    <h1>眼光学シミュレーション教育教材</h1>
    <nav class="tabs" id="tabs">
      ${PHASES.map(
        (p, i) => `
        <button class="tab${i === 0 ? ' active' : ''}" data-id="${p.id}">
          <b>${p.label}</b>
          <span>${p.sub}</span>
        </button>`,
      ).join('')}
    </nav>
  </header>
  <div class="layout">
    <section class="viewport" id="viewport"></section>
    <aside class="panel" id="panel"></aside>
  </div>
`;

const viewport = document.getElementById('viewport')!;
const panel = document.getElementById('panel')!;
const tabs = document.getElementById('tabs')!;

let current: PhaseHandle | null = null;

function activate(id: PhaseId) {
  current?.dispose();
  current = null;
  const def = PHASES.find((p) => p.id === id);
  if (!def) return;
  current = def.mount(viewport, panel);
  for (const el of tabs.querySelectorAll('.tab')) {
    el.classList.toggle('active', (el as HTMLElement).dataset.id === id);
  }
}

tabs.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('.tab') as HTMLElement | null;
  if (!t) return;
  activate(t.dataset.id as PhaseId);
});

activate('phase1');

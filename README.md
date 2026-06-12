# 眼光学シミュレーション教育教材

眼科医・専門医試験受験者向けに、**眼光学系の臨床問題を解くためのフレーム**を、
3D 眼球＋光束モデルと PSF（点拡がり関数）による「見え方」シミュレーションで学ぶ教材です。

- 屈折・近視/遠視/乱視・最小錯乱円
- toric IOL による乱視矯正（IOL マーカー軸合わせ）
- 屈折要素の変化、眼内ガス／シリコンオイル置換時の屈折変化
- PSF による収差時の見え方（点光源・任意距離のランドルト環）

最終的に GitHub Pages でオンライン公開し、リンク URL から誰でも利用できます。

## セットアップ

```bash
npm install
npm run dev        # 開発サーバ
npm test           # 光学コアの物理検証テスト
npm run build      # 本番ビルド（dist/）
```

## 公開（GitHub Pages）

1. リポジトリを GitHub に push（ブランチ `main`）。
2. リポジトリ Settings → Pages → Source を **GitHub Actions** に設定。
3. `.github/workflows/deploy.yml` が `main` への push で自動ビルド・公開。
4. `vite.config.ts` の `base` をリポジトリ名に合わせる（例 `/eye-optics-edu/`）。

## 構成

```
src/optics/        描画から独立した純粋な光学計算コア（テスト対象）
  paraxial.ts      近軸光線追跡エンジン（検証済み）
  eyeModel.ts      模型眼・タンポナーデ媒質
  astigmatism.ts   スツルムの円錐・最小錯乱円
  toric.ts         toric IOL の Power Vector 合成・残余乱視
  psf.ts           PSF・見え方シミュレーション（Phase 5 で実装）
docs/optics-spec.md       光学モデルの仕様・数式・符号則（実装の根拠）
docs/phase-references.md  各 Phase の学術的根拠と出典（一次資料リスト）
ROADMAP.md                フェーズ別の実装計画
```

## 設計方針

光学計算コアを UI から完全に分離しています。これにより (1) 物理の正しさを単体テストで
担保でき、(2) 3D 表示と PSF 表示が同じ計算結果を共有でき、(3) 教材として数式とコードが
対応します。**臨床絶対値の再現ではなく「変化の向きと桁」の理解**を目的とします。

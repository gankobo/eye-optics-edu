# 各フェーズの学術的根拠・出典

本教材で扱う各フェーズについて、採用した物理モデル・数式・代表値の根拠と一次資料をまとめる。
**目的は「臨床絶対値の再現」ではなく「変化の向きと桁の理解」**。
代表値・パラメータは必要に応じて `docs/optics-spec.md` の「校正手順」で調整可能。

> 凡例: **[式] 教材で用いる数式 / [値] 数値の根拠 / [出典] 一次／教科書文献**
>
> 各 Phase の引用は、執筆時点で PubMed / CrossRef / 出版社サイトで書誌確認できた一次論文のみを採用。
> 教科書（書名・著者・版年）は実在を確認したものを採用するが、**章番号は版・刷で変動するため、
> 該当章のおおまかな主題のみを示し、版差で混乱しないよう配慮**している。

---

## 共通: 模型眼の構築

本教材の模型眼は Gullstrand–Emsley の簡略型をベースに、媒質置換と乱視を扱えるよう拡張したもの。

| 面 | 半径 [mm] | 後方媒質 | 屈折率 |
|---|---|---|---|
| 角膜 | 7.8 | 房水 | 1.336 |
| 水晶体前面 | +10.0 | 水晶体 | 1.42 |
| 水晶体後面 | −6.0 | 硝子体腔 | 1.336（媒質置換時は可変） |

距離: 前房深度 ACD = 3.6 mm、水晶体厚 = 3.6 mm、眼軸長 = 24.0 mm。

### 水晶体の実効屈折力（Phase 1・Phase 4 で前提）

厚レンズの Gullstrand 公式 **Φ = Φ₁ + Φ₂ − Φ₁·Φ₂·(t/n)** に代入:

- Φ₁（水晶体前面）= (1.42 − 1.336) / 0.010 = **+8.4 D**
- Φ₂（水晶体後面）= (1.336 − 1.42) / (−0.006) = **+14.0 D**
- t / n = 0.0036 / 1.42 = 0.00254 m
- **Φ_lens ≈ 8.4 + 14.0 − 8.4 × 14.0 × 0.00254 ≈ 22.1 D**

**この約 22 D は無調節状態（distance vision）の値**。Gullstrand No.1 模型眼の relaxed 水晶体 19.11 D、
Le Grand 完全模型眼の 21.78 D とほぼ同じオーダー。本教材では調節（毛様体筋による水晶体形状変化）
は考慮しない。

### 角膜屈折力（参考）

Φ_cornea = (1.336 − 1.0) / 0.0078 ≈ **+43.1 D**。臨床通説の「角膜屈折力 約 43 D」と一致 ✓。

### 全眼屈折力

3 屈折面の薄+厚レンズ系として近軸計算した全屈折力は約 60 D（臨床通説 58〜60 D）と一致。

### 出典

- Atchison DA, Smith G. *Optics of the Human Eye.* Butterworth-Heinemann, 2000. — 模型眼の標準教科書。
- Bennett AG, Rabbetts RB. *Bennett & Rabbetts' Clinical Visual Optics,* 4th ed. Elsevier, 2007.
- Le Grand Y, El Hage SG. *Physiological Optics.* Springer, 1980. — Le Grand 完全模型眼の出典。
- Gullstrand A. Die Dioptrik des Auges (1909). In: Helmholtz H. *Handbuch der Physiologischen Optik,* 3rd ed., vol. 1. — Gullstrand 模型眼の原典。

---

## Phase 1 — 軸性近視 vs 屈折性近視（近軸近視・遠視）

### 採用モデル

- 模型眼に **無限遠平行光 → 後側焦点距離（BFD）を求める** か、
  任意の物体距離 Lobj から **線形バージェンス法** で眼屈折を求める。
- 近軸光線追跡: **n'·u' = n·u − y·Φ**, **y_next = y + u'·d**。
- 眼屈折 = Lobj=0 と Lobj=1 D の 2 点で網膜面光線高さを評価し
  **Y(Lobj) = 0** となる Lobj を線形に解く（`ocularRefraction`）。

### 軸性 vs 屈折性の判定

ベースライン眼（24 mm / 角膜 7.8 mm）からのスライダ操作で:
- 眼軸長変化由来の屈折変化量と、角膜半径変化由来の屈折変化量を別計算
- 強い方を主成分として「軸性／屈折性／複合」を判定（実装: `phase1.ts:43-49`）

### 数値根拠

| 条件 | 計算値 | 臨床通説 | 出典 |
|---|---|---|---|
| 眼軸 24→25 mm | **−2.62 D/mm** | −2.7 D/mm（古典的経験則） | Atchison & Smith 模型眼章の解析計算 |
| 角膜 7.8→7.4 mm（半径 −0.4 mm） | 約 +3 D の近視化 | 約 1 D/0.1 mm | Bennett & Rabbetts 屈折異常章 |
| 正常眼（24 mm, 7.8 mm） | −0.74 D（ほぼ正視） | 正視 | spec で校正可 |

> ⚠️ 既定半径 7.8 mm は近似値で、厳密な正視には校正が必要。本教材は変化の向きと桁を優先。

### 主な出典

- Atchison DA, Smith G. *Optics of the Human Eye,* Butterworth-Heinemann, 2000. — 模型眼の章で近軸眼屈折・軸性/屈折性近視を詳述。
- Bennett AG, Rabbetts RB. *Bennett & Rabbetts' Clinical Visual Optics,* 4th ed. Elsevier, 2007. — 屈折異常の章で軸性／屈折性の臨床分類。
- **Stenström S.** Investigation of the variation and the correlation of the optical elements of human eyes. *Am J Optom Arch Am Acad Optom* 1948;25(5):218-32（および続編 vol.25, pp 286-99 / 340-50 / 388-97 / 438-49 / 496-504）— 軸長・屈折分布の古典疫学。実装の妥当性参照値。
- Grosvenor T. *Primary Care Optometry,* 5th ed. Butterworth-Heinemann, 2007. — 軸性／屈折性近視の臨床分類教科書。

---

## Phase 2 — 乱視・スツルムの円錐・最小錯乱円

### 採用モデル

角膜を 2 主経線の異なる曲率半径で構成し、各経線について独立に近軸光線追跡を行う。
平面状の単一面ではなく **強主経線（steep, R 小, 屈折力大）** と
**弱主経線（flat, R 大, 屈折力小）** が直交する **toric 面**。

### スツルムの円錐の構造

- **前焦線（anterior focal line）**: 強主経線で集光、弱主経線方向に伸びる線分。
- **後焦線（posterior focal line）**: 弱主経線で集光、強主経線方向に伸びる線分。
- **最小錯乱円（circle of least confusion, CLC）**: 2 焦線の間で錯乱形が円になる位置。
- **[式] バージェンス（D）空間での中点**: 
  **1/z_clc = (1/z_前 + 1/z_後) / 2**
  これは実空間の算術中点ではなく、**屈折力（バージェンス）空間の算術中点**である点が要。

### 等価球面と円柱量

- 強主経線屈折 S_steep, 弱主経線屈折 S_flat とする。
- **等価球面 SE = (S_steep + S_flat) / 2 = S + C/2**（S は球面、C は円柱）
- **円柱量 C = S_steep − S_flat**
- 等価球面屈折に近視/遠視/正視を分類する慣行に整合。

### 数値根拠

| 条件 | 期待挙動 | 出典 |
|---|---|---|
| 強・弱半径を等しく | 2 焦線が一致 → 円柱 0 | 教科書的事実 |
| 半径差 0.4 mm | 円柱約 2.5 D | Bennett & Rabbetts 乱視章 |
| 軸角度回転 | 2 焦線が同期して回転 | パワークロス慣行 |

### 主な出典

- Bennett AG, Rabbetts RB. *Bennett & Rabbetts' Clinical Visual Optics,* 4th ed. Elsevier, 2007. — 乱視の章でスツルムの円錐・パワークロスを詳述。
- Borish IM, Benjamin WJ. *Borish's Clinical Refraction,* 2nd ed. Butterworth-Heinemann, 2006. — 乱視屈折検査の標準教科書。
- Keating MP. *Geometric, Physical, and Visual Optics,* 2nd ed. Butterworth-Heinemann, 2002. — スツルムの円錐の幾何説明。
- American Academy of Ophthalmology. *Basic and Clinical Science Course (BCSC) Section 3: Clinical Optics.* — スツルム円錐・等価球面の臨床向け概説。

---

## Phase 3 — toric IOL による乱視矯正

### 採用モデル: Power Vector（Thibos）法

任意の球面円柱屈折 **{S, C, axis α}** を 3 成分のベクトルに変換:

- **[式]** 
  - **M  = S + C/2**（等価球面）
  - **J₀ = −(C/2)·cos(2α)**（at-axis / against-axis 円柱）
  - **J₄₅ = −(C/2)·sin(2α)**（斜め円柱）

これにより乱視は **{M, J₀, J₄₅}** のベクトルとして合成可能。
角膜と toric IOL の乱視ベクトルを足し合わせ、残余の **{M, J₀, J₄₅}** を逆変換して
{S, C, axis} に戻す（実装: `src/optics/toric.ts`）。

### 軸合わせ感度の臨床的意味

Felipe 2011（下記出典）の本文では「**±10°（合計 20°）の回転で残余円柱が IOL 円柱量の約 1/3**」と
報告されている。これを線形近似して教材本文では「**1° の軸ずれで cylinder cancellation が約 3.3 % 失われる**」
（10° で 33 % ≈ 1/3）と表現している。これは小角近似での目安であり、大きな角度では
**Residual = 2 · C · sin(Δθ)** の幾何で増加する。

### 描画上の工夫（実臨床と整合）

- 実臨床の toric IOL の刻印マーカーは **IOL の弱主経線（円柱量が最小の軸）** を示す。
  外科医はそのマーカーを **角膜の強主経線**（最も屈折する経線）に合わせて挿入する。
  → IOL の強主経線が角膜の弱主経線と重なり、乱視が打ち消される。
- 本教材は橙の中央点線を「IOL マーカー」として描き、角膜の赤タブ（強主経線方向）と重ねる
  操作を体験させる。

### 数値根拠

| 条件 | 期待 | 出典 |
|---|---|---|
| IOL 軸 = 角膜軸 + 90° | 残余円柱 ≈ 0 | Holladay 1992 / Alpins 1993 のベクトル代数 |
| ±10° 軸ずれ | 残余円柱 ≈ C × 1/3 | Felipe 2011（原文表現） |
| IOL 円柱が 0 | 角膜乱視がそのまま残る | 自明 |

### 主な出典（書誌は PubMed/CrossRef で確認済み）

- **Thibos LN, Wheeler W, Horner D.** Power vectors: an application of Fourier analysis to the description and statistical analysis of refractive error. *Optom Vis Sci* 1997;74(6):367-75. PMID 9255814. — Power Vector 法の原典。
- **Holladay JT, Cravy TV, Koch DD.** Calculating the surgically induced refractive change following ocular surgery. *J Cataract Refract Surg* 1992;18(5):429-43. PMID 1403745. — 球面・円柱変化のベクトル計算。
- **Alpins NA.** A new method of analyzing vectors for changes in astigmatism. *J Cataract Refract Surg* 1993;19(4):524-33. PMID 8355160. — Alpins ベクトル解析の原典。
- **Felipe A, Artigas JM, Díez-Ajenjo A, García-Domene C, Alcocer P.** Residual astigmatism produced by toric intraocular lens rotation. *J Cataract Refract Surg* 2011;37(10):1895-901. PMID 22440449. — 軸回転と残余乱視の定量。
- **Koch DD, Wang L.** Surgically induced astigmatism (editorial). *J Refract Surg* 2015;31(8):565. — SIA 計算方法に関する editorial。
- ESCRS *Guidelines for Cataract Surgery,* toric IOL alignment 節（実臨床手順の参照）。

---

## Phase 4 — 眼内媒質置換（ガス／シリコンオイル／無水晶体）

### 採用モデル

模型眼の硝子体腔屈折率 **nVit** を可変パラメータとし、**水晶体後面の屈折率差**
（n_lens − nVit）の変化として効果を表現する。

- 水晶体後面屈折力 **Φ_post = (nVit − n_lens) / R_post** （R_post < 0）

| 媒質 | n | Φ_post の変化 | 屈折変化 |
|---|---|---|---|
| 硝子体（基準） | 1.336 | 基準 | 0 |
| シリコンオイル | 1.40 | 低下（差が縮小） | **遠視化** |
| ガス（SF6/C3F8 等） | ≈ 1.0 | 増加で符号反転 | **近視化（強い）** |
| 無水晶体＋オイル | — | 水晶体面消失、角膜が高屈折率液面接触 | **近視化に逆転** |

### 数値根拠

| 条件 | 教材の計算値 | 文献の臨床値 | 出典 |
|---|---|---|---|
| シリコンオイル充填（有水晶体・模型眼計算） | **+7.91 D 遠視化** | — | 本教材の模型眼への代数解 |
| シリコンオイル充填（pseudophakic, 臨床） | — | 平均 **+5.69 D**（範囲 +2.88〜+8.38, SD ±1.71） | Hotta et al. 2005 |
| シリコンオイル充填（phakic / aphakic, 臨床） | — | phakic は遠視化、aphakic は逆に近視化 | Smith RC et al. 1990 |
| ガス完全充填 | 強い近視化 | 完全充填中は視機能ほぼ消失（臨床所見） | 一般臨床 |
| 無水晶体＋オイル | 近視化に逆転 | 瞳孔径依存 | Smith RC et al. 1990 |

> ⚠️ **教材の +7.91 D は本コードによる模型眼の代数解**で、文献値（pseudophakic 臨床 +5.69 D 等）とは
> 直接の比較対象ではない。臨床の絶対値は IOL 形状・水晶体状態・瞳孔径・術後体位に依存する。
>
> ⚠️ 当初版で「ガスで遠視化」と記したが物理・文献検証で誤りと判明、**正しくは近視化**（オイルと逆）。
> PPV 後の小さな近視化（−0.5〜−1.6 D）は媒質効果ではなく **IOL 位置変化**によるもので、
> 媒質屈折率効果（本シミュレーション）とは別系統。

### 数式

- Φ_post 単独の変化量: ΔΦ_post = ((nVit_new − nVit_old)) / R_post
- 例: nVit 1.336→1.40, R_post = −6 mm → ΔΦ = 0.064 / (−0.006) ≈ −10.7 D（後面屈折力が低下）
  → 全屈折力が下がり遠視化。

### 主な出典（書誌は PubMed/CrossRef で確認済み）

- **Smith RC, Smith GT, Wong D.** Refractive changes in silicone filled eyes. *Eye* 1990;4(Pt 1):230-4. PMID 2323475. — phakic/aphakic 別の屈折変化方向を臨床的に示した古典。
- **Hotta K, Hotta J, Arisawa T, Ono Y.** Refractive changes in silicone oil-filled pseudophakic eyes. *Retina* 2005;25(2):167-70. — pseudophakic で平均 +5.69 D 遠視化シフトを定量。
- **Stefansson E.** Physiology of vitreous surgery. *Graefes Arch Clin Exp Ophthalmol* 2009;247(2):147-63. PMID 19034481. — 硝子体手術の生理と媒質効果の総説。
- Atchison DA, Smith G. *Optics of the Human Eye,* Butterworth-Heinemann, 2000. — 無水晶体眼の光学（aphakia の章）。
- 模型眼計算: Gullstrand 模型眼に nVit 置換を適用した代数解（本教材 `src/optics/eyeModel.ts`）。

---

## Phase 5 — PSF による見え方シミュレーション

### 採用モデル

フーリエ光学に基づく **瞳孔関数 → PSF（点像分布関数）→ 視標との畳み込み** で網膜像を計算。

- **[式] 瞳孔関数** *P(x,y) = A(x,y) · exp(i·2π/λ · W(x,y))*
  - *A*: 開口（瞳径 D で D/2 以内は 1、外は 0）
  - *W*: 波面収差 [m]
- **[式] PSF**: *PSF(x,y) = |FT{P(x,y)}|²*
- **[式] 網膜像**: *I(x,y) = O(x,y) ⊛ PSF(x,y)*（O は物体強度分布）

### 波面 W のパラメータ化

Zernike 多項式（OSA/ANSI 規格、Thibos 2002）を採用:

- **デフォーカス**: *W_def(r) ≈ (D · r²) / 2*（D = デフォーカス量 [D]、r = 瞳座標 [m]）
- **2次乱視**: 同様に Zernike c₂⁻², c₂² を J₀/J₄₅ から換算。
- 高次収差（コマ・球面収差等）は Phase 6 以降の課題（roadmap）。

### 屈折値 → Zernike 係数 の換算

OSA 正規化の厳密係数を用いる:

- **c₂⁰（defocus）= −(D · R_p²) / (4√3)**（R_p = 瞳半径 [m]、D = 屈折値 [D]）
- **c₂² (J₀)、c₂⁻² (J₄₅)** は Power Vector の J 成分から同様に換算（係数 √6/2 等）。

→ 詳細式は `src/optics/psf.ts` 内に検証コメント付き。

### 視標と視角

- ランドルト環: 視力 **1.0** で **ギャップ 1 分角 / 環全体 5 分角**（国際標準 ISO 8596）。
- 視距離 d、サイズ s の物体は視角 *θ = 2·atan(s/2/d)* で算出。
- 視力 0.1 ⇔ 5 分角 × 10 = 50 分角サイズ等の変換。

### 視距離と等価球面の関係（無調節モデル）

無調節を仮定: **実効デフォーカス D_eff = S + 1/d**（S は球面屈折値、d は視距離 m）
- 例: 近視 −3 D、視距離 1/3 m（33 cm）→ D_eff ≈ 0 D（明視）。
- これにより視距離スライダがビジュアルに反映される。

### 検証

- デフォーカス 0 で **回折限界 = Airy パターン**（中心強度、第一暗環半径 1.22·λ·f/D）。
- デフォーカス増 → ランドルト環の切れ目が判別不能になる挙動を確認。

### 主な出典（書誌は PubMed/CrossRef で確認済み）

- **Thibos LN, Applegate RA, Schwiegerling JT, Webb R; VSIA Standards Taskforce.** Standards for reporting the optical aberrations of eyes. *J Refract Surg* 2002;18(5):S652-60. PMID 12361175. — OSA Zernike 規格の原典。
- **Charman WN.** Wavefront aberration of the eye: a review. *Optom Vis Sci* 1991;68(8):574-83. PMID 1923333. — 眼の波面収差の古典レビュー。
- **Salmon TO, van de Pol C.** Normal-eye Zernike coefficients and root-mean-square wavefront errors. *J Cataract Refract Surg* 2006;32(12):2064-74. PMID 17137985. — 健常 2560 眼の Zernike 代表値。
- Goodman JW. *Introduction to Fourier Optics,* 3rd ed. Roberts & Co., 2005. — フーリエ光学の標準教科書（瞳孔関数→PSF）。
- Born M, Wolf E. *Principles of Optics,* 7th ed. Cambridge Univ. Press, 1999. — Airy パターン・回折限界。
- ISO 8596:2017 *Ophthalmic optics — Visual acuity testing — Standard and clinical optotypes.* — ランドルト環の国際規格。
- ANSI Z80.28-2017 *Methods for Reporting Optical Aberrations of Eyes.* — Thibos 2002 をベースに ANSI 規格化した米国規格（初版 2004）。

---

## 全体に関する免責

本教材で用いる数値モデルは、教科書的な代表値を採用しており **実臨床で個別症例の絶対値を予測するものではない**。
教材の目的は学習者が「どのパラメータをどう動かすと、どちらにどの程度ずれるか」を体験的に把握することにある。

- 実臨床応用には個人の生体測定値（IOL Master 等）と各社の度数計算式（Barrett, Hill-RBF, Olsen 等）が必要。
- toric IOL の axis precision、媒質置換時の屈折シフトの絶対値は **症例ごとに異なる**。
- 本教材の数値は「方向と桁」を学ぶための簡略化モデルである点を明示する。

### 全体参考文献

- Atchison DA, Smith G. *Optics of the Human Eye.* Butterworth-Heinemann, 2000.
- Bennett AG, Rabbetts RB. *Bennett & Rabbetts' Clinical Visual Optics,* 4th ed. Elsevier, 2007.
- Borish IM, Benjamin WJ. *Borish's Clinical Refraction,* 2nd ed. Butterworth-Heinemann, 2006.
- American Academy of Ophthalmology. *Basic and Clinical Science Course (BCSC) Section 3: Clinical Optics.* 2024-2025.

### 文献検証のメモ

- 本ドキュメントの一次論文はすべて 2026-06 時点で PubMed / CrossRef / 出版社サイトのいずれかで
  書誌（著者・タイトル・年・巻・号・ページ）が確認済み。
- 教科書の章番号は版差で動くため明示せず、章主題で示す方針とする。
- 過去版に記載していた以下の引用は、書誌が確認できなかったため削除した:
  - Hirsch MJ. (Phase 1 で軸長と屈折の関係として引用していたもの) — タイトル・ジャーナル名が不一致
  - Smiddy WE, Hernandez E. 1991 (Phase 4 でシリコンオイル屈折変化として引用していたもの) — PubMed 不検出。
    同テーマの確認済み一次論文 **Smith RC et al. 1990 / Hotta et al. 2005** に差し替え
  - Patel JI et al. 2009 *Eye* (Phase 4) — 検出不能のため削除
  - Tognetto D et al. 2005 *Eur J Ophthalmol* (Phase 4) — 検出不能のため削除
  - Bennett AG. 1980 *Br J Physiol Opt* 34:36-44 (Phase 2) — 検出不能のため削除（Bennett の乱視統計関連は Bennett & Rabbetts 教科書で十分カバー）

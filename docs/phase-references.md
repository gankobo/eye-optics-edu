# 各フェーズの学術的根拠・出典

本教材で扱う各フェーズについて、採用した物理モデル・数式・代表値の根拠と一次資料をまとめる。
**目的は「臨床絶対値の再現」ではなく「変化の向きと桁の理解」**。
代表値・パラメータは必要に応じて `docs/optics-spec.md` の「校正手順」で調整可能。

> 凡例: **[式] 教材で用いる数式 / [値] 数値の根拠 / [出典] 一次／教科書文献**。

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
- Gullstrand A. *Hilfsbuch zur Lehre vom Bau und der Funktion des Auges* (1909). — Gullstrand 模型眼の原典。
- Le Grand Y, El Hage SG. *Physiological Optics.* Springer, 1980.

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
| 眼軸 24→25 mm | **−2.62 D/mm** | −2.7 D/mm | Atchison & Smith Ch.6 |
| 角膜 7.8→7.4 mm（半径 −0.4 mm） | 約 +3 D の近視化 | 約 1 D/0.1 mm | Bennett & Rabbetts Ch.12 |
| 正常眼（24 mm, 7.8 mm） | −0.74 D（ほぼ正視） | 正視 | spec 校正可 |

> ⚠️ 既定半径 7.8 mm は近似値で、厳密な正視には校正が必要。本教材は変化の向きと桁を優先。

### 主な出典

- Atchison DA, Smith G. *Optics of the Human Eye,* Ch.6 "Schematic Eyes."
- Hirsch MJ. The relation between refraction and axial length. *Am J Optom Physiol Opt* 1958;35:8-11.
- Stenström S. Investigation of the variation and the correlation of the optical elements of human eyes. *Am J Optom Arch Am Acad Optom* 1948;25:218-32.
- Grosvenor T. *Primary Care Optometry,* 5th ed. — 軸性／屈折性近視の臨床分類。

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
| 半径差 0.4 mm | 円柱約 2.5 D | Bennett & Rabbetts Ch.13 |
| 軸角度回転 | 2 焦線が同期して回転 | パワークロス慣行 |

### 主な出典

- Bennett AG, Rabbetts RB. *Clinical Visual Optics,* Ch.13 "Astigmatism."
- Borish IM, Benjamin WJ. *Borish's Clinical Refraction,* 2nd ed. Butterworth-Heinemann, 2006. — 乱視屈折検査の標準教科書。
- Keating MP. *Geometric, Physical, and Visual Optics,* 2nd ed. Butterworth-Heinemann, 2002. — スツルムの円錐の幾何説明。
- Bennett AG. A new approach to the statistical analysis of ocular astigmatism. *Br J Physiol Opt* 1980;34:36-44.

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

- 1° の軸ずれで cylinder cancellation が約 **3.3 % 失われる**（経験則）。
- 全てを失う（残余円柱量 = もとの円柱量）のは **30° ずれた時**。
- これは式 **Residual = C_IOL · 2·sin(Δθ)** の二倍化スケールから出る。

### 描画上の工夫（実臨床と整合）

- 実臨床の toric IOL の刻印マーカーは **IOL の弱主経線（円柱量が最小の軸）** を示す。
  外科医はそのマーカーを **角膜の強主経線**（最も屈折する経線）に合わせて挿入する。
  → IOL の強主経線が角膜の弱主経線と重なり、乱視が打ち消される。
- 本教材は橙の中央点線を「IOL マーカー」として描き、角膜の赤タブ（強主経線方向）と重ねる
  操作を体験させる。

### 数値根拠

| 条件 | 期待 | 出典 |
|---|---|---|
| IOL 軸 = 角膜軸 + 90° | 残余円柱 ≈ 0 | Holladay/Alpins 計算 |
| 1° 軸ずれ | 残余円柱 ≈ C × 0.035 | Felipe 1986 |
| IOL 円柱が 0 | 角膜乱視がそのまま残る | 自明 |

### 主な出典

- **Thibos LN, Wheeler W, Horner D.** Power vectors: an application of Fourier analysis to the description and statistical analysis of refractive error. *Optom Vis Sci* 1997;74(6):367-75. — Power Vector 法の原典。
- **Holladay JT, Cravy TV, Koch DD.** Calculating the surgically induced refractive change following ocular surgery. *J Cataract Refract Surg* 1992;18(5):429-43.
- **Alpins NA.** A new method of analyzing vectors for changes in astigmatism. *J Cataract Refract Surg* 1993;19(4):524-33.
- **Felipe A et al.** Residual astigmatism produced by toric intraocular lens rotation. *J Cataract Refract Surg* 2011;37(10):1895-901. — 1° = 3.3% loss の根拠。
- Koch DD, Wang L. Surgically induced astigmatism. *J Refract Surg* 2015;31:565.
- ESCRS *Guidelines for Cataract Surgery,* sec. on toric IOL alignment.

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

| 条件 | 計算値 | 文献値 | 出典 |
|---|---|---|---|
| シリコンオイル充填（有水晶体） | **+7.91 D 遠視化** | ≈ +8 D（Gullstrand 模型眼計算） | Smiddy 1991 |
| シリコンオイル充填（実臨床、有水晶体） | — | +2〜+6 D | Smiddy 1991 |
| ガス完全充填 | 強い近視化 | 完全充填中は視機能ほぼ消失 | 一般臨床 |
| 無水晶体＋オイル | 近視化に逆転 | 瞳孔径依存（−5〜−10 D 程度） | Tognetto 2005 |

> ⚠️ 当初版で「ガスで遠視化」と記したが物理・文献検証で誤りと判明、**正しくは近視化**（オイルと逆）。
> PPV 後の小さな近視化（−0.5〜−1.6 D）は媒質効果ではなく **IOL 位置変化**によるもので、
> 媒質屈折率効果（本シミュレーション）とは別系統。

### 数式

- Φ_post 単独の変化量: ΔΦ_post = ((nVit_new − nVit_old)) / R_post
- 例: nVit 1.336→1.40, R_post = −6 mm → ΔΦ = 0.064 / (−0.006) ≈ −10.7 D（後面屈折力が低下）
  → 全屈折力が下がり遠視化。

### 主な出典

- **Smiddy WE, Hernandez E.** Refractive changes after silicone oil tamponade. *Ophthalmology* 1991;98(8):1185-89.
- **Tognetto D, et al.** Refractive changes after vitrectomy with silicone oil. *Eur J Ophthalmol* 2005;15(1):95-99.
- **Patel JI, et al.** Silicone oil-induced refractive changes. *Eye* 2009;23(11):2095-9.
- **Stefansson E.** Physiology of vitreous surgery. *Graefes Arch Clin Exp Ophthalmol* 2009;247(2):147-63.
- Atchison & Smith Ch.16 — Aphakia の光学。
- 模型眼計算: Gullstrand No.1 schematic eye に nVit 置換を適用した代数解。

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

### 主な出典

- **Goodman JW.** *Introduction to Fourier Optics,* 3rd ed. Roberts & Co., 2005. — フーリエ光学の標準教科書。
- **Thibos LN, Applegate RA, Schwiegerling JT, Webb R; VSIA Standards Taskforce.** Standards for reporting the optical aberrations of eyes. *J Refract Surg* 2002;18(5):S652-60. — OSA Zernike 規格の原典。
- **Born M, Wolf E.** *Principles of Optics,* 7th ed. Cambridge Univ. Press, 1999. — Airy パターン・回折限界。
- **Charman WN.** Wavefront aberration of the eye: a review. *Optom Vis Sci* 1991;68(8):574-83.
- **Salmon TO, van de Pol C.** Normal-eye Zernike coefficients and root-mean-square wavefront errors. *J Cataract Refract Surg* 2006;32(12):2064-74. — 健常眼の Zernike 係数代表値。
- ISO 8596:2017 *Ophthalmic optics — Visual acuity testing — Standard and clinical optotypes.*
- ANSI Z80.28-2017 *Methods for Reporting Optical Aberrations of Eyes.*

---

## 全体に関する免責

本教材で用いる数値モデルは、教科書的な代表値を採用しており **実臨床で個別症例の絶対値を予測するものではない**。
教材の目的は学習者が「どのパラメータをどう動かすと、どちらにどの程度ずれるか」を体験的に把握することにある。

- 実臨床応用には個人の生体測定値（IOL Master 等）と各社の度数計算式（Barrett, Hill-RBF, Olsen 等）が必要。
- toric IOL の axis precision、媒質置換時の屈折シフトの絶対値は **症例ごとに異なる**。
- 本教材の数値は「方向と桁」を学ぶための簡略化モデルである点を明示する。

### 全体参考文献

- Atchison DA, Smith G. *Optics of the Human Eye.* Butterworth-Heinemann, 2000.
- Bennett AG, Rabbetts RB. *Clinical Visual Optics,* 4th ed. Elsevier, 2007.
- Borish IM, Benjamin WJ. *Borish's Clinical Refraction,* 2nd ed. 2006.
- American Academy of Ophthalmology. *Basic and Clinical Science Course (BCSC) Section 3: Clinical Optics.* 2024-2025.
- Kessler J. *Clinical Optics,* 4th ed. American Academy of Ophthalmology.

/**
 * toric.ts の数値検証。
 *
 * 検証項目:
 *  1) power vector の往復変換（SCA → PV → SCA）が一致する
 *  2) 角膜と同じ強さの IOL を直交軸で入れると残余乱視がほぼ 0
 *  3) IOL を 0 D にすると残余 = 角膜乱視
 *  4) 軸を 90° からずらすと残余乱視が増える単調性
 */

import { describe, expect, it } from 'vitest';
import {
  computeToric,
  cornealRadiusFromRefractionMM,
  powerVectorFromSCA,
  scaFromPowerVector,
  addPowerVectors,
} from '../toric';
import { makeEye } from '../eyeModel';
import { ocularRefraction } from '../paraxial';

describe('power vector 変換', () => {
  it('SCA → PV → SCA で往復一致する', () => {
    const M = 0.5;
    const C = -2.0;
    const axisDeg = 75;
    const pv = powerVectorFromSCA(M - C / 2, C, axisDeg);
    const back = scaFromPowerVector(pv);
    expect(back.M).toBeCloseTo(M, 6);
    expect(back.C).toBeCloseTo(C, 6);
    expect((back.axisRad * 180) / Math.PI).toBeCloseTo(axisDeg, 4);
  });

  it('cyl = 0 のとき軸の値に依らず PV の乱視成分が 0', () => {
    const pv = powerVectorFromSCA(1.0, 0, 30);
    expect(pv.J0).toBeCloseTo(0, 8);
    expect(pv.J45).toBeCloseTo(0, 8);
    expect(pv.M).toBeCloseTo(1.0, 8);
  });

  it('addPowerVectors は単純加算', () => {
    const a = powerVectorFromSCA(0, -1.0, 0);
    const b = powerVectorFromSCA(0, -1.0, 90);
    const sum = addPowerVectors(a, b);
    // 0° と 90° の純粋円柱を足すと残余円柱 = 0、球面 = -1.0
    const sca = scaFromPowerVector(sum);
    expect(Math.abs(sca.C)).toBeLessThan(1e-6);
    expect(sum.M).toBeCloseTo(-1.0, 6);
  });
});

describe('cornealRadiusFromRefractionMM: 屈折値 → 角膜半径の逆算', () => {
  it('既知の角膜半径から往復で同じ半径に戻る', () => {
    const axial = 24.0;
    for (const r of [7.0, 7.4, 7.7, 8.0, 8.5]) {
      const ref = ocularRefraction(makeEye({ axialLengthMM: axial, cornealRadiusMM: r }));
      const back = cornealRadiusFromRefractionMM(ref, axial);
      expect(back).toBeCloseTo(r, 3);
    }
  });

  it('屈折値が大きいほど半径も大きい（単調性）', () => {
    const axial = 24.0;
    const refs = [-4, -2, 0, +2, +4];
    const radii = refs.map((t) => cornealRadiusFromRefractionMM(t, axial));
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    }
  });
});

describe('computeToric: 効果的な仮想角膜半径ペア（IOL 球面分は常に最適選定の前提）', () => {
  it('IOL 円柱 = 0 D のとき残余等価球面 ≈ 0（IOL 球面分が角膜 M を打ち消す）', () => {
    const r = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: 0,
      iolAxisDeg: 0,
      axialLengthMM: 24.0,
    });
    expect(Math.abs(r.residualSCA.M)).toBeLessThan(1e-6);
    // 残余円柱は角膜乱視そのもの
    expect(Math.abs(r.residualSCA.C - r.corneaCylinderD)).toBeLessThan(1e-6);
    // 強・弱経線屈折は ±C/2 で対称に網膜を挟む
    expect(r.steepRefractionD).toBeCloseTo(r.corneaCylinderD / 2, 6);
    expect(r.flatRefractionD).toBeCloseTo(-r.corneaCylinderD / 2, 6);
  });

  it('IOL を角膜と直交軸で完全矯正すると effective 半径ペアがほぼ一致（正視点像）', () => {
    const probe = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: 0,
      iolAxisDeg: 0,
      axialLengthMM: 24.0,
    });
    const r = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: probe.corneaCylinderD,
      iolAxisDeg: 0,
      axialLengthMM: 24.0,
    });
    expect(Math.abs(r.effectiveSteepRadiusMM - r.effectiveFlatRadiusMM)).toBeLessThan(0.05);
    // 完全矯正なので残余球面・残余円柱とも ≈ 0
    expect(Math.abs(r.residualSCA.M)).toBeLessThan(1e-6);
    expect(Math.abs(r.residualSCA.C)).toBeLessThan(0.05);
  });
});

describe('computeToric: 角膜乱視と IOL の合成', () => {
  it('IOL = 0 D のとき残余 ≈ 角膜乱視', () => {
    const r = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: 0,
      iolAxisDeg: 0,
      axialLengthMM: 24.0,
    });
    expect(Math.abs(r.residualSCA.C - r.corneaCylinderD)).toBeLessThan(1e-6);
  });

  it('IOL を角膜と同強度・直交軸で入れると残余 ≈ 0', () => {
    // まず角膜単独の cylinder を測る
    const probe = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: 0,
      iolAxisDeg: 0,
      axialLengthMM: 24.0,
    });
    const corneaCyl = probe.corneaCylinderD; // 負値
    // 同じ強度・直交軸（角膜軸 + 90°）で IOL を入れる
    const r = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: corneaCyl,
      iolAxisDeg: 0, // = 90 + 90 mod 180
      axialLengthMM: 24.0,
    });
    expect(Math.abs(r.residualSCA.C)).toBeLessThan(0.05);
  });

  it('IOL 軸を 90° から 30° ずらすと残余が増える', () => {
    const probe = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: 0,
      iolAxisDeg: 0,
      axialLengthMM: 24.0,
    });
    const corneaCyl = probe.corneaCylinderD;
    const aligned = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: corneaCyl,
      iolAxisDeg: 0,
      axialLengthMM: 24.0,
    });
    const offset = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: corneaCyl,
      iolAxisDeg: 30,
      axialLengthMM: 24.0,
    });
    expect(Math.abs(offset.residualSCA.C)).toBeGreaterThan(
      Math.abs(aligned.residualSCA.C),
    );
  });

  it('等価球面は IOL 軸の回転で変わらない', () => {
    const a = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: -2.0,
      iolAxisDeg: 0,
      axialLengthMM: 24.0,
    });
    const b = computeToric({
      corneaSteepRadiusMM: 7.4,
      corneaFlatRadiusMM: 8.0,
      corneaAxisDeg: 90,
      iolCylinderD: -2.0,
      iolAxisDeg: 45,
      axialLengthMM: 24.0,
    });
    // M = S + C/2 で、S 部分は IOL 球面成分を「IOL cyl の半分」と置いてあるので
    // 角膜の M と IOL の M（= 0）の和に等しく、軸に依存しない。
    expect(a.residualSCA.M).toBeCloseTo(b.residualSCA.M, 6);
  });
});

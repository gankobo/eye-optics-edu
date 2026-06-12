import { describe, it, expect } from 'vitest';
import { makeEye, makeEyeWithMedium, N } from '../eyeModel';
import { ocularRefraction, backFocalDistanceFromCornea } from '../paraxial';

/**
 * これらのテストは「物理の正しさ」を担保する教育教材の生命線。
 * 数値の絶対一致ではなく、向きと桁が臨床的常識に合うことを確認する。
 * プリセット半径は近似値なので許容幅は広めに取り、校正の指針とする。
 */

describe('正常模型眼', () => {
  it('正視に近い（|屈折| < 1.5D 程度）', () => {
    const eye = makeEye();
    const refr = ocularRefraction(eye);
    expect(Math.abs(refr)).toBeLessThan(1.5); // 校正後はさらに 0 に近づける
  });

  it('後側焦点が網膜近傍（角膜頂点から 22–25mm）', () => {
    const bfd = backFocalDistanceFromCornea(makeEye()) * 1000;
    expect(bfd).toBeGreaterThan(21);
    expect(bfd).toBeLessThan(26);
  });
});

describe('軸性近視', () => {
  it('眼軸 1mm 延長で約 −2.5〜−2.8 D/mm の近視化', () => {
    const base = ocularRefraction(makeEye({ axialLengthMM: 24 }));
    const longer = ocularRefraction(makeEye({ axialLengthMM: 25 }));
    const ratePerMM = longer - base;
    expect(ratePerMM).toBeLessThan(-2.4);
    expect(ratePerMM).toBeGreaterThan(-2.9);
  });
});

describe('タンポナーデ媒質の屈折シフト（有水晶体）', () => {
  const base = ocularRefraction(makeEyeWithMedium('vitreous'));

  it('シリコンオイル(n=1.40)で遠視化（正方向シフト）', () => {
    const oil = ocularRefraction(makeEyeWithMedium('silicone-oil'));
    expect(oil - base).toBeGreaterThan(3); // Gullstrand 模型眼で約 +8D
  });

  it('ガス(n=1.0)で近視化（負方向シフト）', () => {
    const gas = ocularRefraction(makeEyeWithMedium('gas'));
    expect(gas - base).toBeLessThan(0); // 完全充填中は視機能ほぼ消失するほど強い近視化
  });

  it('媒質屈折率の定義が想定通り', () => {
    expect(N.siliconeOil).toBeGreaterThan(N.vitreous);
    expect(N.gas).toBeLessThan(N.vitreous);
  });
});

import { describe, expect, it } from 'vitest';
import type { PptEditableTextBlock } from '@/types/models/pptMaker.model';
import {
  MIN_PPT_TEXT_FONT_SIZE,
  fitEditableTextBlocks,
  getEditableTextLayoutIssues,
} from '@/utils/pptTextLayout';

const detailedProofBlock: PptEditableTextBlock = {
  id: 'label-1',
  role: 'label',
  text: '검증 가능한 근거\n핵심 주장을 출처와 책임자, 다음 실행 단계까지 연결해 의사결정에 활용합니다.',
  x: 0.86,
  y: 2.42,
  w: 2.39,
  h: 0.48,
  fontSize: 8.5,
  bold: true,
};

describe('pptTextLayout', () => {
  it('fits detailed Korean and English copy without dropping below the readable font threshold', () => {
    const fitted = fitEditableTextBlocks([
      detailedProofBlock,
      {
        ...detailedProofBlock,
        id: 'label-2',
        text: 'Evidence-led action\nConnect the claim to verified sources, accountable owners, and the next operating decision.',
      },
    ]);

    expect(fitted.every((block) => block.fontSize >= MIN_PPT_TEXT_FONT_SIZE)).toBe(true);
    expect(getEditableTextLayoutIssues(fitted)).toEqual([]);
  });

  it('reports corrupted characters and copy that cannot fit even at the minimum font size', () => {
    const issues = getEditableTextLayoutIssues([
      { ...detailedProofBlock, id: 'corrupted', text: 'Invalid\uFFFDcopy' },
      { ...detailedProofBlock, id: 'overflow', text: 'A'.repeat(1_000), h: 0.12 },
    ]);

    expect(issues).toContain('Text block "corrupted" contains unsupported or corrupted characters.');
    expect(issues).toContain('Text block "overflow" does not fit within its editable PowerPoint bounds.');
  });
});

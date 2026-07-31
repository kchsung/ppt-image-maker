import type { PptEditableTextBlock } from '@/types/models/pptMaker.model';

export const MIN_PPT_TEXT_FONT_SIZE = 7;

export function fitEditableTextBlocks(blocks: PptEditableTextBlock[]): PptEditableTextBlock[] {
  return blocks.map((block) => ({
    ...block,
    fontSize: findFittingFontSize(block),
  }));
}

export function getEditableTextLayoutIssues(blocks: PptEditableTextBlock[]): string[] {
  const issues: string[] = [];

  blocks.forEach((block) => {
    if (!block.text.trim()) return;
    if (containsBrokenText(block.text)) {
      issues.push(`Text block "${block.id}" contains unsupported or corrupted characters.`);
    }
    if (block.fontSize < MIN_PPT_TEXT_FONT_SIZE) {
      issues.push(`Text block "${block.id}" is smaller than the ${MIN_PPT_TEXT_FONT_SIZE}pt readability threshold.`);
    }
    if (!doesTextFit(block)) {
      issues.push(`Text block "${block.id}" does not fit within its editable PowerPoint bounds.`);
    }
  });

  return issues;
}

function findFittingFontSize(block: PptEditableTextBlock): number {
  if (!block.text.trim()) return block.fontSize;

  for (let fontSize = block.fontSize; fontSize >= MIN_PPT_TEXT_FONT_SIZE; fontSize -= 0.5) {
    if (doesTextFit({ ...block, fontSize })) return fontSize;
  }

  return MIN_PPT_TEXT_FONT_SIZE;
}

function doesTextFit(block: PptEditableTextBlock): boolean {
  const charactersPerLine = Math.max(1, (block.w * 72) / block.fontSize);
  const availableLines = Math.max(1, Math.floor((block.h * 72) / (block.fontSize * 1.18)));
  const requiredLines = block.text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(getTextWidthUnits(line) / charactersPerLine)), 0);

  return requiredLines <= availableLines;
}

function getTextWidthUnits(value: string): number {
  return Array.from(value).reduce((total, character) => total + getCharacterWidthUnit(character), 0);
}

function getCharacterWidthUnit(character: string): number {
  if (/\s/u.test(character)) return 0.34;
  if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u2e80-\u9fff\uff00-\uffef]/u.test(character)) return 1;
  if (/[A-Z]/u.test(character)) return 0.68;
  if (/[a-z0-9]/u.test(character)) return 0.56;
  return 0.48;
}

function containsBrokenText(value: string): boolean {
  return /\uFFFD|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value);
}

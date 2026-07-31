import type { PptDeckPlan, PptEditableSlideLayout, PptEditableTextBlock, TemplateDesignProfile } from '@/types/models/pptMaker.model';
import { getPptGridAlignmentIssues } from '@/utils/pptGrid';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const WHITE = 'FFFFFF';
const DEFAULT_PRIMARY = '0B2454';
const DEFAULT_ACCENT = 'FE6621';
const DEFAULT_PRIMARY_SURFACE = 'EFF5FE';
const DEFAULT_ACCENT_SURFACE = 'FFF5E8';
const MUTED = '5F6F89';
const MIN_TEXT_CONTRAST = 4.5;
const MIN_TITLE_FONT_SIZE = 22;
const MIN_SUPPORTING_FONT_SIZE = 7;

export interface PptDesignTokens {
  primary: string;
  accent: string;
  primarySurface: string;
  accentSurface: string;
  muted: string;
  border: string;
  white: string;
}

export function getPptDesignTokens(templateDesign?: TemplateDesignProfile): PptDesignTokens {
  return {
    primary: normalizeHex(templateDesign?.primaryColor) ?? DEFAULT_PRIMARY,
    accent: normalizeHex(templateDesign?.accentColor) ?? DEFAULT_ACCENT,
    primarySurface: normalizeHex(templateDesign?.primarySurfaceColor) ?? DEFAULT_PRIMARY_SURFACE,
    accentSurface: normalizeHex(templateDesign?.accentSurfaceColor) ?? DEFAULT_ACCENT_SURFACE,
    muted: MUTED,
    border: 'D8E1EF',
    white: WHITE,
  };
}

export function getPptDesignQualityIssues(
  deckPlan: Pick<PptDeckPlan, 'request' | 'slides'>,
  layouts: PptEditableSlideLayout[],
): string[] {
  const issues: string[] = [];
  const tokens = getPptDesignTokens(deckPlan.request.styleReference.templateDesign);

  if (getContrastRatio(tokens.primary, tokens.white) < MIN_TEXT_CONTRAST) {
    issues.push('The template primary color does not meet the 4.5:1 contrast requirement on white backgrounds.');
  }
  if (getContrastRatio(tokens.muted, tokens.white) < MIN_TEXT_CONTRAST) {
    issues.push('The supporting text color does not meet the 4.5:1 contrast requirement on white backgrounds.');
  }
  if (getContrastRatio(tokens.primary, tokens.primarySurface) < MIN_TEXT_CONTRAST) {
    issues.push('The template primary color does not meet the 4.5:1 contrast requirement on its primary surface.');
  }
  if (getContrastRatio(tokens.primary, tokens.accentSurface) < MIN_TEXT_CONTRAST) {
    issues.push('The template primary color does not meet the 4.5:1 contrast requirement on its accent surface.');
  }
  if (tokens.primary === tokens.accent) {
    issues.push('The template needs separate primary and accent colors to preserve visual hierarchy.');
  }

  const layoutByPage = new Map(layouts.map((layout) => [layout.pageNumber, layout]));
  deckPlan.slides.forEach((slide) => {
    const layout = layoutByPage.get(slide.pageNumber);
    if (!layout) {
      issues.push(`Slide ${slide.pageNumber} has no editable layout.`);
      return;
    }
    const requiredProofPoints = getMinimumProofPointCount(deckPlan.request.contentDensity);
    if (slide.contentBlocks.length < requiredProofPoints) {
      issues.push(`Slide ${slide.pageNumber} needs at least ${requiredProofPoints} proof points for the selected content density.`);
    }
    issues.push(...getStructuredContentIssues(slide).map((issue) => `Slide ${slide.pageNumber}: ${issue}`));
    issues.push(...getSlideDesignIssues(layout, tokens).map((issue) => `Slide ${slide.pageNumber}: ${issue}`));
  });

  const recommendedStructures = deckPlan.request.styleReference.templateDesign?.recommendedVisualStructures ?? [];
  const recommendedStructureCount = deckPlan.slides.filter((slide) => recommendedStructures.includes(slide.visualStructure)).length;
  const requiredTemplateStructures = deckPlan.slides.length >= 5 ? Math.min(2, recommendedStructures.length) : Math.min(1, recommendedStructures.length);
  if (recommendedStructures.length > 0 && recommendedStructureCount < requiredTemplateStructures) {
    issues.push(`The selected template visual direction needs at least ${requiredTemplateStructures} matching slide structures, but received ${recommendedStructureCount}.`);
  }

  return Array.from(new Set(issues));
}

function getStructuredContentIssues(slide: PptDeckPlan['slides'][number]): string[] {
  const issues: string[] = [];
  const hasTruncationMarker = (value: string) => /(?:\.{2,}|…)/u.test(value);

  if (slide.comparisonTable) {
    const table = slide.comparisonTable;
    if (table.columnHeaders.length !== 3) {
      issues.push('comparison table needs exactly three column headers.');
    }
    if (table.rows.length === 0 || table.rows.length > 5) {
      issues.push('comparison table needs between one and five source-grounded rows.');
    }
    if (table.rows.some((row) => !row.criterion.trim() || row.values.length !== 2 || row.values.some((value) => !value.trim()))) {
      issues.push('comparison table contains an incomplete criterion or value pair.');
    }
    if ([...table.columnHeaders, table.keyResult, ...table.rows.flatMap((row) => [row.criterion, ...row.values])].some(hasTruncationMarker)) {
      issues.push('comparison table contains a truncation marker.');
    }
  }

  if (slide.chart) {
    const chart = slide.chart;
    if (chart.series.length === 0 || chart.series.length > 6) {
      issues.push('chart needs between one and six source-backed data points.');
    }
    if (chart.series.some((item) => !item.label.trim() || !Number.isFinite(item.value))) {
      issues.push('chart contains an incomplete label or non-numeric value.');
    }
    if (chart.type === 'progress' && (chart.targetValue === null || chart.targetValue <= 0)) {
      issues.push('progress chart needs a positive target value.');
    }
    if ([chart.rationale, chart.keyResult, ...chart.series.map((item) => item.label)].some(hasTruncationMarker)) {
      issues.push('chart contains a truncation marker.');
    }
  }

  if (slide.keyMetric) {
    const metric = slide.keyMetric;
    if (!metric.label.trim() || !metric.displayValue.trim() || !Number.isFinite(metric.numericValue) || !metric.comparisonText.trim()) {
      issues.push('key metric is missing its label, value, or evidence context.');
    }
    if ([metric.label, metric.displayValue, metric.changeText ?? '', metric.comparisonText].some(hasTruncationMarker)) {
      issues.push('key metric contains a truncation marker.');
    }
  }

  return issues;
}

function getSlideDesignIssues(layout: PptEditableSlideLayout, tokens: PptDesignTokens): string[] {
  const issues: string[] = [];
  const title = layout.textBlocks.find((block) => block.id === 'title');
  const mainMessage = layout.textBlocks.find((block) => block.id === 'main-message');
  const footer = layout.textBlocks.filter((block) => block.id === 'takeaway' || block.id === 'decision');
  const labels = layout.textBlocks.filter((block) => block.role === 'label');

  if (layout.visualStrategy !== 'rebuild-with-editables') {
    issues.push('does not use the editable layout strategy.');
  }
  issues.push(...getPptGridAlignmentIssues(layout));
  if (!title || !mainMessage || footer.length !== 2 || labels.length < 3) {
    issues.push('is missing the required title, message, proof-point, or footer hierarchy.');
    return issues;
  }
  if (title.fontSize < MIN_TITLE_FONT_SIZE || title.fontSize <= mainMessage.fontSize) {
    issues.push('does not preserve a clear title-to-message typography hierarchy.');
  }
  if (normalizeHex(title.color) !== tokens.primary) {
    issues.push('title does not use the selected template primary color.');
  }
  if (!title.text.trim() || !mainMessage.text.trim() || footer.some((block) => !block.text.trim())) {
    issues.push('has an empty text block in its key visual hierarchy.');
  }

  layout.textBlocks.forEach((block) => {
    if (!isWithinSafeArea(block)) {
      issues.push(`text block "${block.id}" falls outside the slide safe area.`);
    }
    if (block.text.trim() && block.fontSize < MIN_SUPPORTING_FONT_SIZE) {
      issues.push(`text block "${block.id}" is smaller than the ${MIN_SUPPORTING_FONT_SIZE}pt design readability threshold.`);
    }
    const contrast = getContrastRatio(block.color ?? tokens.primary, getTextBackground(block, tokens));
    if (block.text.trim() && contrast < MIN_TEXT_CONTRAST) {
      issues.push(`text block "${block.id}" does not meet the ${MIN_TEXT_CONTRAST}:1 contrast requirement on its rendered surface.`);
    }
  });

  layout.shapes.forEach((shape) => {
    if (shape.id !== 'page-circle' && !isShapeWithinSafeArea(shape)) {
      issues.push(`shape "${shape.id}" falls outside the slide safe area.`);
    }
  });

  const textOverlapPairs = getTextOverlapPairs(layout.textBlocks);
  if (textOverlapPairs.length > 0) {
    issues.push(`contains overlapping editable text blocks: ${textOverlapPairs[0]}.`);
  }
  if (footer.some((block) => block.y <= getBodyBottom(layout.textBlocks))) {
    issues.push('does not maintain visual separation between body content and the footer.');
  }

  if (layout.shapes.filter((shape) => shape.id.startsWith('label-panel-')).length !== labels.length) {
    issues.push('does not provide a background panel for every proof point.');
  }
  labels.forEach((label, index) => {
    const panel = layout.shapes.find((shape) => shape.id === `label-panel-${index + 1}`);
    const expectedSurface = index % 2 === 0 ? tokens.primarySurface : tokens.accentSurface;
    if (!panel || normalizeHex(panel.fillColor) !== expectedSurface) {
      issues.push(`proof point ${index + 1} does not use the selected template surface color.`);
      return;
    }
    if (!isTextInsidePanel(label, panel)) {
      issues.push(`proof point ${index + 1} text is not safely contained within its panel.`);
    }
  });
  if (!layout.shapes.some((shape) => shape.id === 'title-accent' && normalizeHex(shape.fillColor) === tokens.accent)) {
    issues.push('does not apply the selected template accent color to the title hierarchy.');
  }

  return issues;
}

function getMinimumProofPointCount(contentDensity: PptDeckPlan['request']['contentDensity']): number {
  if (contentDensity === 'detailed') return 5;
  if (contentDensity === 'standard') return 4;
  return 3;
}

function getTextBackground(block: PptEditableTextBlock, tokens: PptDesignTokens): string {
  if (block.id === 'main-message' && block.color === tokens.white) return tokens.primary;
  if (block.id === 'page-number') return tokens.primary;
  if (block.role === 'label') {
    const match = block.id.match(/label-(\d+)/u);
    return Number(match?.[1] ?? '1') % 2 === 0 ? tokens.accentSurface : tokens.primarySurface;
  }
  return tokens.white;
}

function getTextOverlapPairs(blocks: PptEditableTextBlock[]): string[] {
  return blocks.flatMap((block, index) => blocks.slice(index + 1).flatMap((candidate) => {
    const gapTolerance = 0.01;
    const overlapsHorizontally = block.x + gapTolerance < candidate.x + candidate.w && candidate.x + gapTolerance < block.x + block.w;
    const overlapsVertically = block.y + gapTolerance < candidate.y + candidate.h && candidate.y + gapTolerance < block.y + block.h;
    return overlapsHorizontally && overlapsVertically
      ? [`${block.id} / ${candidate.id}`]
      : [];
  }));
}

function getBodyBottom(blocks: PptEditableTextBlock[]): number {
  return blocks
    .filter((block) => !['takeaway', 'decision', 'page-number'].includes(block.id))
    .reduce((bottom, block) => Math.max(bottom, block.y + block.h), 0);
}

function isTextInsidePanel(
  textBlock: PptEditableTextBlock,
  panel: Pick<PptEditableSlideLayout['shapes'][number], 'x' | 'y' | 'w' | 'h'>,
): boolean {
  const padding = 0.04;
  return textBlock.x >= panel.x + padding &&
    textBlock.y >= panel.y + padding &&
    textBlock.x + textBlock.w <= panel.x + panel.w - padding &&
    textBlock.y + textBlock.h <= panel.y + panel.h - padding;
}

function isWithinSafeArea(block: PptEditableTextBlock): boolean {
  if (block.id === 'page-number' || block.id === 'logo') {
    return block.x >= 0.3 && block.y >= 0.2 && block.x + block.w <= SLIDE_W - 0.3 && block.y + block.h <= SLIDE_H - 0.2;
  }
  return block.x >= 0.5 && block.y >= 0.35 && block.x + block.w <= SLIDE_W - 0.5 && block.y + block.h <= SLIDE_H - 0.35;
}

function isShapeWithinSafeArea(shape: Pick<PptEditableSlideLayout['shapes'][number], 'x' | 'y' | 'w' | 'h'>): boolean {
  return shape.x >= 0.5 && shape.y >= 0.35 && shape.x + shape.w <= SLIDE_W - 0.5 && shape.y + shape.h <= SLIDE_H - 0.35;
}

export function getContrastRatio(foreground: string, background: string): number {
  const foregroundRgb = hexToRgb(foreground);
  const backgroundRgb = hexToRgb(background);
  if (!foregroundRgb || !backgroundRgb) return 0;

  const foregroundLuminosity = getRelativeLuminance(foregroundRgb);
  const backgroundLuminosity = getRelativeLuminance(backgroundRgb);
  return (Math.max(foregroundLuminosity, backgroundLuminosity) + 0.05) / (Math.min(foregroundLuminosity, backgroundLuminosity) + 0.05);
}

function normalizeHex(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^#/u, '').toUpperCase();
  return normalized && /^[0-9A-F]{6}$/u.test(normalized) ? normalized : undefined;
}

function hexToRgb(value: string): [number, number, number] | null {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function getRelativeLuminance([red, green, blue]: [number, number, number]): number {
  const linearize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

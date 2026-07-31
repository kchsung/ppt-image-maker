import type { PptEditableShape, PptEditableSlideLayout, PptEditableTextBlock } from '@/types/models/pptMaker.model';

export const PPT_HTML_GRID = {
  width: 1920,
  height: 1080,
  columnCount: 12,
  outerMargin: 72,
  gutter: 24,
  baseline: 24,
  headerAccentX: 72,
  headerContentX: 120,
  headerTop: 72,
  bodyTop: 336,
  footerRuleBottom: 120,
  footerSourceBottom: 96,
  footerTakeawayBottom: 72,
  footerDecisionBottom: 36,
} as const;

export const PPT_EXPORT_GRID = {
  width: 13.333,
  height: 7.5,
  columnCount: 12,
  safeMarginX: 0.52,
  safeMarginY: 0.36,
  gutter: 0.12,
  baseline: 0.04,
  headerX: 0.76,
  headerY: 0.52,
  bodyX: 0.76,
  footerLineY: 6.52,
  pageX: 12.16,
  pageY: 6.56,
} as const;

export function getHtmlGridColumns(columns: number): string {
  return `repeat(${Math.max(1, Math.min(columns, PPT_HTML_GRID.columnCount))}, minmax(0, 1fr))`;
}

export function getHtmlColumnWidth(span = 1): number {
  const availableWidth = PPT_HTML_GRID.width - (PPT_HTML_GRID.outerMargin * 2) - (PPT_HTML_GRID.gutter * (PPT_HTML_GRID.columnCount - 1));
  return (availableWidth / PPT_HTML_GRID.columnCount) * span + PPT_HTML_GRID.gutter * Math.max(0, span - 1);
}

export function snapEditableLayoutToGrid(layout: PptEditableSlideLayout): PptEditableSlideLayout {
  return {
    ...layout,
    imageLayer: layout.imageLayer.strategy === 'none'
      ? layout.imageLayer
      : { ...layout.imageLayer, ...snapRect(layout.imageLayer) },
    textBlocks: layout.textBlocks.map(snapTextBlock),
    shapes: layout.shapes.map(snapShape),
  };
}

export function getPptGridAlignmentIssues(layout: PptEditableSlideLayout): string[] {
  const issues: string[] = [];
  const objects: Array<{ id: string; x: number; y: number; w: number; h: number }> = [
    ...layout.textBlocks,
    ...layout.shapes,
    ...(layout.imageLayer.strategy === 'none' ? [] : [{ id: 'image-layer', ...layout.imageLayer }]),
  ];

  objects.forEach((object) => {
    if (!isPptGridAligned(object.x) || !isPptGridAligned(object.y) || !isPptGridAligned(object.w) || !isPptGridAligned(object.h)) {
      issues.push(`object "${object.id}" is not aligned to the shared PPT grid.`);
    }
    if (object.x < 0 || object.y < 0 || object.x + object.w > PPT_EXPORT_GRID.width || object.y + object.h > PPT_EXPORT_GRID.height) {
      issues.push(`object "${object.id}" exceeds the PPT slide bounds.`);
    }
  });

  return issues;
}

export function isPptGridAligned(value: number): boolean {
  const snapped = snapPptGridValue(value);
  return Math.abs(value - snapped) < 0.0001;
}

export function snapPptGridValue(value: number): number {
  return roundToPrecision(Math.round(value / PPT_EXPORT_GRID.baseline) * PPT_EXPORT_GRID.baseline);
}

function snapTextBlock(block: PptEditableTextBlock): PptEditableTextBlock {
  return { ...block, ...snapRect(block) };
}

function snapShape(shape: PptEditableShape): PptEditableShape {
  return { ...shape, ...snapRect(shape) };
}

function snapRect<T extends { x: number; y: number; w: number; h: number }>(rect: T): Pick<T, 'x' | 'y' | 'w' | 'h'> {
  return {
    x: snapPptGridValue(rect.x),
    y: snapPptGridValue(rect.y),
    w: snapPptGridValue(rect.w),
    h: snapPptGridValue(rect.h),
  };
}

function roundToPrecision(value: number): number {
  return Number(value.toFixed(4));
}

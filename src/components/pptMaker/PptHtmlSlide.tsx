import type { CSSProperties } from 'react';
import type { SlideContentBlock, SlideMasterLayoutId, SlidePlan, SourceReference, StyleReference, TemplateDesignProfile } from '@/types/models/pptMaker.model';
import { getContrastRatio } from '@/utils/pptDesignQuality';
import { getHtmlGridColumns, PPT_HTML_GRID } from '@/utils/pptGrid';
import { selectSlideMasterLayout } from '@/utils/pptMaker';

const SLIDE_WIDTH = PPT_HTML_GRID.width;
const SLIDE_HEIGHT = PPT_HTML_GRID.height;
const NAVY = 'var(--ppt-primary, #0B2454)';
const ACCENT = 'var(--ppt-accent, #FE6621)';
const MUTED = '#5F6F89';
const PALE_BLUE = 'var(--ppt-primary-surface, #EFF5FE)';
const PALE_ORANGE = 'var(--ppt-accent-surface, #FFF5E8)';
const textWrapStyle: CSSProperties = { overflowWrap: 'anywhere', wordBreak: 'keep-all' };

const defaultTemplateDesign: TemplateDesignProfile = {
  primaryColor: '#0B2454',
  accentColor: '#FE6621',
  primarySurfaceColor: '#EFF5FE',
  accentSurfaceColor: '#FFF5E8',
  signatureLayout: 'clean editorial card hierarchy',
  recommendedVisualStructures: ['hero-visual', 'card-grid', 'numbered-process', 'closing-commitment'],
};

interface PptHtmlSlideProps {
  slide: SlidePlan;
  logoImageDataUrl?: string;
  styleReference?: StyleReference;
  sourceReferences?: SourceReference[];
  totalSlides?: number;
  exportMode?: boolean;
  previewScale?: number;
  className?: string;
}

export function PptHtmlSlide({ slide, logoImageDataUrl, styleReference, sourceReferences = [], totalSlides, exportMode = false, previewScale = 0.5, className }: PptHtmlSlideProps) {
  const objective = slide.objective || slide.subtitle;
  const decision = slide.decision || slide.takeaway;
  const templateDesign = styleReference?.templateDesign ?? defaultTemplateDesign;
  const sourceLabel = getSourceLabel(slide, sourceReferences);
  const masterLayout = slide.masterLayout ?? selectSlideMasterLayout(slide, totalSlides ?? Math.max(slide.pageNumber, 3));
  const surfaceStyle: CSSProperties = {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    background: '#FFFFFF',
    color: NAVY,
    fontFamily: 'Pretendard, "Noto Sans KR", Arial, sans-serif',
    transformOrigin: 'top left',
    '--ppt-primary': templateDesign.primaryColor,
    '--ppt-accent': templateDesign.accentColor,
    '--ppt-primary-surface': templateDesign.primarySurfaceColor,
    '--ppt-accent-surface': templateDesign.accentSurfaceColor,
    '--ppt-accent-foreground': getContrastRatio(templateDesign.accentColor, '#FFFFFF') >= 4.5 ? '#FFFFFF' : templateDesign.primaryColor,
  } as CSSProperties;

  const content = (
    <div className={className} data-pptx-slide={exportMode ? String(slide.pageNumber) : undefined} data-pptx-master={masterLayout} style={exportMode ? surfaceStyle : { ...surfaceStyle, transform: `scale(${previewScale})` }}>
      <div style={{ position: 'absolute', left: PPT_HTML_GRID.headerAccentX, top: PPT_HTML_GRID.headerTop, width: 12, height: 168, borderRadius: 6, background: ACCENT }} />
      <div style={{ position: 'absolute', left: PPT_HTML_GRID.headerContentX, top: PPT_HTML_GRID.headerTop, width: 1260 }}>
        <div style={{ fontSize: getTitleFontSize(slide.title), fontWeight: 800, lineHeight: 1.1, ...textWrapStyle }}>{slide.title}</div>
        <div style={{ marginTop: 16, fontSize: 23, lineHeight: 1.35, color: MUTED, ...textWrapStyle }}>{slide.subtitle}</div>
        <div style={{ marginTop: 16, maxWidth: 1040, fontSize: 19, fontWeight: 700, lineHeight: 1.35, color: NAVY, ...textWrapStyle }}>{objective}</div>
      </div>
      <Logo logoImageDataUrl={logoImageDataUrl} />
      <VisualLayout slide={slide} masterLayout={masterLayout} />
      <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, bottom: PPT_HTML_GRID.footerRuleBottom, height: 2, background: '#D8E1EF' }} />
      {sourceLabel ? <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, bottom: PPT_HTML_GRID.footerSourceBottom, width: 1320, fontSize: 12, lineHeight: 1.2, color: MUTED, ...textWrapStyle }}>{sourceLabel}</div> : null}
      <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, bottom: PPT_HTML_GRID.footerTakeawayBottom, width: 1450, fontSize: getFooterFontSize(slide.takeaway, 19), lineHeight: 1.25, color: MUTED, ...textWrapStyle }}>{slide.takeaway}</div>
      <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, bottom: PPT_HTML_GRID.footerDecisionBottom, width: 1450, fontSize: getFooterFontSize(decision, 21), fontWeight: 800, lineHeight: 1.2, ...textWrapStyle }}>{decision}</div>
      <div style={{ position: 'absolute', right: PPT_HTML_GRID.outerMargin, bottom: 24, width: 58, height: 58, borderRadius: 999, background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800 }}>{String(slide.pageNumber).padStart(2, '0')}</div>
    </div>
  );

  return exportMode ? content : <div style={{ width: SLIDE_WIDTH * previewScale, height: SLIDE_HEIGHT * previewScale, overflow: 'hidden' }}>{content}</div>;
}

function getSourceLabel(slide: SlidePlan, sources: SourceReference[]): string | null {
  const source = sources.find((item) => slide.sourceIds?.includes(item.id));
  if (!source) return null;
  return `Source: ${source.sourceName} - ${source.documentName}${source.publicationYear ? ` (${source.publicationYear})` : ''}`;
}

function Logo({ logoImageDataUrl }: { logoImageDataUrl?: string }) {
  return <div style={{ position: 'absolute', right: PPT_HTML_GRID.outerMargin, top: 72, width: 168, height: 48, border: logoImageDataUrl ? 'none' : '1px solid #D8E1EF', borderRadius: 8, color: '#85878A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>{logoImageDataUrl ? <img src={logoImageDataUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '\uB85C\uACE0'}</div>;
}

function getBlocks(slide: SlidePlan): SlideContentBlock[] {
  if (slide.contentBlocks?.length > 0) return slide.contentBlocks.slice(0, 5);
  return slide.labels.slice(0, 5).map((heading) => ({ heading, detail: slide.mainMessage }));
}

function getTitleFontSize(value: string): number {
  const length = [...value].length;
  if (length > 34) return 42;
  if (length > 26) return 46;
  return 50;
}

function getFooterFontSize(value: string, baseSize: number): number {
  const length = [...value].length;
  if (length > 150) return baseSize - 5;
  if (length > 105) return baseSize - 3;
  return baseSize;
}

function getCardHeadingFontSize(value: string, compact: boolean): number {
  const length = [...value].length;
  const baseSize = compact ? 20 : 23;
  if (length > 26) return baseSize - 5;
  if (length > 18) return baseSize - 3;
  return baseSize;
}

function getCardDetailFontSize(value: string, compact: boolean): number {
  const length = [...value].length;
  const baseSize = compact ? 15 : 17;
  if (length > 180) return baseSize - 4;
  if (length > 120) return baseSize - 3;
  if (length > 80) return baseSize - 2;
  return baseSize;
}

function getDecision(slide: SlidePlan): string {
  return slide.decision || slide.takeaway;
}

function VisualLayout({ slide, masterLayout }: { slide: SlidePlan; masterLayout: SlideMasterLayoutId }) {
  const blocks = getBlocks(slide);
  if (masterLayout === 'agenda') return <AgendaLayout slide={slide} blocks={blocks} />;
  if (masterLayout === 'section') return <SectionLayout slide={slide} blocks={blocks} />;
  if (masterLayout !== 'cover' && masterLayout !== 'conclusion' && slide.comparisonTable && slide.comparisonTable.rows.length > 0) {
    return <ComparisonTableLayout slide={slide} />;
  }
  if (masterLayout !== 'cover' && masterLayout !== 'conclusion' && slide.chart && slide.chart.series.length > 0) {
    return <ChartLayout slide={slide} />;
  }
  if (masterLayout !== 'cover' && masterLayout !== 'conclusion' && slide.diagram && slide.diagram.type !== 'none') {
    return <div data-diagram-type={slide.diagram.type}>{renderDiagramLayout(slide, blocks)}</div>;
  }
  if (masterLayout !== 'cover' && masterLayout !== 'conclusion' && slide.keyMetric) {
    return <KeyMetricLayout slide={slide} blocks={blocks} />;
  }
  switch (slide.visualStructure) {
    case 'message-emphasis':
    case 'closing-commitment': return <EmphasisLayout slide={slide} blocks={blocks} />;
    case 'side-by-side-comparison':
    case 'before-after-mapping': return <ComparisonLayout slide={slide} blocks={blocks} />;
    case 'numbered-process':
    case 'roadmap': return <RoadmapLayout slide={slide} blocks={blocks} />;
    case 'hub-and-spoke': return <HubLayout slide={slide} blocks={blocks} />;
    case 'metrics-dashboard': return <EvidenceDashboardLayout slide={slide} blocks={blocks} />;
    case 'pyramid-framework': return <PyramidLayout slide={slide} blocks={blocks} />;
    case 'case-story': return <CaseStoryLayout slide={slide} blocks={blocks} />;
    case 'hero-visual': return <HeroLayout slide={slide} blocks={blocks} />;
    default: return <CardGridLayout slide={slide} blocks={blocks} />;
  }
}

function ComparisonTableLayout({ slide }: { slide: SlidePlan }) {
  const table = slide.comparisonTable!;
  const columnHeaders = table.columnHeaders.length >= 3
    ? table.columnHeaders.slice(0, 3)
    : ['Criterion', ...table.columnHeaders.slice(0, 2)];
  return <div data-comparison-table="true" style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}>
    <Message>{slide.mainMessage}</Message>
    <div style={{ marginTop: 30, border: '2px solid #D8E1EF', borderRadius: 16, overflow: 'hidden', background: '#FFFFFF' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.35fr 1.35fr', background: NAVY, color: '#FFFFFF' }}>
        {columnHeaders.map((header) => <div key={header} style={{ minHeight: 54, display: 'flex', alignItems: 'center', padding: '12px 16px', fontSize: 18, fontWeight: 800, lineHeight: 1.2, ...textWrapStyle }}>{header}</div>)}
      </div>
      {table.rows.map((row, index) => {
        const highlighted = row.emphasis !== 'none' || table.highlightedRowIndex === index;
        return <div key={`${row.criterion}-${index}`} data-table-emphasis={highlighted ? row.emphasis : 'none'} style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.35fr 1.35fr', minHeight: 68, background: highlighted ? PALE_ORANGE : index % 2 === 0 ? '#FFFFFF' : PALE_BLUE, borderTop: '1px solid #D8E1EF' }}>
          <div style={{ padding: '14px 16px', fontSize: 17, fontWeight: 800, color: highlighted ? ACCENT : NAVY, ...textWrapStyle }}>{row.criterion}</div>
          {row.values.slice(0, 2).map((value, valueIndex) => <div key={`${row.criterion}-${valueIndex}`} style={{ padding: '14px 16px', borderLeft: '1px solid #D8E1EF', fontSize: 16, color: MUTED, lineHeight: 1.32, ...textWrapStyle }}>{value}</div>)}
        </div>;
      })}
    </div>
    <div style={{ marginTop: 18, borderLeft: `7px solid ${ACCENT}`, padding: '10px 16px', background: PALE_ORANGE, color: NAVY, fontSize: 18, fontWeight: 800, lineHeight: 1.3, ...textWrapStyle }}>{table.keyResult}</div>
  </div>;
}

function ChartLayout({ slide }: { slide: SlidePlan }) {
  const chart = slide.chart!;
  const maxValue = Math.max(...chart.series.map((item) => item.value), chart.targetValue ?? 0, 1);
  const formatValue = (value: number) => `${value}${chart.unit}`;
  const highlightedIndex = chart.highlightedIndex ?? chart.series.reduce((bestIndex, item, index) => item.value > chart.series[bestIndex]!.value ? index : bestIndex, 0);
  return <div data-chart-type={chart.type} data-chart-purpose={chart.purpose} style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}>
    <Message>{slide.mainMessage}</Message>
    <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 0.85fr', gap: PPT_HTML_GRID.gutter, marginTop: 30 }}>
      <div style={{ minHeight: 350, border: '2px solid #D8E1EF', borderRadius: 18, padding: 26, background: '#FFFFFF', overflow: 'hidden' }}>
        <div style={{ color: ACCENT, fontSize: 18, fontWeight: 800, ...textWrapStyle }}>{chart.rationale}</div>
        {chart.type === 'progress' ? <ProgressChart chart={chart} maxValue={maxValue} formatValue={formatValue} /> : null}
        {chart.type === 'donut' ? <CompositionChart chart={chart} formatValue={formatValue} /> : null}
        {chart.type === 'line' ? <TrendChart chart={chart} maxValue={maxValue} formatValue={formatValue} highlightedIndex={highlightedIndex} /> : null}
        {chart.type === 'bar' || chart.type === 'histogram' ? <BarChart chart={chart} maxValue={maxValue} formatValue={formatValue} highlightedIndex={highlightedIndex} /> : null}
      </div>
      <div style={{ display: 'grid', gap: 14, alignContent: 'center' }}>
        {slide.keyMetric ? <KeyMetricDisplay metric={slide.keyMetric} compact /> : <div style={{ borderLeft: `8px solid ${ACCENT}`, padding: '14px 18px', background: PALE_ORANGE }}><div style={{ color: ACCENT, fontSize: 16, fontWeight: 800 }}>Key result</div><div style={{ marginTop: 8, color: NAVY, fontSize: 23, fontWeight: 800, lineHeight: 1.25, ...textWrapStyle }}>{chart.keyResult}</div></div>}
        <div style={{ padding: '14px 18px', border: '2px solid #D8E1EF', borderRadius: 14, background: PALE_BLUE }}><div style={{ color: NAVY, fontSize: 16, fontWeight: 800 }}>{chart.purpose}</div><div style={{ marginTop: 7, color: MUTED, fontSize: 15, lineHeight: 1.35, ...textWrapStyle }}>Chart type: {chart.type}</div>{chart.targetValue !== null ? <div style={{ marginTop: 8, color: ACCENT, fontSize: 18, fontWeight: 800 }}>Target: {formatValue(chart.targetValue)}</div> : null}</div>
      </div>
    </div>
  </div>;
}

function KeyMetricLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const metric = slide.keyMetric!;
  return <div data-key-metric-layout="true" style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}>
    <Message>{slide.mainMessage}</Message>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 44, marginTop: 38, alignItems: 'stretch' }}>
      <KeyMetricDisplay metric={metric} />
      <div style={{ display: 'grid', gap: 14 }}>{blocks.slice(0, 3).map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact />)}</div>
    </div>
  </div>;
}

function KeyMetricDisplay({ metric, compact = false }: { metric: NonNullable<SlidePlan['keyMetric']>; compact?: boolean }) {
  const color = metric.direction === 'down' ? '#C2410C' : metric.direction === 'up' ? ACCENT : NAVY;
  return <div data-key-metric="true" style={{ minHeight: compact ? 168 : 306, border: `3px solid ${color}`, borderRadius: 20, background: metric.direction === 'down' ? '#FFF4ED' : PALE_ORANGE, padding: compact ? '18px 20px' : '32px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <div style={{ color, fontSize: compact ? 16 : 20, fontWeight: 800, ...textWrapStyle }}>{metric.label}</div>
    <div style={{ marginTop: compact ? 8 : 14, color: NAVY, fontSize: compact ? 48 : 76, fontWeight: 800, lineHeight: 1, letterSpacing: 0, ...textWrapStyle }}>{metric.displayValue}</div>
    {metric.changeText ? <div style={{ marginTop: compact ? 10 : 16, color, fontSize: compact ? 20 : 28, fontWeight: 800, ...textWrapStyle }}>{metric.direction === 'up' ? '+' : metric.direction === 'down' ? '-' : ''} {metric.changeText.replace(/^[+-]/u, '')}</div> : null}
    <div style={{ marginTop: compact ? 10 : 18, color: MUTED, fontSize: compact ? 14 : 17, lineHeight: 1.36, ...textWrapStyle }}>{metric.comparisonText}</div>
  </div>;
}

function BarChart({ chart, maxValue, formatValue, highlightedIndex }: { chart: NonNullable<SlidePlan['chart']>; maxValue: number; formatValue: (value: number) => string; highlightedIndex: number }) {
  return <div style={{ height: 240, marginTop: 28, display: 'flex', alignItems: 'flex-end', gap: 16, borderBottom: `3px solid ${NAVY}`, padding: '0 16px 0' }}>{chart.series.map((item, index) => <div key={item.label} style={{ minWidth: 0, flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 9 }}><div style={{ color: index === highlightedIndex ? ACCENT : NAVY, fontSize: 16, fontWeight: 800 }}>{formatValue(item.value)}</div><div style={{ width: '68%', height: `${Math.max(12, Math.round((item.value / maxValue) * 170))}px`, borderRadius: '10px 10px 0 0', background: index === highlightedIndex ? ACCENT : NAVY }} /><div style={{ minHeight: 40, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 1.25, ...textWrapStyle }}>{item.label}</div></div>)}</div>;
}

function TrendChart({ chart, maxValue, formatValue, highlightedIndex }: { chart: NonNullable<SlidePlan['chart']>; maxValue: number; formatValue: (value: number) => string; highlightedIndex: number }) {
  return <div style={{ height: 240, marginTop: 28, position: 'relative', borderBottom: `3px solid ${NAVY}` }}><div style={{ position: 'absolute', left: 30, right: 30, top: '50%', height: 3, background: '#CFE0FA' }} />{chart.series.map((item, index) => <div key={item.label} style={{ position: 'absolute', left: `${8 + (index / Math.max(1, chart.series.length - 1)) * 84}%`, bottom: `${36 + Math.round((item.value / maxValue) * 130)}px`, transform: 'translateX(-50%)', textAlign: 'center' }}><div style={{ color: index === highlightedIndex ? ACCENT : NAVY, fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>{formatValue(item.value)}</div><div style={{ width: 24, height: 24, margin: '8px auto', borderRadius: 999, background: index === highlightedIndex ? ACCENT : NAVY, border: '5px solid #FFFFFF', boxShadow: `0 0 0 3px ${index === highlightedIndex ? ACCENT : NAVY}` }} /><div style={{ width: 104, marginLeft: -40, fontSize: 13, color: MUTED, lineHeight: 1.2, ...textWrapStyle }}>{item.label}</div></div>)}</div>;
}

function CompositionChart({ chart, formatValue }: { chart: NonNullable<SlidePlan['chart']>; formatValue: (value: number) => string }) {
  const total = chart.series.reduce((sum, item) => sum + item.value, 0) || 1;
  const gradient = chart.series.map((item, index) => {
    const start = chart.series.slice(0, index).reduce((sum, entry) => sum + entry.value, 0) / total * 100;
    const end = (start + item.value / total * 100);
    return `${index % 2 === 0 ? NAVY : ACCENT} ${start}% ${end}%`;
  }).join(', ');
  return <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 34 }}><div style={{ width: 200, height: 200, borderRadius: 999, background: `conic-gradient(${gradient})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 118, height: 118, borderRadius: 999, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NAVY, fontSize: 20, fontWeight: 800 }}>{formatValue(total)}</div></div><div style={{ flex: 1, display: 'grid', gap: 10 }}>{chart.series.map((item, index) => <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'center' }}><div style={{ width: 14, height: 14, borderRadius: 999, background: index % 2 === 0 ? NAVY : ACCENT }} /><div style={{ flex: 1, fontSize: 15, color: MUTED, ...textWrapStyle }}>{item.label}</div><div style={{ fontSize: 16, color: NAVY, fontWeight: 800 }}>{formatValue(item.value)}</div></div>)}</div></div>;
}

function ProgressChart({ chart, maxValue, formatValue }: { chart: NonNullable<SlidePlan['chart']>; maxValue: number; formatValue: (value: number) => string }) {
  const value = chart.series[0]?.value ?? 0;
  const target = chart.targetValue ?? maxValue;
  const percentage = Math.min(100, Math.max(0, (value / target) * 100));
  return <div style={{ marginTop: 50, padding: '34px 22px' }}><div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}><div style={{ color: NAVY, fontSize: 46, fontWeight: 800 }}>{formatValue(value)}</div><div style={{ color: MUTED, fontSize: 20, fontWeight: 700 }}>of {formatValue(target)}</div></div><div style={{ marginTop: 26, height: 34, borderRadius: 999, background: '#D8E1EF', overflow: 'hidden' }}><div style={{ width: `${percentage}%`, height: '100%', background: ACCENT, borderRadius: 999 }} /></div><div style={{ marginTop: 16, fontSize: 18, color: MUTED, ...textWrapStyle }}>{chart.series[0]?.label}</div></div>;
}

function renderDiagramLayout(slide: SlidePlan, blocks: SlideContentBlock[]) {
  switch (slide.diagram?.type) {
    case 'process': return <RoadmapLayout slide={slide} blocks={blocks} />;
    case 'timeline': return <RoadmapLayout slide={slide} blocks={blocks} timeline />;
    case 'cycle': return <CycleLayout slide={slide} blocks={blocks} />;
    case 'hierarchy': return <PyramidLayout slide={slide} blocks={blocks} />;
    case 'relationship': return <HubLayout slide={slide} blocks={blocks} />;
    case 'change': return <ComparisonLayout slide={slide} blocks={blocks} />;
    default: return <CardGridLayout slide={slide} blocks={blocks} />;
  }
}

function AgendaLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><Message>{slide.mainMessage}</Message><div style={{ position: 'relative', display: 'grid', gridTemplateColumns: getHtmlGridColumns(Math.min(blocks.length, 5)), gap: PPT_HTML_GRID.gutter, marginTop: 56, paddingTop: 32 }}><div style={{ position: 'absolute', left: 58, right: 58, top: 60, height: 5, background: '#CFE0FA' }} />{blocks.map((block, index) => <div key={block.heading} style={{ position: 'relative', zIndex: 1 }}><div style={{ width: 62, height: 62, borderRadius: 999, margin: '0 auto 18px', background: index % 2 === 0 ? NAVY : ACCENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>{String(index + 1).padStart(2, '0')}</div><div style={{ minHeight: 170, border: '2px solid #D8E1EF', borderRadius: 16, padding: 20, background: index % 2 === 0 ? PALE_BLUE : PALE_ORANGE }}><div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.2, ...textWrapStyle }}>{block.heading}</div><div style={{ marginTop: 14, color: MUTED, fontSize: 16, lineHeight: 1.38, ...textWrapStyle }}>{block.detail}</div></div></div>)}</div></div>;
}

function SectionLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop + PPT_HTML_GRID.baseline, display: 'flex', gap: 50, alignItems: 'center' }}><div style={{ width: '56%' }}><div style={{ borderLeft: `10px solid ${ACCENT}`, paddingLeft: 28 }}><Message>{slide.mainMessage}</Message></div><div style={{ marginTop: 42, display: 'grid', gap: 14 }}>{blocks.slice(0, 3).map((block, index) => <div key={block.heading} style={{ display: 'flex', gap: PPT_HTML_GRID.gutter, alignItems: 'center', padding: '16px 20px', borderRadius: 14, background: index % 2 === 0 ? PALE_BLUE : PALE_ORANGE }}><div style={{ width: 38, height: 38, flex: '0 0 auto', borderRadius: 999, background: index % 2 === 0 ? NAVY : ACCENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{index + 1}</div><div><div style={{ fontSize: 21, fontWeight: 800 }}>{block.heading}</div><div style={{ marginTop: 5, fontSize: 16, color: MUTED, lineHeight: 1.32, ...textWrapStyle }}>{block.detail}</div></div></div>)}</div></div><div style={{ flex: 1, minHeight: 360, borderRadius: 32, border: `5px solid ${ACCENT}`, background: PALE_ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 44, textAlign: 'center' }}><div><div style={{ width: 96, height: 96, margin: '0 auto 22px', borderRadius: 999, background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>+</div><div style={{ fontSize: 27, fontWeight: 800, lineHeight: 1.25, ...textWrapStyle }}>{getDecision(slide)}</div></div></div></div>;
}

function Message({ children, dark = false }: { children: string; dark?: boolean }) {
  return <div style={{ color: dark ? '#FFFFFF' : NAVY, fontSize: 28, fontWeight: 750, lineHeight: 1.28, ...textWrapStyle }}>{children}</div>;
}

function ContentCard({ block, index, numbered = false, compact = false }: { block: SlideContentBlock; index: number; numbered?: boolean; compact?: boolean }) {
  return <div style={{ flex: 1, minWidth: 0, minHeight: compact ? 132 : 194, border: `2px solid ${index % 2 === 0 ? '#CFE0FA' : '#FFD9BC'}`, borderRadius: 16, background: index % 2 === 0 ? PALE_BLUE : PALE_ORANGE, padding: compact ? '18px 20px' : '22px 24px', display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: 999, background: index % 2 === 0 ? NAVY : ACCENT, color: index % 2 === 0 ? '#FFFFFF' : 'var(--ppt-accent-foreground, #FFFFFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>{numbered ? String(index + 1).padStart(2, '0') : String(index + 1)}</div><div style={{ fontSize: getCardHeadingFontSize(block.heading, compact), fontWeight: 800, lineHeight: 1.16, ...textWrapStyle }}>{block.heading}</div></div>
    <div style={{ fontSize: getCardDetailFontSize(block.detail, compact), color: MUTED, lineHeight: 1.36, ...textWrapStyle }}>{block.detail}</div>
    <div style={{ marginTop: 'auto', width: 64, height: 4, borderRadius: 8, background: index % 2 === 0 ? NAVY : ACCENT }} />
  </div>;
}

function CardGridLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const columns = blocks.length >= 5 ? 3 : blocks.length;
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><Message>{slide.mainMessage}</Message><div style={{ display: 'grid', gridTemplateColumns: getHtmlGridColumns(columns), gap: PPT_HTML_GRID.gutter, marginTop: 38 }}>{blocks.map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact={blocks.length > 3} />)}</div></div>;
}

function HeroLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const columns = blocks.length >= 5 ? 3 : 2;
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop, display: 'flex', gap: 56, alignItems: 'center' }}><div style={{ width: '55%' }}><Message>{slide.mainMessage}</Message><div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: getHtmlGridColumns(columns), gap: 16 }}>{blocks.map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact />)}</div></div><div style={{ flex: 1, height: 420, borderRadius: 999, border: `7px solid ${ACCENT}`, background: PALE_ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 52 }}><div><div style={{ width: 112, height: 112, borderRadius: 999, background: NAVY, color: '#FFFFFF', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42 }}>+</div><div style={{ fontSize: 29, fontWeight: 800, lineHeight: 1.2 }}>{getDecision(slide)}</div></div></div></div>;
}

function EmphasisLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const columns = blocks.length >= 5 ? 3 : blocks.length;
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><div style={{ borderRadius: 28, background: NAVY, padding: '58px 84px', textAlign: 'center' }}><Message dark>{slide.mainMessage}</Message></div><div style={{ display: 'grid', gridTemplateColumns: getHtmlGridColumns(columns), gap: PPT_HTML_GRID.gutter, marginTop: 34 }}>{blocks.map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact />)}</div></div>;
}

function ComparisonLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const midpoint = Math.ceil(blocks.length / 2);
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><Message>{slide.mainMessage}</Message><div style={{ display: 'grid', gridTemplateColumns: '1fr 128px 1fr', gap: PPT_HTML_GRID.gutter, marginTop: 34, alignItems: 'stretch' }}><Column title="Current state" blocks={blocks.slice(0, midpoint)} startIndex={0} /><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, fontSize: 76, fontWeight: 800 }}>{'>'}</div><Column title="Recommended state" blocks={blocks.slice(midpoint)} startIndex={midpoint} /></div></div>;
}

function Column({ title, blocks, startIndex }: { title: string; blocks: SlideContentBlock[]; startIndex: number }) {
  return <div style={{ border: '2px solid #D8E1EF', borderRadius: 18, padding: 24 }}><div style={{ color: ACCENT, fontSize: 21, fontWeight: 800, marginBottom: 18 }}>{title}</div><div style={{ display: 'grid', gap: 14 }}>{blocks.map((block, index) => <ContentCard key={block.heading} block={block} index={index + startIndex} compact />)}</div></div>;
}

function RoadmapLayout({ slide, blocks, timeline = false }: { slide: SlidePlan; blocks: SlideContentBlock[]; timeline?: boolean }) {
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><Message>{slide.mainMessage}</Message><div style={{ position: 'relative', display: 'flex', gap: PPT_HTML_GRID.gutter, marginTop: 62, paddingTop: 34 }}><div style={{ position: 'absolute', left: 42, right: 42, top: 56, height: 6, background: '#CFE0FA' }} />{blocks.map((block, index) => <div key={block.heading} style={{ position: 'relative', zIndex: 1, flex: 1 }}><div style={{ width: timeline ? 84 : 66, height: 66, margin: '0 auto 18px', borderRadius: timeline ? 12 : 999, background: index % 2 === 0 ? NAVY : ACCENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 800 }}>{timeline ? `T${index + 1}` : String(index + 1).padStart(2, '0')}</div><ContentCard block={block} index={index} compact /></div>)}</div></div>;
}

function CycleLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const positions = [[39, 0], [75, 22], [65, 68], [14, 68], [4, 22]];
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><Message>{slide.mainMessage}</Message><div style={{ position: 'relative', height: 420, marginTop: 24 }}><div style={{ position: 'absolute', left: '32%', top: 18, width: '36%', height: 360, border: `6px solid ${ACCENT}`, borderRadius: 999 }} /><div style={{ position: 'absolute', left: '40%', top: 132, width: '20%', height: 126, borderRadius: 999, background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', fontSize: 21, fontWeight: 800, ...textWrapStyle }}>{getDecision(slide)}</div>{blocks.map((block, index) => { const [left, top] = positions[index] ?? positions[0]; return <div key={block.heading} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: 220, minHeight: 94, borderRadius: 16, border: `2px solid ${index % 2 === 0 ? '#CFE0FA' : ACCENT}`, background: '#FFFFFF', padding: 14 }}><div style={{ color: index % 2 === 0 ? NAVY : ACCENT, fontSize: 17, fontWeight: 800, ...textWrapStyle }}>{String(index + 1).padStart(2, '0')} {block.heading}</div><div style={{ marginTop: 7, color: MUTED, fontSize: 13, lineHeight: 1.3, ...textWrapStyle }}>{block.detail}</div></div>; })}</div></div>;
}

function HubLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const positions = [[3, 35], [30, 3], [67, 3], [84, 35], [46, 72]];
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><Message>{slide.mainMessage}</Message><div style={{ position: 'relative', height: 420, marginTop: 24 }}><div style={{ position: 'absolute', left: '38%', top: 112, width: '24%', height: 182, borderRadius: 999, background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 26, fontSize: 26, fontWeight: 800 }}>{getDecision(slide)}</div>{blocks.map((block, index) => { const [left, top] = positions[index] ?? [46, 72]; return <div key={block.heading} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: 232, minHeight: 112, borderRadius: 14, border: '2px solid #CFE0FA', background: index % 2 === 0 ? PALE_BLUE : PALE_ORANGE, padding: 16 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{block.heading}</div><div style={{ marginTop: 8, color: MUTED, fontSize: 14, lineHeight: 1.3 }}>{block.detail}</div></div>; })}</div></div>;
}

function EvidenceDashboardLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const columns = blocks.length >= 5 ? 3 : 2;
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><Message>{slide.mainMessage}</Message><div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: PPT_HTML_GRID.gutter, marginTop: 32 }}><div style={{ display: 'grid', gridTemplateColumns: getHtmlGridColumns(columns), gap: PPT_HTML_GRID.gutter }}>{blocks.map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact />)}</div><div style={{ border: '2px solid #D8E1EF', borderRadius: 18, background: '#FFFFFF', padding: 30 }}><div style={{ color: ACCENT, fontSize: 20, fontWeight: 800 }}>Decision signal</div><div style={{ marginTop: 22, fontSize: 28, fontWeight: 800, lineHeight: 1.28 }}>{getDecision(slide)}</div><div style={{ marginTop: 28, height: 10, borderRadius: 10, background: '#D8E1EF' }}><div style={{ width: '72%', height: '100%', borderRadius: 10, background: NAVY }} /></div><div style={{ marginTop: 14, fontSize: 16, lineHeight: 1.4, color: MUTED }}>Use source-backed measures only. This layout does not invent numeric results.</div></div></div></div>;
}

function PyramidLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop, display: 'flex', gap: 62 }}><div style={{ width: '54%' }}><Message>{slide.mainMessage}</Message><div style={{ marginTop: 32, display: 'grid', gap: 12 }}>{blocks.slice().reverse().map((block, reverseIndex) => { const index = blocks.length - reverseIndex - 1; return <div key={block.heading} style={{ marginLeft: reverseIndex * 34, marginRight: reverseIndex * 34, minHeight: 68, borderRadius: 12, background: index % 2 === 0 ? NAVY : ACCENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '12px 20px', fontSize: 21, fontWeight: 800 }}>{block.heading}</div>; })}</div></div><div style={{ flex: 1, display: 'grid', gap: 12, alignContent: 'center' }}>{blocks.map((block, index) => <div key={block.heading} style={{ borderLeft: `8px solid ${index % 2 === 0 ? NAVY : ACCENT}`, padding: '12px 16px', background: index % 2 === 0 ? PALE_BLUE : PALE_ORANGE }}><div style={{ fontSize: 18, fontWeight: 800 }}>{block.heading}</div><div style={{ marginTop: 5, fontSize: 15, lineHeight: 1.3, color: MUTED }}>{block.detail}</div></div>)}</div></div>;
}

function CaseStoryLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const midpoint = Math.ceil(blocks.length / 2);
  return <div style={{ position: 'absolute', left: PPT_HTML_GRID.outerMargin, right: PPT_HTML_GRID.outerMargin, top: PPT_HTML_GRID.bodyTop }}><Message>{slide.mainMessage}</Message><div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.9fr 1.25fr', gap: PPT_HTML_GRID.gutter, marginTop: 34 }}><Column title="Evidence" blocks={blocks.slice(0, midpoint)} startIndex={0} /><div style={{ borderRadius: 18, background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 30, fontSize: 26, fontWeight: 800 }}>{getDecision(slide)}</div><Column title="Implication" blocks={blocks.slice(midpoint)} startIndex={midpoint} /></div></div>;
}

import type { CSSProperties } from 'react';
import type { SlideContentBlock, SlidePlan, StyleReference, TemplateDesignProfile } from '@/types/models/pptMaker.model';

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const NAVY = 'var(--ppt-primary, #0B2454)';
const ACCENT = 'var(--ppt-accent, #FE6621)';
const MUTED = '#5F6F89';
const PALE_BLUE = 'var(--ppt-primary-surface, #EFF5FE)';
const PALE_ORANGE = 'var(--ppt-accent-surface, #FFF5E8)';

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
  exportMode?: boolean;
  previewScale?: number;
  className?: string;
}

export function PptHtmlSlide({ slide, logoImageDataUrl, styleReference, exportMode = false, previewScale = 0.5, className }: PptHtmlSlideProps) {
  const objective = slide.objective || slide.subtitle;
  const decision = slide.decision || slide.takeaway;
  const templateDesign = styleReference?.templateDesign ?? defaultTemplateDesign;
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
  } as CSSProperties;

  const content = (
    <div className={className} data-pptx-slide={exportMode ? String(slide.pageNumber) : undefined} style={exportMode ? surfaceStyle : { ...surfaceStyle, transform: `scale(${previewScale})` }}>
      <div style={{ position: 'absolute', left: 74, top: 68, width: 12, height: 176, borderRadius: 6, background: ACCENT }} />
      <div style={{ position: 'absolute', left: 116, top: 72, width: 1260 }}>
        <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1.1 }}>{slide.title}</div>
        <div style={{ marginTop: 16, fontSize: 23, lineHeight: 1.35, color: MUTED }}>{slide.subtitle}</div>
        <div style={{ marginTop: 16, maxWidth: 1040, fontSize: 19, fontWeight: 700, lineHeight: 1.35, color: NAVY }}>{objective}</div>
      </div>
      <Logo logoImageDataUrl={logoImageDataUrl} />
      <VisualLayout slide={slide} />
      <div style={{ position: 'absolute', left: 72, right: 72, bottom: 122, height: 2, background: '#D8E1EF' }} />
      <div style={{ position: 'absolute', left: 74, bottom: 78, width: 1450, fontSize: 19, lineHeight: 1.25, color: MUTED }}>{slide.takeaway}</div>
      <div style={{ position: 'absolute', left: 74, bottom: 40, width: 1450, fontSize: 21, fontWeight: 800, lineHeight: 1.2 }}>{decision}</div>
      <div style={{ position: 'absolute', right: 72, bottom: 32, width: 58, height: 58, borderRadius: 999, background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800 }}>{String(slide.pageNumber).padStart(2, '0')}</div>
    </div>
  );

  return exportMode ? content : <div style={{ width: SLIDE_WIDTH * previewScale, height: SLIDE_HEIGHT * previewScale, overflow: 'hidden' }}>{content}</div>;
}

function Logo({ logoImageDataUrl }: { logoImageDataUrl?: string }) {
  return <div style={{ position: 'absolute', right: 72, top: 62, width: 168, height: 54, border: logoImageDataUrl ? 'none' : '1px solid #D8E1EF', borderRadius: 8, color: '#85878A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>{logoImageDataUrl ? <img src={logoImageDataUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '\uB85C\uACE0'}</div>;
}

function getBlocks(slide: SlidePlan): SlideContentBlock[] {
  if (slide.contentBlocks?.length > 0) return slide.contentBlocks.slice(0, 5);
  return slide.labels.slice(0, 5).map((heading) => ({ heading, detail: slide.mainMessage }));
}

function getDecision(slide: SlidePlan): string {
  return slide.decision || slide.takeaway;
}

function VisualLayout({ slide }: { slide: SlidePlan }) {
  const blocks = getBlocks(slide);
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

function Message({ children, dark = false }: { children: string; dark?: boolean }) {
  return <div style={{ color: dark ? '#FFFFFF' : NAVY, fontSize: 28, fontWeight: 750, lineHeight: 1.28 }}>{children}</div>;
}

function ContentCard({ block, index, numbered = false, compact = false }: { block: SlideContentBlock; index: number; numbered?: boolean; compact?: boolean }) {
  return <div style={{ flex: 1, minWidth: 0, minHeight: compact ? 132 : 194, border: `2px solid ${index % 2 === 0 ? '#CFE0FA' : '#FFD9BC'}`, borderRadius: 16, background: index % 2 === 0 ? PALE_BLUE : PALE_ORANGE, padding: compact ? '18px 20px' : '22px 24px', display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: 999, background: index % 2 === 0 ? NAVY : ACCENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>{numbered ? String(index + 1).padStart(2, '0') : String(index + 1)}</div><div style={{ fontSize: compact ? 20 : 23, fontWeight: 800, lineHeight: 1.16 }}>{block.heading}</div></div>
    <div style={{ fontSize: compact ? 15 : 17, color: MUTED, lineHeight: 1.36 }}>{block.detail}</div>
    <div style={{ marginTop: 'auto', width: 64, height: 4, borderRadius: 8, background: index % 2 === 0 ? NAVY : ACCENT }} />
  </div>;
}

function CardGridLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const columns = blocks.length >= 5 ? 3 : blocks.length;
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332 }}><Message>{slide.mainMessage}</Message><div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 22, marginTop: 38 }}>{blocks.map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact={blocks.length > 3} />)}</div></div>;
}

function HeroLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332, display: 'flex', gap: 56, alignItems: 'center' }}><div style={{ width: '55%' }}><Message>{slide.mainMessage}</Message><div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{blocks.slice(0, 4).map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact />)}</div></div><div style={{ flex: 1, height: 420, borderRadius: 999, border: `7px solid ${ACCENT}`, background: PALE_ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 52 }}><div><div style={{ width: 112, height: 112, borderRadius: 999, background: NAVY, color: '#FFFFFF', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42 }}>+</div><div style={{ fontSize: 29, fontWeight: 800, lineHeight: 1.2 }}>{getDecision(slide)}</div></div></div></div>;
}

function EmphasisLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332 }}><div style={{ borderRadius: 28, background: NAVY, padding: '58px 84px', textAlign: 'center' }}><Message dark>{slide.mainMessage}</Message></div><div style={{ display: 'flex', gap: 22, marginTop: 34 }}>{blocks.slice(0, 4).map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact />)}</div></div>;
}

function ComparisonLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const midpoint = Math.ceil(blocks.length / 2);
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332 }}><Message>{slide.mainMessage}</Message><div style={{ display: 'grid', gridTemplateColumns: '1fr 128px 1fr', gap: 26, marginTop: 34, alignItems: 'stretch' }}><Column title="Current state" blocks={blocks.slice(0, midpoint)} startIndex={0} /><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, fontSize: 76, fontWeight: 800 }}>{'>'}</div><Column title="Recommended state" blocks={blocks.slice(midpoint)} startIndex={midpoint} /></div></div>;
}

function Column({ title, blocks, startIndex }: { title: string; blocks: SlideContentBlock[]; startIndex: number }) {
  return <div style={{ border: '2px solid #D8E1EF', borderRadius: 18, padding: 24 }}><div style={{ color: ACCENT, fontSize: 21, fontWeight: 800, marginBottom: 18 }}>{title}</div><div style={{ display: 'grid', gap: 14 }}>{blocks.map((block, index) => <ContentCard key={block.heading} block={block} index={index + startIndex} compact />)}</div></div>;
}

function RoadmapLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332 }}><Message>{slide.mainMessage}</Message><div style={{ position: 'relative', display: 'flex', gap: 18, marginTop: 62, paddingTop: 34 }}><div style={{ position: 'absolute', left: 42, right: 42, top: 56, height: 6, background: '#CFE0FA' }} />{blocks.map((block, index) => <div key={block.heading} style={{ position: 'relative', zIndex: 1, flex: 1 }}><div style={{ width: 66, height: 66, margin: '0 auto 18px', borderRadius: 999, background: index % 2 === 0 ? NAVY : ACCENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 800 }}>{String(index + 1).padStart(2, '0')}</div><ContentCard block={block} index={index} compact /></div>)}</div></div>;
}

function HubLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const positions = [[3, 35], [30, 3], [67, 3], [84, 35], [46, 72]];
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332 }}><Message>{slide.mainMessage}</Message><div style={{ position: 'relative', height: 420, marginTop: 24 }}><div style={{ position: 'absolute', left: '38%', top: 112, width: '24%', height: 182, borderRadius: 999, background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 26, fontSize: 26, fontWeight: 800 }}>{getDecision(slide)}</div>{blocks.map((block, index) => { const [left, top] = positions[index] ?? [46, 72]; return <div key={block.heading} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: 232, minHeight: 112, borderRadius: 14, border: '2px solid #CFE0FA', background: index % 2 === 0 ? PALE_BLUE : PALE_ORANGE, padding: 16 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{block.heading}</div><div style={{ marginTop: 8, color: MUTED, fontSize: 14, lineHeight: 1.3 }}>{block.detail}</div></div>; })}</div></div>;
}

function EvidenceDashboardLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332 }}><Message>{slide.mainMessage}</Message><div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 24, marginTop: 32 }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>{blocks.slice(0, 4).map((block, index) => <ContentCard key={block.heading} block={block} index={index} compact />)}</div><div style={{ border: '2px solid #D8E1EF', borderRadius: 18, background: '#FFFFFF', padding: 30 }}><div style={{ color: ACCENT, fontSize: 20, fontWeight: 800 }}>Decision signal</div><div style={{ marginTop: 22, fontSize: 28, fontWeight: 800, lineHeight: 1.28 }}>{getDecision(slide)}</div><div style={{ marginTop: 28, height: 10, borderRadius: 10, background: '#D8E1EF' }}><div style={{ width: '72%', height: '100%', borderRadius: 10, background: NAVY }} /></div><div style={{ marginTop: 14, fontSize: 16, lineHeight: 1.4, color: MUTED }}>Use source-backed measures only. This layout does not invent numeric results.</div></div></div></div>;
}

function PyramidLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332, display: 'flex', gap: 62 }}><div style={{ width: '54%' }}><Message>{slide.mainMessage}</Message><div style={{ marginTop: 32, display: 'grid', gap: 12 }}>{blocks.slice().reverse().map((block, reverseIndex) => { const index = blocks.length - reverseIndex - 1; return <div key={block.heading} style={{ marginLeft: reverseIndex * 34, marginRight: reverseIndex * 34, minHeight: 68, borderRadius: 12, background: index % 2 === 0 ? NAVY : ACCENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '12px 20px', fontSize: 21, fontWeight: 800 }}>{block.heading}</div>; })}</div></div><div style={{ flex: 1, display: 'grid', gap: 12, alignContent: 'center' }}>{blocks.map((block, index) => <div key={block.heading} style={{ borderLeft: `8px solid ${index % 2 === 0 ? NAVY : ACCENT}`, padding: '12px 16px', background: index % 2 === 0 ? PALE_BLUE : PALE_ORANGE }}><div style={{ fontSize: 18, fontWeight: 800 }}>{block.heading}</div><div style={{ marginTop: 5, fontSize: 15, lineHeight: 1.3, color: MUTED }}>{block.detail}</div></div>)}</div></div>;
}

function CaseStoryLayout({ slide, blocks }: { slide: SlidePlan; blocks: SlideContentBlock[] }) {
  const midpoint = Math.ceil(blocks.length / 2);
  return <div style={{ position: 'absolute', left: 92, right: 92, top: 332 }}><Message>{slide.mainMessage}</Message><div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.9fr 1.25fr', gap: 24, marginTop: 34 }}><Column title="Evidence" blocks={blocks.slice(0, midpoint)} startIndex={0} /><div style={{ borderRadius: 18, background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 30, fontSize: 26, fontWeight: 800 }}>{getDecision(slide)}</div><Column title="Implication" blocks={blocks.slice(midpoint)} startIndex={midpoint} /></div></div>;
}

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PptHtmlSlide } from '@/components/pptMaker/PptHtmlSlide';
import { getTemplateDesignProfile } from '@/mocks/pptTemplates.mock';
import type { SlidePlan, SlideVisualStructure } from '@/types/models/pptMaker.model';

const slide: SlidePlan = {
  id: 'slide-1',
  pageNumber: 1,
  archetype: 'process',
  visualStructure: 'numbered-process',
  title: 'Editable process layout',
  subtitle: 'The browser preview and export use this same slide JSON.',
  objective: 'Show how a structured plan becomes an editable presentation.',
  mainMessage: 'Plan the content first, then render a structure that fits the message.',
  labels: ['Plan', 'Design', 'Export'],
  contentBlocks: [
    { heading: 'Plan', detail: 'Define the audience decision and evidence before choosing a layout.' },
    { heading: 'Design', detail: 'Select a visual structure that makes the argument easy to scan.' },
    { heading: 'Export', detail: 'Convert the same HTML/CSS content into editable PowerPoint objects.' },
  ],
  decision: 'Approve the structured deck before exporting the final PPTX.',
  takeaway: 'The slide is created without a generated image layer.',
  imageSlot: { id: 'legacy-slot', purpose: 'Legacy field', placement: 'right-hero', prompt: 'Unused' },
  imagePrompt: 'Unused',
};

describe('PptHtmlSlide', () => {
  it('renders editable Slide JSON content and labels for preview', () => {
    render(<PptHtmlSlide slide={slide} />);
    expect(screen.getByText('Editable process layout')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('로고')).toBeInTheDocument();
  });

  it('marks export surfaces as PPTX slide targets', () => {
    const { container } = render(<PptHtmlSlide slide={slide} exportMode />);
    expect(container.querySelector('[data-pptx-slide="1"]')).toBeInTheDocument();
  });

  it('renders an inferred cycle as an editable diagram layout', () => {
    const { container } = render(<PptHtmlSlide slide={{ ...slide, pageNumber: 3, diagram: { type: 'cycle', rationale: 'The copy describes an iterative review loop.', nodes: ['Plan', 'Design', 'Export'] } }} totalSlides={6} />);

    expect(container.querySelector('[data-diagram-type="cycle"]')).toBeInTheDocument();
    expect(screen.getByText('01 Plan')).toBeInTheDocument();
  });

  it('renders a source-grounded comparison table with the key result highlighted', () => {
    const { container } = render(<PptHtmlSlide slide={{
      ...slide,
      pageNumber: 3,
      comparisonTable: {
        rationale: 'The slide compares current and target operations.',
        columnHeaders: ['Criterion', 'Current state', 'Recommended state'],
        rows: [
          { criterion: 'Review time', values: ['10 days', '2 days'], emphasis: 'difference' },
          { criterion: 'Decision owner', values: ['Unclear', 'Named'], emphasis: 'key-result' },
        ],
        highlightedRowIndex: 0,
        keyResult: 'Named ownership makes the operating difference actionable.',
      },
    }} totalSlides={6} />);

    expect(container.querySelector('[data-comparison-table="true"]')).toBeInTheDocument();
    expect(screen.getByText('Review time')).toBeInTheDocument();
    expect(container.querySelector('[data-table-emphasis="difference"]')).toBeInTheDocument();
  });

  it('renders a source-backed chart recommendation as an editable chart layout', () => {
    const { container } = render(<PptHtmlSlide slide={{
      ...slide,
      pageNumber: 3,
      chart: {
        purpose: 'trend', type: 'line', rationale: 'Quarterly source values show a trend.',
        series: [{ label: 'Q1', value: 28 }, { label: 'Q2', value: 46 }, { label: 'Q3', value: 72 }],
        targetValue: null, highlightedIndex: 2, unit: '%', keyResult: 'Q3: 72%',
      },
    }} totalSlides={6} />);

    expect(container.querySelector('[data-chart-type="line"]')).toBeInTheDocument();
    expect(screen.getByText('Q3: 72%')).toBeInTheDocument();
  });

  it('promotes an important metric with its source-backed change statement', () => {
    const { container } = render(<PptHtmlSlide slide={{
      ...slide,
      pageNumber: 3,
      keyMetric: {
        label: 'Adoption', displayValue: '72%', numericValue: 72, changeText: '+18%', direction: 'up',
        comparisonText: 'Adoption increased by 18% after the governed rollout.', rationale: 'Largest source-backed KPI.',
      },
    }} totalSlides={6} />);

    expect(container.querySelector('[data-key-metric-layout="true"]')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('+ 18%')).toBeInTheDocument();
  });

  it('keeps a process diagram visible when the same slide also has a key metric', () => {
    const { container } = render(<PptHtmlSlide slide={{
      ...slide,
      pageNumber: 3,
      diagram: { type: 'process', rationale: 'The copy describes an ordered workflow.', nodes: ['Plan', 'Design', 'Export'] },
      keyMetric: {
        label: 'Adoption', displayValue: '72%', numericValue: 72, changeText: '+18%', direction: 'up',
        comparisonText: 'The rollout achieved the adoption target.', rationale: 'The metric confirms process progress.',
      },
    }} totalSlides={6} />);

    expect(container.querySelector('[data-diagram-type="process"]')).toBeInTheDocument();
    expect(container.querySelector('[data-key-metric-layout="true"]')).not.toBeInTheDocument();
  });

  it('reuses the agenda master for a planned deck navigation slide', () => {
    const { container } = render(
      <PptHtmlSlide
        slide={{ ...slide, pageNumber: 2, masterLayout: 'agenda' }}
        totalSlides={6}
      />,
    );

    expect(container.querySelector('[data-pptx-master="agenda"]')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
  });

  it('shows a short citation only when the slide is linked to a source record', () => {
    render(<PptHtmlSlide slide={{ ...slide, sourceIds: ['source-1'] }} sourceReferences={[{ id: 'source-1', sourceName: 'OECD', documentName: 'AI Outlook', publicationYear: 2025, url: 'https://example.com/oecd', verifiedAt: '2026-07-31', metadataStatus: 'complete' }]} />);

    expect(screen.getByText('Source: OECD - AI Outlook (2025)')).toBeInTheDocument();
  });

  it('uses selected template colors for the preview and export surface', () => {
    const { container } = render(<PptHtmlSlide slide={slide} styleReference={{ id: 'template-12', name: 'Crimson Challenge Solution', notes: '', primaryColorLabel: 'plum', accentColorLabel: 'crimson', templateDesign: getTemplateDesignProfile('template-12') }} />);
    const surface = container.querySelector<HTMLElement>('[style*="--ppt-primary"]');

    expect(surface?.getAttribute('style')).toContain('--ppt-primary: #4A073F');
    expect(surface?.getAttribute('style')).toContain('--ppt-accent: #FF4D3D');
    expect(surface?.getAttribute('style')).toContain('--ppt-accent-foreground: #4A073F');
  });

  it('keeps all five detailed proof points in a hero layout', () => {
    const detailedSlide: SlidePlan = {
      ...slide,
      visualStructure: 'hero-visual',
      contentBlocks: [
        { heading: 'First proof', detail: 'The first proof point provides context for the decision.' },
        { heading: 'Second proof', detail: 'The second proof point explains the relevant evidence.' },
        { heading: 'Third proof', detail: 'The third proof point establishes the operating implication.' },
        { heading: 'Fourth proof', detail: 'The fourth proof point identifies the accountable owner.' },
        { heading: 'Fifth proof', detail: 'The fifth proof point makes the next action explicit.' },
      ],
      labels: ['First proof', 'Second proof', 'Third proof', 'Fourth proof', 'Fifth proof'],
    };

    render(<PptHtmlSlide slide={detailedSlide} />);

    expect(screen.getByText('Fifth proof')).toBeInTheDocument();
  });

  it.each<SlideVisualStructure>([
    'hero-visual',
    'message-emphasis',
    'card-grid',
    'side-by-side-comparison',
    'numbered-process',
    'before-after-mapping',
    'hub-and-spoke',
    'metrics-dashboard',
    'roadmap',
    'pyramid-framework',
    'case-story',
    'closing-commitment',
  ])('renders every detailed proof point in the %s layout', (visualStructure) => {
    const proofPoints = Array.from({ length: 5 }, (_, index) => ({
      heading: `Proof point ${index + 1}`,
      detail: `Evidence ${index + 1} connects the claim to a concrete decision, accountable owner, and next action for the audience.`,
    }));
    const detailedSlide: SlidePlan = {
      ...slide,
      visualStructure,
      title: `Detailed evidence in ${visualStructure}`,
      contentBlocks: proofPoints,
      labels: proofPoints.map(({ heading }) => heading),
    };

    render(<PptHtmlSlide slide={detailedSlide} />);

    expect(screen.getAllByText('Proof point 5')).not.toHaveLength(0);
    expect(screen.getAllByText('Evidence 5 connects the claim to a concrete decision, accountable owner, and next action for the audience.')).not.toHaveLength(0);
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PptHtmlSlide } from '@/components/pptMaker/PptHtmlSlide';
import { getTemplateDesignProfile } from '@/mocks/pptTemplates.mock';
import type { SlidePlan } from '@/types/models/pptMaker.model';

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

  it('uses selected template colors for the preview and export surface', () => {
    const { container } = render(<PptHtmlSlide slide={slide} styleReference={{ id: 'template-12', name: 'Crimson Challenge Solution', notes: '', primaryColorLabel: 'plum', accentColorLabel: 'crimson', templateDesign: getTemplateDesignProfile('template-12') }} />);
    const surface = container.querySelector<HTMLElement>('[style*="--ppt-primary"]');

    expect(surface?.getAttribute('style')).toContain('--ppt-primary: #4A073F');
    expect(surface?.getAttribute('style')).toContain('--ppt-accent: #FF4D3D');
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
});

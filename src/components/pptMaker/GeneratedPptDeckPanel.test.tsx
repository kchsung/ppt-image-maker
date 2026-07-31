import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PptDeckPlan } from '@/types/models/pptMaker.model';
import { createMockDeckPlan } from '@/mocks/pptMaker.mock';
import { GeneratedPptDeckPanel } from './GeneratedPptDeckPanel';

describe('GeneratedPptDeckPanel', () => {
  it('renders non-blocking redundancy recommendations for editorial review', () => {
    const deck = createMockDeckPlan();
    const deckPlan: PptDeckPlan = {
      ...deck,
      slides: deck.slides.map((slide, index) => index === 0
        ? {
            ...slide,
            visualStructure: 'metrics-dashboard',
            layoutSelection: {
              classification: 'data',
              family: 'data',
              rationale: 'Classified as data because the content interprets measures or evidence; selected metrics-dashboard.',
            },
          }
        : slide),
      copyQa: {
        ...deck.copyQa,
        redundancySuggestions: [
          {
            id: 'slides-1-2-title-merge',
            slideNumbers: [1, 2],
            kind: 'title',
            action: 'merge',
            confidence: 0.76,
            summary:
              'Slides 1 and 2 use a similar decision message. Combine overlapping evidence or clarify each slide role.',
          },
        ],
        coverageSuggestions: [
          {
            id: 'coverage-kpi-after-1',
            problemSlideNumbers: [1],
            kind: 'kpi',
            severity: 'recommended',
            recommendedSlideRole: 'evidence',
            recommendedVisualStructure: 'metrics-dashboard',
            summary:
              'No success measure is defined. Add source-backed KPIs, targets, or qualitative review criteria that show whether the solution is working.',
          },
        ],
      },
    };

    render(
      <GeneratedPptDeckPanel
        deckPlan={deckPlan}
        documentEnhancement={null}
        onExportPptx={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Redundancy review' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Slides 1 and 2')).toBeInTheDocument();
    expect(screen.getByText('Merge')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Slides 1 and 2 use a similar decision message. Combine overlapping evidence or clarify each slide role.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Missing content review' }),
    ).toBeInTheDocument();
    expect(screen.getByText('KPI / measure after slide 1')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getAllByText('data')).toHaveLength(2);
  });
});

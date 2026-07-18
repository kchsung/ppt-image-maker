import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PptSlidePreview } from '@/components/pptMaker/PptSlidePreview';

describe('PptSlidePreview', () => {
  it('renders the approved editable copy over the generated visual', () => {
    render(
      <PptSlidePreview
        alt="Slide 1 PPT preview"
        image={{
          id: 'image-1',
          slideId: 'slide-1',
          pageNumber: 1,
          title: 'Title',
          imageDataUrl: 'data:image/png;base64,AAA',
          prompt: 'Slide image',
          provider: 'mock',
        }}
        layout={{
          pageNumber: 1,
          visualStrategy: 'rebuild-with-editables',
          imageLayer: { strategy: 'full-slide-reference', x: 0, y: 0, w: 13.333, h: 7.5 },
          shapes: [],
          placementConfidence: 95,
          qaChecks: [],
          textBlocks: [
            { id: 'title', role: 'title', text: 'Approved title', x: 0.8, y: 0.5, w: 6, h: 0.6, fontSize: 26, bold: true },
          ],
        }}
      />,
    );

    expect(screen.getByAltText('Slide 1 PPT preview')).toBeInTheDocument();
    expect(screen.getByText('Approved title')).toBeInTheDocument();
  });

  it('does not add editable text to image-fallback slides', () => {
    render(
      <PptSlidePreview
        alt="Fallback PPT preview"
        image={{
          id: 'image-1',
          slideId: 'slide-1',
          pageNumber: 1,
          title: 'Title',
          imageDataUrl: 'data:image/png;base64,AAA',
          prompt: 'Slide image',
          provider: 'mock',
        }}
        layout={{
          pageNumber: 1,
          visualStrategy: 'image-fallback',
          imageLayer: { strategy: 'full-slide-fallback', x: 0, y: 0, w: 13.333, h: 7.5 },
          shapes: [],
          placementConfidence: 0,
          qaChecks: [],
          textBlocks: [
            { id: 'title', role: 'title', text: 'Hidden title', x: 0.8, y: 0.5, w: 6, h: 0.6, fontSize: 26 },
          ],
        }}
      />,
    );

    expect(screen.queryByText('Hidden title')).not.toBeInTheDocument();
  });
});

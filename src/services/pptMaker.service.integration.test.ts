import { afterEach, describe, expect, it, vi } from 'vitest';
import { samplePptMakerRequest } from '@/mocks/pptMaker.mock';
import type {
  DeckStrategy,
  PptDeckBlueprint,
  PptDeckPlan,
  PptMakerRequest,
  SlideArchetype,
  SlidePlan,
  SlideVisualStructure,
} from '@/types/models/pptMaker.model';

const visualSequence: SlideVisualStructure[] = [
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
];

function createStrategy(totalSlides: number): DeckStrategy {
  return {
    coreThesis: 'A governed knowledge model turns company material into accountable AI decisions.',
    audienceNeed: 'Decision makers need a practical path from scattered documents to trusted AI work.',
    desiredOutcome: 'Approve a phased operating model with an accountable pilot owner.',
    narrativeArc: [
      { phase: 'Context', purpose: 'Frame the operating problem.', slideNumbers: [1, 2, 3] },
      { phase: 'Evidence', purpose: 'Build the case for the model.', slideNumbers: Array.from({ length: totalSlides - 6 }, (_, index) => index + 4) },
      { phase: 'Action', purpose: 'Confirm the decision and accountable next step.', slideNumbers: Array.from({ length: 3 }, (_, index) => totalSlides - 2 + index) },
    ],
  };
}

function createBlueprint(totalSlides: number): PptDeckBlueprint {
  const sections = Array.from({ length: totalSlides / 10 }, (_, index) => ({
    id: `section-${index + 1}`,
    title: ['Decision Context', 'Evidence And Operating Model', 'Conclusion And Investor Commitment'][index] ?? `Section ${index + 1}`,
    purpose: `Advance narrative stage ${index + 1} toward the requested decision.`,
    keyMessage: `Section ${index + 1} makes the next part of the investment case explicit.`,
    slideStart: index * 10 + 1,
    slideCount: 10,
    visualFocus: visualSequence.slice(index * 3, index * 3 + 3),
  }));

  return {
    title: 'Accountable AI Knowledge Operating Model',
    strategy: createStrategy(totalSlides),
    sections,
    qaChecks: ['Blueprint sections are contiguous.', 'Every section includes an explicit visual direction.'],
  };
}

function createSlide(pageNumber: number, totalSlides: number): SlidePlan {
  const isFirstSlide = pageNumber === 1;
  const isLastSlide = pageNumber === totalSlides;
  const visualStructure = isFirstSlide
    ? 'hero-visual'
    : isLastSlide
      ? 'closing-commitment'
      : visualSequence[(pageNumber - 1) % visualSequence.length];
  const archetype: SlideArchetype = isFirstSlide ? 'cover' : isLastSlide ? 'closing' : 'card-grid';
  const headings = ['Clarify the decision', 'Connect the evidence', 'Assign the next action'];

  return {
    id: `slide-${pageNumber}`,
    pageNumber,
    archetype,
    visualStructure,
    title: `Stage ${pageNumber} Makes the Next Decision Clear`,
    subtitle: 'A source-grounded view for the accountable operating model.',
    objective: 'Help the audience make a clear and accountable decision from the evidence.',
    mainMessage: `Stage ${pageNumber} turns available knowledge into a distinct decision, owner, and next action.`,
    labels: headings,
    contentBlocks: headings.map((heading) => ({
      heading,
      detail: `${heading} with enough context to explain the claim, evidence, and implication for the audience.`,
    })),
    decision: 'Approve the accountable next action and name the owner for delivery.',
    takeaway: 'A governed workflow turns useful knowledge into decisions the organization can explain and trust.',
    imageSlot: { id: `visual-${pageNumber}`, purpose: 'No image is required for the editable layout.', placement: 'card-visual', prompt: '' },
    imagePrompt: '',
  };
}

function createSectionPlan(request: PptMakerRequest, strategy: DeckStrategy): PptDeckPlan {
  const batch = request.planningBatch;
  if (!batch) throw new Error('Section planning batch is required for this test fixture.');
  return {
    id: `plan-${batch.sectionId}`,
    title: `Section ${batch.sectionId}`,
    createdAt: '2026-07-31T00:00:00.000Z',
    request,
    strategy,
    slides: Array.from(
      { length: batch.slideCount },
      (_, index) => createSlide(batch.startPage + index, batch.totalSlides),
    ),
    copyQa: { status: 'passed', checks: ['Section copy is valid.'], issues: [] },
  };
}

async function loadService(invoke: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  vi.doMock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }));
  return import('@/services/pptMaker.service');
}

describe('pptMakerService remote planning scenario', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/supabase');
    vi.resetModules();
  });

  it('assembles a 30-slide deck from two concurrent, Blueprint-aligned section requests', async () => {
    const blueprint = createBlueprint(30);
    let activeSectionRequests = 0;
    let maximumActiveSectionRequests = 0;
    const sectionRequests: PptMakerRequest[] = [];
    const invoke = vi.fn(async (functionName: string, options: { body: { request: PptMakerRequest } }) => {
      if (functionName === 'generate-ppt-deck-blueprint') return { data: blueprint, error: null };
      if (functionName === 'generate-ppt-slide-plan') {
        const request = options.body.request;
        sectionRequests.push(request);
        activeSectionRequests += 1;
        maximumActiveSectionRequests = Math.max(maximumActiveSectionRequests, activeSectionRequests);
        await new Promise((resolve) => window.setTimeout(resolve, 8));
        activeSectionRequests -= 1;

        const localStrategy: DeckStrategy = {
          ...blueprint.strategy,
          narrativeArc: [{ phase: 'Local section', purpose: 'The planner may return a local-only arc.', slideNumbers: [request.planningBatch!.startPage] }],
        };
        return { data: createSectionPlan(request, localStrategy), error: null };
      }
      throw new Error(`Unexpected function call: ${functionName}`);
    });
    const { pptMakerService } = await loadService(invoke);

    const deck = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 30 });

    expect(invoke.mock.calls.filter(([name]) => name === 'generate-ppt-deck-blueprint')).toHaveLength(1);
    expect(sectionRequests).toHaveLength(3);
    expect(maximumActiveSectionRequests).toBe(2);
    expect(sectionRequests.map((request) => request.planningBatch?.slideCount)).toEqual([10, 10, 10]);
    expect(sectionRequests.find((request) => request.planningBatch?.sectionId === 'section-3')?.planningBatch?.previousSlides)
      .toMatchObject([{ pageNumber: 10 }, { pageNumber: 20 }]);
    expect(deck.strategy).toEqual(blueprint.strategy);
    expect(deck.slides.map((slide) => slide.pageNumber)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect(deck.slides[9].dependency?.nextQuestion).toBe(deck.slides[10].dependency?.questionAddressed);
    expect(deck.slides.at(-1)?.dependency?.nextQuestion).toBeNull();
    expect(deck.slides.at(-1)?.visualStructure).toBe('closing-commitment');
    expect(deck.copyQa.status).toBe('passed');
  });

  it('reports the affected section when a section planning call fails', async () => {
    const blueprint = createBlueprint(20);
    const invoke = vi.fn(async (functionName: string, options: { body: { request: PptMakerRequest } }) => {
      if (functionName === 'generate-ppt-deck-blueprint') return { data: blueprint, error: null };
      if (functionName === 'generate-ppt-slide-plan') {
        const request = options.body.request;
        if (request.planningBatch?.sectionId === 'section-2') {
          return { data: null, error: new Error('The section request was rejected.') };
        }
        return { data: createSectionPlan(request, blueprint.strategy), error: null };
      }
      throw new Error(`Unexpected function call: ${functionName}`);
    });
    const { pptMakerService } = await loadService(invoke);

    await expect(pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 20 }))
      .rejects.toThrow('Slide copy planning failed for section "Evidence And Operating Model": The section request was rejected.');
  });

  it('rejects a complete-looking deck when section pages cannot be assembled contiguously', async () => {
    const blueprint = createBlueprint(20);
    const invoke = vi.fn(async (functionName: string, options: { body: { request: PptMakerRequest } }) => {
      if (functionName === 'generate-ppt-deck-blueprint') return { data: blueprint, error: null };
      if (functionName === 'generate-ppt-slide-plan') {
        const plan = createSectionPlan(options.body.request, blueprint.strategy);
        if (options.body.request.planningBatch?.sectionId === 'section-2') {
          return {
            data: {
              ...plan,
              slides: plan.slides.map((slide, index) => index === 0 ? { ...slide, pageNumber: 10 } : slide),
            },
            error: null,
          };
        }
        return { data: plan, error: null };
      }
      throw new Error(`Unexpected function call: ${functionName}`);
    });
    const { pptMakerService } = await loadService(invoke);

    await expect(pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 20 }))
      .rejects.toThrow('Deck assembly requires page 11 exactly once and in order.');
  });

  it('keeps a 100-slide request bounded to ten section calls and two active planners', async () => {
    const blueprint = createBlueprint(100);
    let activeSectionRequests = 0;
    let maximumActiveSectionRequests = 0;
    const invoke = vi.fn(async (functionName: string, options: { body: { request: PptMakerRequest } }) => {
      if (functionName === 'generate-ppt-deck-blueprint') return { data: blueprint, error: null };
      if (functionName === 'generate-ppt-slide-plan') {
        activeSectionRequests += 1;
        maximumActiveSectionRequests = Math.max(maximumActiveSectionRequests, activeSectionRequests);
        await new Promise((resolve) => window.setTimeout(resolve, 3));
        activeSectionRequests -= 1;
        return { data: createSectionPlan(options.body.request, blueprint.strategy), error: null };
      }
      throw new Error(`Unexpected function call: ${functionName}`);
    });
    const { pptMakerService } = await loadService(invoke);

    const deck = await pptMakerService.generateDeckPlan({ ...samplePptMakerRequest, slideCount: 100 });

    expect(invoke.mock.calls.filter(([name]) => name === 'generate-ppt-slide-plan')).toHaveLength(10);
    expect(maximumActiveSectionRequests).toBe(2);
    expect(deck.slides).toHaveLength(100);
    expect(deck.slides.at(-1)?.pageNumber).toBe(100);
    expect(deck.slides.at(-1)?.visualStructure).toBe('closing-commitment');
  });
});

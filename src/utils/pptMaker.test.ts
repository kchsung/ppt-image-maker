import { describe, expect, it } from 'vitest';
import {
  createSlideTitle,
  deriveSlideDiagram,
  deriveSlideComparisonTable,
  deriveSlideChart,
  deriveSlideKeyMetric,
  compactEditableCopy,
  compressSlideCopyForLayout,
  getDeckAssemblyQaIssues,
  extractKeywords,
  getDeckCopyQaIssues,
  getDeckCoverageSuggestions,
  getDeckRedundancySuggestions,
  getLayoutFamily,
  selectSlideMasterLayout,
  improveSlideTitle,
  linkSlideDependencies,
  selectVisualStructure,
  selectContentAwareLayout,
  splitIntoSlideSeeds,
  summarizeText,
} from '@/utils/pptMaker';
import { createMockDeckPlan, samplePptMakerRequest } from '@/mocks/pptMaker.mock';

describe('pptMaker utilities', () => {
  it('splits source text into the requested number of slide seeds', () => {
    const seeds = splitIntoSlideSeeds(
      'AI changes execution. Human judgment still matters. Teams need workflows. Validation creates trust.',
      3,
    );

    expect(seeds).toHaveLength(3);
    expect(seeds[0]).toContain('AI changes execution');
  });

  it('extracts useful keywords from source text', () => {
    const keywords = extractKeywords('AI judgment judgment workflow validation validation validation', 2);

    expect(keywords).toEqual(['Validation', 'Judgment']);
  });

  it('creates a language-aware slide title', () => {
    expect(createSlideTitle('AI judgment creates better workflow', 'English', 2)).toContain('Moves From');
    expect(createSlideTitle('AI 판단과 실행 기준을 정리합니다', 'Korean', 2)).toContain('전환하기');
  });

  it('selects layouts from the actual content classification before applying visual styling', () => {
    const baseSlide = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 }).slides[1];
    const cases = [
      {
        title: 'Compare Two Operating Models',
        mainMessage: 'Compare the trade-offs between the two alternatives before selecting an operating model.',
        expected: ['comparison', ['side-by-side-comparison', 'before-after-mapping', 'card-grid']],
      },
      {
        title: 'Roll Out The Workflow In Three Steps',
        mainMessage: 'The implementation process moves from preparation through validation to a controlled rollout.',
        expected: ['process', ['numbered-process', 'roadmap', 'hub-and-spoke']],
      },
      {
        title: 'Milestones Through Next Year',
        mainMessage: 'The roadmap organizes milestones by quarter and shows the delivery timeline.',
        expected: ['timeline', ['roadmap', 'numbered-process', 'case-story']],
      },
      {
        title: 'Capabilities Form One Operating System',
        mainMessage: 'The system architecture connects capabilities and governance into one structure.',
        expected: ['structure', ['hub-and-spoke', 'pyramid-framework', 'card-grid']],
      },
      {
        title: 'Measure Adoption And Review Quality',
        mainMessage: 'The KPI dashboard tracks source coverage, review completion, and decision cycle time.',
        expected: ['data', ['metrics-dashboard', 'side-by-side-comparison', 'card-grid']],
      },
      {
        title: 'A Pilot Team Shows The Change',
        mainMessage: 'This customer case shows how one pilot team moved from manual review to a governed workflow.',
        expected: ['case', ['case-story', 'before-after-mapping', 'side-by-side-comparison']],
      },
    ] as const;

    cases.forEach((entry) => {
      const selection = selectContentAwareLayout(
        { ...baseSlide, title: entry.title, mainMessage: entry.mainMessage },
        { index: 1, totalSlides: 6 },
      );

      expect(selection.layoutSelection.classification).toBe(entry.expected[0]);
      expect(entry.expected[1]).toContain(selection.visualStructure);
    });
  });

  it('does not repeat a card layout family beside another card layout', () => {
    const slide = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 }).slides[1];
    const selection = selectContentAwareLayout(
      {
        ...slide,
        title: 'One Executive Decision Needs Emphasis',
        mainMessage: 'The executive team should approve the evidence review standard before the rollout begins.',
        slideRole: 'context',
      },
      {
        index: 2,
        totalSlides: 6,
        previousStructure: 'card-grid',
        templateRecommendedStructures: ['card-grid'],
      },
    );

    expect(selection.visualStructure).not.toBe('card-grid');
    expect(selection.layoutSelection.family).not.toBe('card');
    expect(getLayoutFamily(selection.visualStructure)).toBe(selection.layoutSelection.family);
  });

  it('derives process, cycle, hierarchy, timeline, relationship, and change diagrams from slide context', () => {
    const baseSlide = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 6 }).slides[2];
    const cases = [
      ['A controlled workflow', 'The process moves through preparation, review, and rollout.', 'process'],
      ['Continuous improvement', 'A feedback loop repeats review and learning every cycle.', 'cycle'],
      ['Capability foundation', 'The hierarchy builds from a foundation to higher capability levels.', 'hierarchy'],
      ['Delivery milestones', 'The roadmap tracks each quarter and milestone through the year.', 'timeline'],
      ['Connected partners', 'The ecosystem links each stakeholder through shared relationships.', 'relationship'],
      ['From manual to governed', 'The before-and-after transition changes the current state into the target state.', 'change'],
    ] as const;

    cases.forEach(([title, mainMessage, type]) => {
      expect(deriveSlideDiagram({ ...baseSlide, title, mainMessage, slideRole: type === 'change' ? 'comparison' : 'solution' }).type).toBe(type);
    });
  });

  it('builds an editable comparison table and highlights a material source-backed difference', () => {
    const baseSlide = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 6 }).slides[2];
    const table = deriveSlideComparisonTable({
      ...baseSlide,
      slideRole: 'comparison',
      labels: ['Current state', 'Target state'],
      contentBlocks: [
        { heading: 'Review time', detail: '10 days' },
        { heading: 'Decision owner', detail: 'Unclear ownership' },
        { heading: 'Review time', detail: '2 days' },
        { heading: 'Decision owner', detail: 'Named owner' },
      ],
    });

    expect(table?.columnHeaders).toEqual(['Criterion', 'Current state', 'Target state']);
    expect(table?.rows[0]).toMatchObject({ criterion: 'Review time', values: ['10 days', '2 days'], emphasis: 'difference' });
    expect(table?.highlightedRowIndex).toBe(0);
  });

  it('recommends chart types from the data communication purpose without inventing values', () => {
    const baseSlide = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 6 }).slides[2];
    const buildChart = (mainMessage: string, details: string[]) => deriveSlideChart({
      ...baseSlide,
      mainMessage,
      contentBlocks: details.map((detail, index) => ({ heading: `Metric ${index + 1}`, detail })),
    });

    expect(buildChart('Compare adoption across business units.', ['North 42%', 'South 68%'])?.type).toBe('bar');
    expect(buildChart('The quarterly trend shows adoption over time.', ['Q1 28%', 'Q2 46%', 'Q3 72%'])?.type).toBe('line');
    expect(buildChart('The composition shows the share of each channel.', ['Direct 60%', 'Partner 40%'])?.type).toBe('donut');
    expect(buildChart('The target progress is 72% against target 90.', ['Adoption 72%'])?.type).toBe('progress');
    expect(buildChart('Evidence is qualitative only.', ['Better governance', 'Clear ownership'])).toBeUndefined();
  });

  it('promotes the most decision-relevant metric and preserves an explicit change rate', () => {
    const baseSlide = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 6 }).slides[2];
    const metric = deriveSlideKeyMetric({
      ...baseSlide,
      contentBlocks: [
        { heading: 'Documentation', detail: '42 source documents are governed.' },
        { heading: 'Adoption KPI', detail: '72% adoption, +18% after the rollout.' },
        { heading: 'Workflow', detail: 'Three review stages are defined.' },
      ],
    });

    expect(metric).toMatchObject({ label: 'Adoption KPI', displayValue: '72%', changeText: '+18%', direction: 'up' });
  });

  it('assigns reusable master layouts from page position, role, and visual structure', () => {
    const baseSlide = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 7 }).slides[1];

    expect(selectSlideMasterLayout({ ...baseSlide, pageNumber: 1, slideRole: 'opening', visualStructure: 'hero-visual' }, 7)).toBe('cover');
    expect(selectSlideMasterLayout({ ...baseSlide, pageNumber: 2, slideRole: 'context', visualStructure: 'message-emphasis' }, 7)).toBe('agenda');
    expect(selectSlideMasterLayout({ ...baseSlide, pageNumber: 3, slideRole: 'comparison', visualStructure: 'side-by-side-comparison' }, 7)).toBe('comparison');
    expect(selectSlideMasterLayout({ ...baseSlide, pageNumber: 4, slideRole: 'evidence', visualStructure: 'metrics-dashboard' }, 7)).toBe('chart');
    expect(selectSlideMasterLayout({ ...baseSlide, pageNumber: 7, slideRole: 'conclusion', visualStructure: 'closing-commitment' }, 7)).toBe('conclusion');
  });

  it('turns a topic-only title into a concise conclusion headline', () => {
    expect(improveSlideTitle('AI Platform', 'Evidence improves decisions.', 'English'))
      .toBe('Evidence improves decisions');
    expect(improveSlideTitle('AI Platform', 'A lengthy supporting message that cannot fit inside the title box without clipping.', 'English'))
      .toBe('AI Platform Enables Better Decisions');
    expect(
      improveSlideTitle('AI 판단과 실행', '이 문장은 제목으로 사용하기에는 충분히 길어서 핵심 결론을 위한 대체 문구가 필요합니다.', 'Korean'),
    ).toBe('AI 판단과 실행으로 실행력을 높입니다');
  });

  it('compresses body copy into title, main-message, and proof-point hierarchy without ellipses', () => {
    const slide = createMockDeckPlan({ ...samplePptMakerRequest, contentDensity: 'detailed', slideCount: 4 }).slides[0];
    const compressed = compressSlideCopyForLayout({
      ...slide,
      title: 'A very long topic label that should never overflow an editable PowerPoint title box',
      mainMessage: 'Evidence-backed workflow design gives teams a reliable way to turn fragmented source material into accountable decisions. The same workflow keeps ownership visible as adoption scales.',
      contentBlocks: slide.contentBlocks.map((block) => ({
        ...block,
        heading: `${block.heading} and accountable operating ownership`,
        detail: 'Teams connect each claim to a traceable source, named owner, decision rule, review checkpoint, and measurable next action before the work is approved.',
      })),
    }, 'English', 'detailed');

    expect(compactEditableCopy('Sentence one fits. Sentence two should not appear.', 20)).toBe('Sentence one fits.');
    expect(compressed.title.length).toBeLessThanOrEqual(42);
    expect(compressed.mainMessage.length).toBeLessThanOrEqual(150);
    expect(compressed.contentBlocks.every((block) => block.heading.length <= 30 && block.detail.length <= 62)).toBe(true);
    expect(compressed.labels).toEqual(compressed.contentBlocks.map((block) => block.heading));
    expect([
      compressed.title,
      compressed.mainMessage,
      ...compressed.contentBlocks.flatMap((block) => [block.heading, block.detail]),
    ].join(' ')).not.toContain('...');
  });

  it('compacts structured visual copy before it reaches table, chart, and metric layouts', () => {
    const slide = createMockDeckPlan({ ...samplePptMakerRequest, contentDensity: 'detailed', slideCount: 4 }).slides[0];
    const compressed = compressSlideCopyForLayout({
      ...slide,
      comparisonTable: {
        rationale: 'This long comparison rationale should remain readable in the editable layout without becoming a second paragraph that competes with the table.',
        columnHeaders: ['Criterion and operating decision', 'Current state with fragmented ownership', 'Target state with accountable ownership'],
        rows: [{ criterion: 'Review timing and owner handoff', values: ['Ten business days with unclear sign-off and recurring rework.', 'Two business days with a named reviewer and decision rule.'], emphasis: 'difference' }],
        highlightedRowIndex: 0,
        keyResult: 'Named ownership converts the review process from a recurring delay into a predictable operating decision.',
      },
      chart: {
        purpose: 'comparison', type: 'bar', rationale: 'This long chart rationale should be compacted for a small chart caption.',
        series: [{ label: 'Adoption across the enterprise operating groups', value: 72 }], targetValue: null, highlightedIndex: 0, unit: '%',
        keyResult: 'The governed rollout produces the strongest adoption result in the available source data.',
      },
      keyMetric: {
        label: 'Enterprise adoption across governed business groups', displayValue: '72% adoption of the governed workflow', numericValue: 72,
        changeText: '+18% after the evidence-backed rollout', direction: 'up',
        comparisonText: 'Adoption increased after teams received a traceable workflow, named reviewers, and a measurable operating cadence.',
        rationale: 'The value is the most decision-relevant metric in the available evidence.',
      },
    }, 'English', 'detailed');

    expect(compressed.comparisonTable?.columnHeaders.every((header) => header.length <= 30)).toBe(true);
    expect(compressed.comparisonTable?.rows[0]?.values.every((value) => value.length <= 62)).toBe(true);
    expect(compressed.chart?.series[0]?.label.length).toBeLessThanOrEqual(30);
    expect(compressed.keyMetric?.label.length).toBeLessThanOrEqual(30);
    expect(compressed.keyMetric?.comparisonText.length).toBeLessThanOrEqual(62);
    expect(JSON.stringify(compressed)).not.toMatch(/(?:\.{2,}|…)/u);
  });

  it('does not add ellipsis when summarizing slide text', () => {
    const summary = summarizeText(
      'This is a very long sentence that should be shortened without adding trailing ellipsis or placeholder dots.',
      45,
    );

    expect(summary).not.toContain('...');
    expect(summary).not.toContain('…');
  });

  it('assigns varied visual structures across a local fallback deck', () => {
    expect(selectVisualStructure(1, 6, 'cover')).toBe('hero-visual');
    expect(selectVisualStructure(2, 6, 'section-opener')).toBe('message-emphasis');
    expect(selectVisualStructure(3, 6, 'card-grid')).toBe('card-grid');
    expect(selectVisualStructure(6, 6, 'closing')).toBe('closing-commitment');
  });

  it('rejects Korean copy when English is requested', () => {
    const issues = getDeckCopyQaIssues({
      request: { ...samplePptMakerRequest, targetLanguage: 'English' },
      slides: [{
        id: 'slide-1',
        pageNumber: 1,
        archetype: 'cover',
        visualStructure: 'hero-visual',
        title: 'Evidence Improves Decisions',
        subtitle: 'English subtitle',
        objective: 'Set the audience decision.',
        mainMessage: '\uD55C\uAE00 \uBB38\uAD6C\uAC00 \uC0AC\uC6A9\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
        labels: ['One', 'Two', 'Three'],
        contentBlocks: [
          { heading: 'One', detail: 'One detailed proof point supports the audience decision.' },
          { heading: 'Two', detail: 'Two detailed proof points support the audience decision.' },
          { heading: 'Three', detail: 'Three detailed proof points support the audience decision.' },
        ],
        decision: 'Approve the next step.',
        takeaway: 'English takeaway.',
        imageSlot: {
          id: 'visual-1',
          purpose: 'Support the title with a text-free visual.',
          placement: 'right-hero',
          prompt: 'Text-free abstract editorial illustration.',
        },
        imagePrompt: '',
      }],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('contains Korean copy while English was requested');
  });

  it('allows the QLEARN for Startup brand name in Korean decks', () => {
    const issues = getDeckCopyQaIssues({
      request: { ...samplePptMakerRequest, targetLanguage: 'Korean' },
      slides: [{
        id: 'slide-1',
        pageNumber: 1,
        archetype: 'cover',
        visualStructure: 'hero-visual',
        title: 'QLEARN for Startup',
        subtitle: 'QLEARN for Startup',
        objective: 'QLEARN for Startup',
        mainMessage: 'QLEARN for Startup',
        labels: ['QLEARN for Startup', 'QLEARN for Startup', 'QLEARN for Startup'],
        contentBlocks: [
          { heading: 'QLEARN for Startup', detail: 'QLEARN for Startup' },
          { heading: 'QLEARN for Startup', detail: 'QLEARN for Startup' },
          { heading: 'QLEARN for Startup', detail: 'QLEARN for Startup' },
        ],
        decision: 'QLEARN for Startup',
        takeaway: 'QLEARN for Startup',
        imageSlot: {
          id: 'visual-1',
          purpose: 'Support the title with a text-free visual.',
          placement: 'right-hero',
          prompt: 'Text-free abstract editorial illustration.',
        },
        imagePrompt: '',
      }],
    });

    expect(issues).toEqual([]);
  });

  it('allows standard uppercase abbreviations such as R&D in Korean decks', () => {
    const issues = getDeckCopyQaIssues({
      request: { ...samplePptMakerRequest, targetLanguage: 'Korean' },
      slides: [{
        id: 'slide-1',
        pageNumber: 1,
        archetype: 'cover',
        visualStructure: 'hero-visual',
        title: 'R&D \uACC4\uD68D\uC11C\ub85c \uc2e4\ud589\ub825\uc744 \ub192\uc785\ub2c8\ub2e4',
        subtitle: 'R&D \uACC4\uD68D\uC11C',
        objective: 'R&D \uACC4\uD68D\uC11C',
        mainMessage: 'R&D \uACC4\uD68D\uC11C',
        labels: ['R&D \uACC4\uD68D\uC11C', 'R&D \uACC4\uD68D\uC11C', 'R&D \uACC4\uD68D\uC11C'],
        contentBlocks: [
          { heading: 'R&D \uACC4\uD68D\uC11C', detail: 'R&D \uACC4\uD68D\uC11C' },
          { heading: 'R&D \uACC4\uD68D\uC11C', detail: 'R&D \uACC4\uD68D\uC11C' },
          { heading: 'R&D \uACC4\uD68D\uC11C', detail: 'R&D \uACC4\uD68D\uC11C' },
        ],
        decision: 'R&D \uACC4\uD68D\uC11C',
        takeaway: 'R&D \uACC4\uD68D\uC11C',
        imageSlot: {
          id: 'visual-1',
          purpose: 'Support the title with a text-free visual.',
          placement: 'right-hero',
          prompt: 'Text-free abstract editorial illustration.',
        },
        imagePrompt: '',
      }],
    });

    expect(issues).toEqual([]);
  });

  it('reports missing fields from legacy slides without throwing', () => {
    const legacyDeck = {
      request: samplePptMakerRequest,
      slides: [{
        id: 'legacy-1',
        pageNumber: 1,
        archetype: 'cover',
        visualStructure: 'hero-visual',
        title: 'Legacy title',
        subtitle: 'Legacy subtitle',
        mainMessage: 'Legacy slides still need a safe quality check.',
        labels: ['One', 'Two', 'Three'],
        takeaway: 'Regenerate this legacy slide with a full plan.',
        imageSlot: { id: 'legacy-visual', purpose: 'Legacy image slot', placement: 'right-hero', prompt: '' },
        imagePrompt: '',
      }],
    };

    expect(() => getDeckCopyQaIssues(legacyDeck as never)).not.toThrow();
    expect(getDeckCopyQaIssues(legacyDeck as never)).toContain('Slide 1 is missing a planning objective or recommended decision.');
  });

  it('rejects a broken assembled deck before layout rendering', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });
    const issues = getDeckAssemblyQaIssues({
      ...deck,
      slides: deck.slides.map((slide) => slide.pageNumber === 3 ? { ...slide, pageNumber: 2 } : slide),
      blueprint: {
        title: deck.title,
        strategy: deck.strategy!,
        qaChecks: [],
        sections: [{
          id: 'decision-context',
          title: 'Decision context',
          purpose: 'Establish the operating decision.',
          keyMessage: 'Evidence needs a clear decision owner.',
          slideStart: 1,
          slideCount: 4,
          visualFocus: ['roadmap'],
        }],
      },
    });

    expect(issues).toContain('Deck assembly requires page 3 exactly once and in order.');
    expect(issues).toContain('Section "Decision context" does not apply its Blueprint visual direction.');
  });

  it('links every slide question to the next slide answer across the assembled deck', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });
    const slides = linkSlideDependencies(deck.slides);

    expect(slides[0].dependency).toMatchObject({ previousSlideNumber: null });
    expect(slides[1].dependency?.previousSlideNumber).toBe(1);
    expect(slides[0].dependency?.nextQuestion).toBe(slides[1].dependency?.questionAddressed);
    expect(slides.at(-1)?.dependency?.nextQuestion).toBeNull();
    expect(getDeckAssemblyQaIssues({ ...deck, slides })).toEqual([]);
  });

  it('rejects a deck when a slide does not answer the preceding slide question', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });
    const slides = linkSlideDependencies(deck.slides).map((slide) => slide.pageNumber === 2
      ? {
          ...slide,
          dependency: { ...slide.dependency!, questionAddressed: 'An unrelated question that breaks the narrative.' },
        }
      : slide);

    expect(getDeckAssemblyQaIssues({ ...deck, slides }))
      .toContain('Slide 2 does not resolve the question handed off by slide 1.');
  });

  it('rejects generic and repeated claims before a deck reaches layout rendering', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });
    const slides = deck.slides.map((slide, index) => index < 2
      ? { ...slide, title: 'Overview', mainMessage: 'This deck explains the strategic opportunity.' }
      : slide);

    const issues = getDeckCopyQaIssues({ ...deck, slides });

    expect(issues).toContain('Slide 1 needs a decision-oriented title instead of "Overview".');
    expect(issues).toContain('Slides 1 and 2 repeat the same title.');
    expect(issues).toContain('Slides 1 and 2 repeat the same main message.');
  });

  it('proposes merge, removal, or role separation for semantically similar slides without blocking copy QA', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });
    const slides = deck.slides.map((slide, index) => {
      if (index === 0) {
        return {
          ...slide,
          title: 'Evidence Builds Trust',
          mainMessage: 'Teams use source-backed workflows to make accountable decisions.',
        };
      }
      if (index === 1) {
        return {
          ...slide,
          title: 'Evidence Strengthens Trust',
          mainMessage: 'Teams use source-backed reviews to make accountable decisions.',
        };
      }
      if (index === 2) {
        return {
          ...slide,
          title: 'Evidence Builds Trust',
          mainMessage: 'Teams use source-backed workflows to make accountable decisions.',
        };
      }
      return slide;
    });

    const suggestions = getDeckRedundancySuggestions(slides);

    expect(suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slideNumbers: [1, 2],
        action: 'merge',
        kind: 'title',
      }),
      expect.objectContaining({
        slideNumbers: [1, 3],
        action: 'remove',
      }),
    ]));
    expect(getDeckCopyQaIssues({ ...deck, slides })).toContain('Slides 1 and 3 repeat the same title.');
  });

  it('flags missing solution, measurement, and expected-impact coverage after a problem is introduced', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });
    const problemOnlySlides = deck.slides.map((slide, index) => index === 0
      ? {
          ...slide,
          slideRole: 'problem-framing' as const,
          title: 'Unverified Outputs Create A Decision Risk',
          mainMessage: 'The current workflow leaves teams with unverified output and unclear accountability.',
        }
      : {
          ...slide,
          slideRole: index === 1 ? 'evidence' as const : index === 2 ? 'comparison' as const : 'context' as const,
          visualStructure: index === 1 ? 'card-grid' as const : slide.visualStructure,
        });

    expect(getDeckCoverageSuggestions(problemOnlySlides)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'solution', severity: 'required', recommendedSlideRole: 'solution' }),
      expect.objectContaining({ kind: 'kpi', recommendedVisualStructure: 'metrics-dashboard' }),
      expect.objectContaining({ kind: 'impact', severity: 'required', recommendedSlideRole: 'conclusion' }),
    ]));

    const completeSlides = problemOnlySlides.map((slide, index) => {
      if (index === 1) {
        return {
          ...slide,
          slideRole: 'solution' as const,
          title: 'A Governed Workflow Resolves The Risk',
          mainMessage: 'The solution assigns source checks, approval ownership, and a clear escalation path.',
        };
      }
      if (index === 2) {
        return {
          ...slide,
          visualStructure: 'metrics-dashboard' as const,
          mainMessage: 'Track review completion, source coverage, and decision cycle time each month.',
        };
      }
      if (index === 3) {
        return {
          ...slide,
          slideRole: 'conclusion' as const,
          mainMessage: 'The expected outcome is faster, more reliable decisions with lower review risk.',
        };
      }
      return slide;
    });

    expect(getDeckCoverageSuggestions(completeSlides)).toEqual([]);
  });

  it('rejects a topic-only title that does not state the slide conclusion', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, slideCount: 4 });
    const slides = deck.slides.map((slide, index) => index === 0
      ? { ...slide, title: 'AI Platform', mainMessage: 'Evidence improves decisions.' }
      : slide);

    expect(getDeckCopyQaIssues({ ...deck, slides }))
      .toContain('Slide 1 title must state the slide conclusion instead of the topic "AI Platform".');
  });

  it('rejects copy that cannot remain readable in the editable PPTX layout', () => {
    const deck = createMockDeckPlan({ ...samplePptMakerRequest, contentDensity: 'detailed', slideCount: 4 });
    const slides = deck.slides.map((slide, index) => index === 0 ? {
      ...slide,
      title: 'A'.repeat(43),
      contentBlocks: slide.contentBlocks.map((block, blockIndex) => ({
        ...block,
        heading: blockIndex === 0 ? 'H'.repeat(31) : block.heading,
        detail: blockIndex === 0 ? 'D'.repeat(63) : block.detail,
      })),
      labels: slide.contentBlocks.map((block, blockIndex) => blockIndex === 0 ? 'H'.repeat(31) : block.heading),
    } : slide);

    const issues = getDeckCopyQaIssues({ ...deck, slides });

    expect(issues).toContain('Slide 1 title exceeds the 42-character editable layout limit.');
    expect(issues).toContain('Slide 1 proof point 1 heading exceeds the 30-character editable layout limit.');
    expect(issues).toContain('Slide 1 proof point 1 detail exceeds the 62-character editable layout limit for detailed density.');
  });
});

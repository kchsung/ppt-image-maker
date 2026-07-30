import type {
  PptDeckPlan,
  PptMakerRequest,
  SlideArchetype,
  SlidePlan,
  SlideVisualStructure,
  StyleReference,
} from '@/types/models/pptMaker.model';

export const defaultStyleReference: StyleReference = {
  id: 'qlearn-gpc-style',
  name: 'QLEARN lecture image deck',
  notes:
    'Clean white background, deep navy headings, orange emphasis, pastel cards, minimal line icons, fixed footer, circular page number.',
  primaryColorLabel: 'deep navy',
  accentColorLabel: 'bright orange',
};

export const samplePptMakerRequest: PptMakerRequest = {
  sourceText:
    'AI lowers the cost of execution, but raises the standard for judgment. Students need to learn how to divide work between AI systems and human responsibility. A strong workflow starts with clear intent, moves through AI-assisted drafts, and ends with human validation.',
  targetLanguage: 'English',
  audience: 'university students',
  purpose: 'summer school lecture',
  slideCount: 4,
  styleReference: defaultStyleReference,
};

type MockSlideCopy = Pick<SlidePlan, 'title' | 'subtitle' | 'mainMessage' | 'labels' | 'takeaway'>;

const englishSlideCopies: MockSlideCopy[] = [
  {
    title: 'AI-Ready Judgment',
    subtitle: 'A practical learning model for responsible AI use.',
    mainMessage: 'AI accelerates execution when people keep responsibility for intent, review, and decisions.',
    labels: ['Clear intent', 'AI draft', 'Human judgment'],
    takeaway: 'Use AI to accelerate work, not to outsource accountability.',
  },
  {
    title: 'Why Judgment Matters More',
    subtitle: 'Lower execution cost raises the value of discernment.',
    mainMessage: 'When tools make output easier, the quality of the question and the review becomes the differentiator.',
    labels: ['Better questions', 'Evidence review', 'Decision quality'],
    takeaway: 'The advantage moves from producing more to deciding better.',
  },
  {
    title: 'A Responsible Workflow',
    subtitle: 'Move from a defined goal to a verified result.',
    mainMessage: 'A repeatable workflow makes the handoff between human expertise and AI assistance explicit.',
    labels: ['Set the goal', 'Create a draft', 'Validate the result'],
    takeaway: 'Define who owns each decision before the work begins.',
  },
  {
    title: 'Human And AI Roles',
    subtitle: 'Separate capability from accountability.',
    mainMessage: 'AI can summarize, explore, and draft; people set context, test claims, and approve outcomes.',
    labels: ['AI explores', 'People verify', 'Teams decide'],
    takeaway: 'Assign AI tasks by risk and keep final accountability human.',
  },
  {
    title: 'Evidence Before Action',
    subtitle: 'Treat generated output as a starting point, not proof.',
    mainMessage: 'Reliable work connects claims to sources, checks assumptions, and records the decision path.',
    labels: ['Trace sources', 'Check assumptions', 'Record decisions'],
    takeaway: 'Verification turns a useful draft into a dependable result.',
  },
  {
    title: 'Build The Practice',
    subtitle: 'Turn responsible use into a repeatable team habit.',
    mainMessage: 'Teams improve faster when prompts, review rules, and examples are shared and refined together.',
    labels: ['Shared prompts', 'Review rules', 'Learning loop'],
    takeaway: 'Practice makes responsible AI use scalable.',
  },
  {
    title: 'Measure Better Outcomes',
    subtitle: 'Track quality as well as speed.',
    mainMessage: 'Progress should show whether AI-assisted work improves clarity, confidence, and decision quality.',
    labels: ['Time saved', 'Errors found', 'Decisions improved'],
    takeaway: 'Measure the quality of outcomes, not only the volume of output.',
  },
  {
    title: 'From Pilot To Operating Model',
    subtitle: 'Scale only after the workflow is trusted.',
    mainMessage: 'Successful pilots become durable when governance, training, and ownership grow with adoption.',
    labels: ['Pilot safely', 'Standardize practice', 'Scale with trust'],
    takeaway: 'Scale proven practices, not unverified shortcuts.',
  },
  {
    title: 'The Next Learning Agenda',
    subtitle: 'Prepare people for changing tools and stable responsibilities.',
    mainMessage: 'Learning programs need both technical fluency and the judgment to challenge a plausible answer.',
    labels: ['Tool fluency', 'Critical review', 'Responsible action'],
    takeaway: 'Teach people to work with AI and to question it well.',
  },
  {
    title: 'A Clear Commitment',
    subtitle: 'Use AI with intent, evidence, and accountable decisions.',
    mainMessage: 'The goal is not more generated content. The goal is better work people can explain and trust.',
    labels: ['Intent', 'Evidence', 'Accountability'],
    takeaway: 'Start the next task with a clear owner for the final decision.',
  },
  {
    title: 'Make Review Visible',
    subtitle: 'Bring quality checks into the everyday workflow.',
    mainMessage: 'Visible review checkpoints help teams catch weak evidence before it becomes a published conclusion.',
    labels: ['Review points', 'Source checks', 'Team learning'],
    takeaway: 'A visible review step protects speed and quality together.',
  },
  {
    title: 'Turn Insight Into Action',
    subtitle: 'Close the loop with a responsible next step.',
    mainMessage: 'A presentation should finish with an owner, a decision, and a practical action that can be reviewed.',
    labels: ['Name the owner', 'Choose the action', 'Review progress'],
    takeaway: 'End with a decision that the audience can act on.',
  },
];

const koreanSlideCopies: MockSlideCopy[] = [
  {
    title: 'AI 시대의 판단 역량',
    subtitle: '책임 있는 AI 활용을 위한 실천 모델입니다.',
    mainMessage: 'AI는 실행을 빠르게 하지만 목표 설정과 검토, 최종 판단의 책임은 사람이 맡아야 합니다.',
    labels: ['명확한 의도', 'AI 초안', '사람의 판단'],
    takeaway: 'AI로 속도를 높이되 책임까지 맡기지는 않습니다.',
  },
  {
    title: '판단의 가치가 커지는 이유',
    subtitle: '실행 비용이 낮아질수록 분별력의 가치가 높아집니다.',
    mainMessage: '결과물을 쉽게 만들 수 있을수록 질문의 질과 검토의 깊이가 차이를 만듭니다.',
    labels: ['좋은 질문', '근거 검토', '의사결정 품질'],
    takeaway: '경쟁력은 더 많이 만드는 데서 더 잘 판단하는 데로 이동합니다.',
  },
  {
    title: '책임 있는 실행 흐름',
    subtitle: '목표 정의부터 결과 검증까지 연결합니다.',
    mainMessage: '반복 가능한 흐름은 사람의 전문성과 AI 지원이 만나는 지점을 분명하게 만듭니다.',
    labels: ['목표 설정', '초안 생성', '결과 검증'],
    takeaway: '일을 시작하기 전에 각 판단의 책임자를 정합니다.',
  },
  {
    title: '사람과 AI의 역할 구분',
    subtitle: '역량과 책임을 분리해 설계합니다.',
    mainMessage: 'AI는 탐색과 요약, 초안을 돕고 사람은 맥락 설정과 주장 검증, 결과 승인을 맡습니다.',
    labels: ['AI 탐색', '사람 검증', '팀 결정'],
    takeaway: '위험도에 따라 AI 업무를 배정하고 최종 책임은 사람이 집니다.',
  },
  {
    title: '행동 전에 근거 확인',
    subtitle: '생성 결과를 증거가 아닌 출발점으로 다룹니다.',
    mainMessage: '신뢰할 수 있는 업무는 출처를 연결하고 가정을 확인하며 판단 과정을 기록합니다.',
    labels: ['출처 추적', '가정 확인', '판단 기록'],
    takeaway: '검증은 유용한 초안을 신뢰할 수 있는 결과로 바꿉니다.',
  },
  {
    title: '실천을 습관으로 만들기',
    subtitle: '책임 있는 활용을 팀의 일하는 방식으로 정착시킵니다.',
    mainMessage: '프롬프트와 검토 기준, 사례를 함께 공유하고 개선할 때 팀의 활용 역량이 높아집니다.',
    labels: ['공유 프롬프트', '검토 기준', '학습 순환'],
    takeaway: '반복 연습이 책임 있는 AI 활용을 확장합니다.',
  },
  {
    title: '더 나은 결과 측정',
    subtitle: '속도뿐 아니라 품질도 함께 확인합니다.',
    mainMessage: 'AI 지원 업무가 명확성, 신뢰도, 의사결정 품질을 높이는지 함께 측정해야 합니다.',
    labels: ['시간 절감', '오류 발견', '결정 개선'],
    takeaway: '결과물의 양보다 결과의 품질을 측정합니다.',
  },
  {
    title: '실험에서 운영 모델로',
    subtitle: '신뢰가 확인된 흐름을 확장합니다.',
    mainMessage: '성공한 실험은 거버넌스와 교육, 책임 체계가 함께 성장할 때 지속 가능한 방식이 됩니다.',
    labels: ['안전한 실험', '실천 표준화', '신뢰 기반 확장'],
    takeaway: '검증된 실천을 확장하고 확인되지 않은 지름길은 피합니다.',
  },
  {
    title: '다음 학습 과제',
    subtitle: '변하는 도구와 변하지 않는 책임을 함께 준비합니다.',
    mainMessage: '학습은 도구 활용 능력과 그럴듯한 답을 다시 묻는 판단 능력을 함께 길러야 합니다.',
    labels: ['도구 활용', '비판적 검토', '책임 있는 실행'],
    takeaway: 'AI와 협업하는 법과 AI를 검증하는 법을 함께 배웁니다.',
  },
  {
    title: '분명한 실행 약속',
    subtitle: '의도와 근거, 책임을 갖고 AI를 활용합니다.',
    mainMessage: '목표는 더 많은 생성물이 아니라 설명할 수 있고 신뢰할 수 있는 더 나은 업무입니다.',
    labels: ['의도', '근거', '책임'],
    takeaway: '다음 업무는 최종 판단의 책임자를 정하는 것에서 시작합니다.',
  },
  {
    title: '검토 과정을 드러내기',
    subtitle: '품질 확인을 일상 업무 흐름에 넣습니다.',
    mainMessage: '보이는 검토 지점은 약한 근거가 공개된 결론이 되기 전에 팀이 발견하도록 돕습니다.',
    labels: ['검토 지점', '출처 확인', '팀 학습'],
    takeaway: '검토 단계를 드러내면 속도와 품질을 함께 지킬 수 있습니다.',
  },
  {
    title: '통찰을 행동으로 연결',
    subtitle: '책임 있는 다음 단계로 마무리합니다.',
    mainMessage: '발표는 책임자와 결정, 검토 가능한 다음 행동으로 끝날 때 실제 변화를 만듭니다.',
    labels: ['책임자 지정', '행동 선택', '진행 검토'],
    takeaway: '청중이 바로 실행할 수 있는 결정으로 발표를 마무리합니다.',
  },
];

const readableKoreanSlideCopies: MockSlideCopy[] = [
  { title: 'AI 판단과 실행', subtitle: '속도와 책임을 함께 설계합니다.', mainMessage: 'AI는 초안을 빠르게 만들고, 사람은 맥락과 근거를 검증해 최종 결정을 내립니다.', labels: ['목표 설정', 'AI 초안', '사람 검증'], takeaway: '속도는 AI로 높이고 책임은 사람이 지킵니다.' },
  { title: '좋은 질문이 만드는 차이', subtitle: '문제 정의가 결과의 품질을 좌우합니다.', mainMessage: '명확한 질문은 필요한 근거와 검토 기준을 드러내어 더 나은 결과를 만듭니다.', labels: ['문제 정의', '근거 확인', '결정 기준'], takeaway: '좋은 질문은 좋은 판단의 출발점입니다.' },
  { title: '신뢰 가능한 업무 흐름', subtitle: '초안부터 검증까지 역할을 연결합니다.', mainMessage: '반복 가능한 흐름은 사람과 AI의 역할을 분명하게 나누고 검토 시점을 고정합니다.', labels: ['초안 생성', '사실 검토', '결과 승인'], takeaway: '검증 단계가 있어야 결과가 업무 자산이 됩니다.' },
  { title: '사람과 AI의 역할', subtitle: '능력과 책임을 구분합니다.', mainMessage: 'AI는 탐색과 요약을 맡고 사람은 맥락 설정, 주장 검증, 결과 승인을 책임집니다.', labels: ['AI 탐색', '사람 판단', '팀 승인'], takeaway: '최종 책임은 항상 명확한 사람에게 남겨야 합니다.' },
  { title: '행동 전 근거 확인', subtitle: '생성 결과를 출발점으로 다룹니다.', mainMessage: '주요 주장을 출처와 연결하고 가정을 검토하면 결과의 신뢰도가 높아집니다.', labels: ['출처 추적', '가정 검토', '결정 기록'], takeaway: '검증은 초안을 설명 가능한 결과로 바꿉니다.' },
  { title: '팀의 반복 학습', subtitle: '좋은 사용법을 업무 방식으로 만듭니다.', mainMessage: '공유 프롬프트와 검토 기준을 함께 다듬으면 책임 있는 사용이 팀 전체로 확장됩니다.', labels: ['공유 기준', '검토 규칙', '학습 순환'], takeaway: '반복 학습이 안전한 확장을 만듭니다.' },
  { title: '더 나은 결과 측정', subtitle: '속도뿐 아니라 품질을 함께 봅니다.', mainMessage: '시간 절감과 함께 오류 발견, 설명 가능성, 의사결정 품질을 측정해야 합니다.', labels: ['시간 절감', '오류 발견', '품질 향상'], takeaway: '좋은 측정은 올바른 개선 방향을 보여 줍니다.' },
  { title: '검증된 방식의 확장', subtitle: '신뢰를 만든 뒤 규모를 키웁니다.', mainMessage: '성공한 시범 운영은 교육, 거버넌스, 역할 체계를 갖춰 지속 가능한 운영 모델이 됩니다.', labels: ['시범 운영', '기준 정립', '확장 운영'], takeaway: '검증된 방식만 조직 전체로 확장합니다.' },
  { title: '다음 학습 과제', subtitle: '도구 활용과 비판적 검토를 함께 기릅니다.', mainMessage: '변하는 도구를 이해하는 능력과 그 결과를 다시 질문하는 판단력이 모두 필요합니다.', labels: ['도구 활용', '비판 검토', '책임 실행'], takeaway: 'AI와 함께 일하는 능력은 질문하는 능력에서 시작합니다.' },
  { title: '분명한 실행 약속', subtitle: '의도와 근거를 가진 다음 행동을 정합니다.', mainMessage: '발표의 끝은 더 많은 생성물이 아니라 책임자와 다음 행동이 명확한 결정이어야 합니다.', labels: ['책임자', '다음 행동', '진행 확인'], takeaway: '설명 가능한 결정으로 발표를 마무리합니다.' },
];

export function createMockDeckPlan(
  request: PptMakerRequest = samplePptMakerRequest,
  options: { id?: string; createdAt?: string } = {},
): PptDeckPlan {
  const copies = request.targetLanguage === 'Korean' ? readableKoreanSlideCopies : englishSlideCopies;
  const count = Math.max(3, Math.min(request.slideCount, 100));
  const createdAt = options.createdAt ?? new Date().toISOString();
  const slides = Array.from({ length: count }, (_, index) => {
    const pageNumber = index + 1;
    const copy = copies[index % copies.length];
    const archetype = getMockArchetype(pageNumber, count);
    const visualStructure = getMockVisualStructure(pageNumber, count, archetype);

    return {
      id: `slide-${pageNumber}`,
      pageNumber,
      archetype,
      visualStructure,
      ...copy,
      objective: request.targetLanguage === 'Korean'
        ? `${copy.labels[0] ?? '우선과제'}에 대한 핵심 판단과 실행 방향을 명확히 합의합니다.`
        : `Help the audience understand and act on ${copy.labels[0] ?? 'the priority'}.`,
      contentBlocks: copy.labels.map((heading, blockIndex) => ({
        heading,
        detail: request.targetLanguage === 'Korean'
          ? blockIndex === 0
            ? `${heading}이 이 장표에서 시작해야 할 핵심 근거를 설명합니다.`
            : `${heading}은 주요 메시지를 뒷받침하는 실행 근거를 제공합니다.`
          : blockIndex === 0
            ? `${heading} explains the critical starting point for this slide.`
            : `${heading} provides a practical proof point that supports the main message.`,
      })),
      decision: request.targetLanguage === 'Korean'
        ? `${copy.labels[0] ?? '우선과제'}에 대한 다음 실행과 책임 주체를 합의합니다.`
        : `Agree the next action for ${copy.labels[0] ?? 'this priority'}.`,
      imageSlot: {
        id: `visual-${pageNumber}`,
        purpose: 'A decorative visual asset that supports the editable slide message.',
        placement: pageNumber === 1 ? 'right-hero' : pageNumber === count ? 'center-visual' : 'card-visual',
        prompt: `Text-free editorial illustration for ${copy.labels.join(', ')}. Do not include words or numbers.`,
      },
      imagePrompt: '',
    } satisfies SlidePlan;
  });

  return {
    id: options.id ?? 'mock-deck-plan-1',
    title: request.targetLanguage === 'Korean' ? 'AI 판단과 실행' : 'AI-Ready Judgment And Execution',
    createdAt,
    request: { ...request, slideCount: count },
    strategy: {
      coreThesis: request.targetLanguage === 'Korean'
        ? 'AI를 활용한 업무는 빠른 초안보다 검증 가능한 판단 체계를 갖출 때 가치가 커집니다.'
        : 'AI creates durable value when teams turn generated output into evidence-backed decisions.',
      audienceNeed: request.targetLanguage === 'Korean'
        ? '실행 속도와 결과의 신뢰도를 함께 높일 수 있는 실무 구조가 필요합니다.'
        : 'The audience needs a practical way to improve both execution speed and decision confidence.',
      desiredOutcome: request.targetLanguage === 'Korean'
        ? '발표 후 바로 실행할 수 있는 우선 과제와 책임 체계를 합의합니다.'
        : 'The deck aligns the audience on a concrete priority, owner, and next action.',
      narrativeArc: [
        { phase: 'Context', purpose: 'Frame the opportunity and the decision to make.', slideNumbers: [1] },
        { phase: 'Evidence', purpose: 'Build the case with clear proof points and trade-offs.', slideNumbers: Array.from({ length: Math.max(0, count - 2) }, (_, index) => index + 2) },
        { phase: 'Action', purpose: 'Close with an accountable next step.', slideNumbers: [count] },
      ],
    },
    slides,
    copyQa: {
      status: 'passed',
      checks: [
        'Mock copy uses the selected language.',
        'Mock slide structures are diverse and non-repeating.',
        'Mock copy contains no placeholders or clipped text.',
      ],
      issues: [],
    },
  };
}

export function createMockSlideImageDataUrl(slide: SlidePlan): string {
  const title = escapeXml(slide.title);
  const subtitle = escapeXml(slide.subtitle);
  const takeaway = escapeXml(slide.takeaway);
  const labels = slide.labels.slice(0, 4).map(escapeXml);
  const composition = createMockComposition(slide.visualStructure, labels);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <rect width="1920" height="1080" fill="#ffffff"/>
      <rect x="86" y="86" width="12" height="162" rx="6" fill="#fe6621"/>
      <text x="128" y="152" fill="#0b2454" font-family="Pretendard, Arial, sans-serif" font-size="64" font-weight="700">${title}</text>
      <text x="128" y="212" fill="#50617d" font-family="Pretendard, Arial, sans-serif" font-size="30">${subtitle}</text>
      <rect x="1590" y="86" width="190" height="70" rx="14" fill="#fff7ee" stroke="#fe6621" stroke-width="2"/>
      <text x="1685" y="130" text-anchor="middle" fill="#fe6621" font-family="Pretendard, Arial, sans-serif" font-size="24">LOGO</text>
      ${composition}
      <rect x="112" y="905" width="1510" height="84" rx="18" fill="#f3f6fb"/>
      <text x="160" y="958" fill="#0b2454" font-family="Pretendard, Arial, sans-serif" font-size="29" font-weight="600">${takeaway}</text>
      <circle cx="1760" cy="945" r="40" fill="#0b2454"/>
      <text x="1760" y="956" text-anchor="middle" fill="#ffffff" font-family="Pretendard, Arial, sans-serif" font-size="26">${slide.pageNumber}</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function getMockArchetype(pageNumber: number, totalSlides: number): SlideArchetype {
  if (pageNumber === 1) return 'cover';
  if (pageNumber === totalSlides) return 'closing';

  const archetypes: SlideArchetype[] = ['section-opener', 'card-grid', 'comparison', 'process', 'before-after', 'case-dashboard'];
  return archetypes[(pageNumber - 2) % archetypes.length];
}

function getMockVisualStructure(
  pageNumber: number,
  totalSlides: number,
  archetype: SlideArchetype,
): SlideVisualStructure {
  if (pageNumber === 1) return 'hero-visual';
  if (pageNumber === totalSlides) return 'closing-commitment';

  const structureByArchetype: Record<Exclude<SlideArchetype, 'cover' | 'closing'>, SlideVisualStructure> = {
    'section-opener': 'message-emphasis',
    'card-grid': 'card-grid',
    comparison: 'side-by-side-comparison',
    process: 'numbered-process',
    'before-after': 'before-after-mapping',
    'case-dashboard': 'metrics-dashboard',
  };

  return structureByArchetype[archetype as Exclude<SlideArchetype, 'cover' | 'closing'>];
}

function createMockComposition(structure: SlideVisualStructure, labels: string[]): string {
  const safeLabels = labels.length > 0 ? labels : ['Focus', 'Evidence', 'Action'];
  const tag = (text: string, x: number, y: number, width = 280) => `
    <rect x="${x}" y="${y}" width="${width}" height="92" rx="16" fill="#eff5fe" stroke="#b7caea" stroke-width="2"/>
    <text x="${x + width / 2}" y="${y + 56}" text-anchor="middle" fill="#0b2454" font-family="Pretendard, Arial, sans-serif" font-size="26" font-weight="600">${text}</text>
  `;

  switch (structure) {
    case 'hero-visual':
      return `
        <circle cx="1320" cy="530" r="230" fill="#eff5fe" stroke="#0b2454" stroke-width="6"/>
        <circle cx="1320" cy="530" r="116" fill="#fe6621" opacity="0.16"/>
        <path d="M1320 390v280M1180 530h280" stroke="#0b2454" stroke-width="10" stroke-linecap="round"/>
        ${tag(safeLabels[0], 140, 430, 320)}
        ${tag(safeLabels[1] ?? safeLabels[0], 500, 565, 320)}
        ${tag(safeLabels[2] ?? safeLabels[0], 860, 430, 320)}
      `;
    case 'message-emphasis':
      return `
        <rect x="250" y="370" width="1420" height="270" rx="36" fill="#0b2454"/>
        <text x="960" y="495" text-anchor="middle" fill="#ffffff" font-family="Pretendard, Arial, sans-serif" font-size="52" font-weight="700">${safeLabels[0]}</text>
        <text x="960" y="570" text-anchor="middle" fill="#fed7c1" font-family="Pretendard, Arial, sans-serif" font-size="34">${safeLabels[1] ?? safeLabels[0]}  ·  ${safeLabels[2] ?? safeLabels[0]}</text>
        <circle cx="360" cy="745" r="48" fill="#fe6621"/><circle cx="960" cy="745" r="48" fill="#fe6621"/><circle cx="1560" cy="745" r="48" fill="#fe6621"/>
      `;
    case 'side-by-side-comparison':
    case 'before-after-mapping':
      return `
        ${tag(safeLabels[0], 240, 410, 490)}
        <path d="M800 458h320" stroke="#fe6621" stroke-width="10" marker-end="url(#arrow)"/>
        ${tag(safeLabels[1] ?? safeLabels[0], 1190, 410, 490)}
        <text x="960" y="650" text-anchor="middle" fill="#50617d" font-family="Pretendard, Arial, sans-serif" font-size="30">${safeLabels[2] ?? 'Transformation'}</text>
      `;
    case 'numbered-process':
    case 'roadmap':
      return safeLabels.slice(0, 4).map((label, index) => {
        const x = 180 + index * 390;
        return `
          <circle cx="${x + 115}" cy="490" r="52" fill="#0b2454"/>
          <text x="${x + 115}" y="501" text-anchor="middle" fill="#ffffff" font-family="Pretendard, Arial, sans-serif" font-size="28">${index + 1}</text>
          ${tag(label, x, 570, 230)}
          ${index < safeLabels.length - 1 ? `<path d="M${x + 255} 490h110" stroke="#fe6621" stroke-width="8"/>` : ''}
        `;
      }).join('');
    case 'card-grid':
    case 'metrics-dashboard':
      return safeLabels.slice(0, 4).map((label, index) => {
        const x = 190 + (index % 2) * 770;
        const y = 350 + Math.floor(index / 2) * 250;
        return `${tag(label, x, y, 580)}`;
      }).join('');
    case 'pyramid-framework':
      return safeLabels.slice(0, 3).map((label, index) => {
        const width = 560 + index * 220;
        const x = 960 - width / 2;
        const y = 630 - index * 120;
        return `${tag(label, x, y, width)}`;
      }).join('');
    case 'hub-and-spoke':
      return `
        <circle cx="960" cy="510" r="125" fill="#0b2454"/>
        <text x="960" y="522" text-anchor="middle" fill="#ffffff" font-family="Pretendard, Arial, sans-serif" font-size="32">${safeLabels[0]}</text>
        ${tag(safeLabels[1] ?? safeLabels[0], 280, 430, 300)}
        ${tag(safeLabels[2] ?? safeLabels[0], 1340, 430, 300)}
        <path d="M580 475h255M1085 475h255" stroke="#fe6621" stroke-width="8"/>
      `;
    case 'case-story':
      return `
        <rect x="210" y="380" width="420" height="290" rx="24" fill="#eff5fe"/>
        <rect x="750" y="380" width="420" height="290" rx="24" fill="#fff7ee"/>
        <rect x="1290" y="380" width="420" height="290" rx="24" fill="#eff5fe"/>
        <text x="420" y="540" text-anchor="middle" fill="#0b2454" font-family="Pretendard, Arial, sans-serif" font-size="32">${safeLabels[0]}</text>
        <text x="960" y="540" text-anchor="middle" fill="#0b2454" font-family="Pretendard, Arial, sans-serif" font-size="32">${safeLabels[1] ?? safeLabels[0]}</text>
        <text x="1500" y="540" text-anchor="middle" fill="#0b2454" font-family="Pretendard, Arial, sans-serif" font-size="32">${safeLabels[2] ?? safeLabels[0]}</text>
      `;
    case 'closing-commitment':
      return `
        <circle cx="960" cy="510" r="210" fill="#0b2454"/>
        <circle cx="960" cy="510" r="156" fill="none" stroke="#fe6621" stroke-width="12"/>
        <text x="960" y="500" text-anchor="middle" fill="#ffffff" font-family="Pretendard, Arial, sans-serif" font-size="44" font-weight="700">${safeLabels[0]}</text>
        <text x="960" y="565" text-anchor="middle" fill="#fed7c1" font-family="Pretendard, Arial, sans-serif" font-size="30">${safeLabels[1] ?? safeLabels[0]}</text>
      `;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character] ?? character);
}

import type { PresentationDesignGuide, PresentationIntent } from '@/types/models/pptMaker.model';

export const presentationDesignGuides: Record<PresentationIntent, PresentationDesignGuide> = {
  'executive-proposal': {
    id: 'executive-proposal',
    name: 'B2B Executive Proposal',
    narrativeGuide: 'Decision context, current cost or risk, proposed operating model, proof, phased rollout, and business outcome.',
    visualGuide: 'Quiet executive composition with one conclusion per slide, deep navy structure, restrained accent, and decision-oriented footer.',
    slideRules: ['Lead with the business decision, not product features.', 'Use comparison, operating model, roadmap, and value proof structures.', 'End every section with an owner, commitment, or decision.'],
  },
  'strategy-decision': {
    id: 'strategy-decision',
    name: 'Strategy Decision Deck',
    narrativeGuide: 'Strategic tension, evidence, options and trade-offs, recommendation, execution path, and decision request.',
    visualGuide: 'Analytical but uncluttered layout with explicit choices, evidence hierarchy, and a visible recommendation.',
    slideRules: ['Frame trade-offs before recommendations.', 'Separate evidence from implication.', 'Close with a decision, owner, and review point.'],
  },
  'education-lecture': {
    id: 'education-lecture',
    name: 'Education Lecture',
    narrativeGuide: 'Context, core concept, worked framework, examples, practice or application, recap, and action for the learner.',
    visualGuide: 'Clear learning hierarchy with progressive diagrams, concise explanations, and recurring takeaway cues.',
    slideRules: ['Teach one concept or skill per slide.', 'Use examples before abstract conclusions when possible.', 'Finish with a learner action or reflection.'],
  },
  'investment-deck': {
    id: 'investment-deck',
    name: 'Investment Or IR Deck',
    narrativeGuide: 'Market problem, insight, solution, business model, validation, growth plan, team or execution capability, and ask.',
    visualGuide: 'High-confidence narrative with sparse claims, evidence-led charts only when source data exists, and disciplined visual pacing.',
    slideRules: ['Make the investment thesis explicit early.', 'Do not invent traction or market metrics.', 'Use the close to state the funding or partnership ask.'],
  },
  'implementation-roadmap': {
    id: 'implementation-roadmap',
    name: 'Implementation Roadmap',
    narrativeGuide: 'Starting state, target state, workstreams, milestones, governance, risks, measures, and next execution decision.',
    visualGuide: 'Operational structure with timeline, ownership, dependencies, and review gates visible without crowding the slide.',
    slideRules: ['Use stage-based layouts for sequence and dependencies.', 'Make scope, owner, and decision gates explicit.', 'Distinguish confirmed facts from proposed actions.'],
  },
};

export function getPresentationDesignGuide(intent: PresentationIntent): PresentationDesignGuide {
  return presentationDesignGuides[intent] ?? presentationDesignGuides['education-lecture'];
}

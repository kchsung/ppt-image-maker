import type {
  PresentationPurposeTemplate,
  PresentationPurposeTemplateId,
} from '@/types/models/pptMaker.model';

export const presentationPurposeTemplates: Record<PresentationPurposeTemplateId, PresentationPurposeTemplate> = {
  ir: {
    id: 'ir',
    name: 'IR / Investment Deck',
    description: 'Build an investor narrative from the market problem to the funding or partnership ask.',
    documentType: 'investment',
    presentationIntent: 'investment-deck',
    defaultAudience: 'investors and strategic partners',
    defaultPurpose: 'secure investment interest and a next-step meeting',
    defaultOutline: ['Investment thesis', 'Problem and market', 'Solution and product', 'Business model', 'Validation and growth plan', 'Team and investment ask'],
    compositionRules: [
      'State the investment thesis in the opening two slides.',
      'Place market, traction, and financial claims beside a recorded source.',
      'Close with the funding or partnership ask, use of funds, and next decision.',
    ],
  },
  'business-proposal': {
    id: 'business-proposal',
    name: 'Business Proposal',
    description: 'Lead a buyer from business context and pain points to a practical proposal and decision request.',
    documentType: 'proposal',
    presentationIntent: 'executive-proposal',
    defaultAudience: 'executive sponsors and business decision makers',
    defaultPurpose: 'approve a proposed business initiative or engagement',
    defaultOutline: ['Business context and challenge', 'Opportunity and proposal value', 'Proposed solution and operating model', 'Delivery roadmap', 'Expected outcomes and proof', 'Decision request and next steps'],
    compositionRules: [
      'Open with the business decision, current cost, risk, or missed opportunity.',
      'Explain the proposal before listing solution features.',
      'Make delivery ownership, milestones, and the requested decision explicit.',
    ],
  },
  'company-profile': {
    id: 'company-profile',
    name: 'Company Profile',
    description: 'Present company identity, capabilities, credibility, and a clear collaboration path.',
    documentType: 'proposal',
    presentationIntent: 'executive-proposal',
    defaultAudience: 'prospective customers, partners, and stakeholders',
    defaultPurpose: 'establish credibility and open a collaboration conversation',
    defaultOutline: ['Company overview', 'Mission and core strengths', 'Products and services', 'Customer value and delivery approach', 'Reference work and capabilities', 'Collaboration proposal'],
    compositionRules: [
      'Balance company facts with the customer value they enable.',
      'Use references only when supplied in the source material.',
      'End with a concrete collaboration path rather than a generic company close.',
    ],
  },
  'results-report': {
    id: 'results-report',
    name: 'Results Report',
    description: 'Turn delivered work into evidence, lessons, and accountable next actions.',
    documentType: 'report',
    presentationIntent: 'strategy-decision',
    defaultAudience: 'executive sponsors, project owners, and review stakeholders',
    defaultPurpose: 'review outcomes and align on the next decision',
    defaultOutline: ['Executive summary', 'Goals and scope', 'Execution status', 'Results and evidence', 'Issues and lessons learned', 'Next actions and decisions'],
    compositionRules: [
      'Separate completed work, measured results, and interpretation.',
      'Use tables or charts only for sourced numbers and clear comparisons.',
      'End with owners, timing, and the next review or decision gate.',
    ],
  },
  'education-material': {
    id: 'education-material',
    name: 'Education Material',
    description: 'Move learners from learning goals through concepts and practice to an action they can apply.',
    documentType: 'lecture',
    presentationIntent: 'education-lecture',
    defaultAudience: 'learners and workshop participants',
    defaultPurpose: 'build understanding and enable practical application',
    defaultOutline: ['Learning goals', 'Core concepts', 'Framework or method', 'Worked example or case', 'Practice and application', 'Recap and learner action'],
    compositionRules: [
      'Teach one concept, step, or decision per slide.',
      'Place an example before the abstract takeaway whenever possible.',
      'End with a learner action, reflection, or practice prompt.',
    ],
  },
};

export function getPresentationPurposeTemplate(id?: PresentationPurposeTemplateId): PresentationPurposeTemplate {
  return presentationPurposeTemplates[id ?? 'education-material'];
}

import type { PptMakerRequest, StyleReference } from '@/types/models/pptMaker.model';

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

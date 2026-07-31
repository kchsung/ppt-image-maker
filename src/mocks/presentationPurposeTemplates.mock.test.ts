import { describe, expect, it } from 'vitest';
import {
  getPresentationPurposeTemplate,
  presentationPurposeTemplates,
} from '@/mocks/presentationPurposeTemplates.mock';

describe('presentation purpose templates', () => {
  it('defines an actionable outline and composition rules for every supported purpose', () => {
    expect(Object.keys(presentationPurposeTemplates)).toHaveLength(5);

    Object.values(presentationPurposeTemplates).forEach((template) => {
      expect(template.defaultOutline.length).toBeGreaterThanOrEqual(6);
      expect(template.compositionRules.length).toBeGreaterThanOrEqual(3);
      expect(template.defaultPurpose).toBeTruthy();
      expect(template.defaultAudience).toBeTruthy();
    });
  });

  it('maps the IR template to the investment presentation contract', () => {
    const template = getPresentationPurposeTemplate('ir');

    expect(template.documentType).toBe('investment');
    expect(template.presentationIntent).toBe('investment-deck');
    expect(template.defaultOutline.at(-1)).toContain('ask');
  });
});

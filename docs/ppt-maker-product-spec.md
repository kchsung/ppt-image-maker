# PPT Maker Product Specification

## Product goal

Create high-quality proposals, IR decks, and collaboration decks from text or uploaded documents while keeping text, cards, diagrams, and data surfaces editable in PowerPoint.

## Production architecture

```text
Source text / DOCX / PDF / PPTX + instructions
        |
        v
OpenAI deck blueprint
        |
        v
Section batches (maximum 10 slides each)
        |
        v
Slide JSON
  section-aware title, objective, message, proof points, decision,
  takeaway, archetype, visualStructure
        |
        v
Layout engine
        |
        v
HTML/CSS preview  <---- same source ---->  dom-to-pptx editable PPTX
        |                                           |
        +------------------- PptxGenJS fallback / special post-processing
                                                    |
                                                    v
                                           Short Supabase Storage save
```

## Requirements

1. OpenAI plans the whole narrative before any layout is rendered. The Deck Blueprint must state a core thesis, audience need, desired outcome, beginning-evidence-action narrative arc, and contiguous named sections with exact page ranges.
2. No section may exceed ten slides. The application generates Slide JSON in section batches with at most two planning calls running at the same time. Each batch receives a short prior-section handoff derived from the shared Blueprint, so it does not need to wait for an earlier model response. A 50-slide deck therefore uses five independently retryable planning calls; a 100-slide deck uses ten.
3. Each slide has one decision-oriented title, a clear objective, three to five explained proof points, and a recommended decision or next action. Headings alone are insufficient.
4. The Slide JSON must have varied structures, such as hero, card grid, comparison, roadmap, hub-and-spoke, metrics, pyramid, case story, and closing commitment.
5. HTML/CSS is the canonical design representation. Preview and PPTX conversion must use the same component so copy positions stay aligned.
6. `dom-to-pptx` is the primary converter for editable shapes and text. All generated typography uses Pretendard with no ellipsis or text clipping.
7. PptxGenJS remains in the browser for fallback output, manual template slides, and future charts/tables/special PowerPoint objects.
8. New decks do not depend on generated slide images, Claude, or a Netlify worker. Legacy image jobs remain readable only.
9. An optional logo occupies the top-right; otherwise an editable logo placeholder remains there.
10. Every exported deck includes a final manual-addition template slide.

## Quality and render QA roadmap

The interactive path implements copy QA, slide-structure diversity, editable layout validation, and a shared preview/export DOM. The following requires a separate containerized QA service and is a planned post-export quality stage:

1. Render saved PPTX with LibreOffice to PDF/PNG.
2. Compare rendered pages with the HTML/CSS reference for overflow, collision, font substitution, and visual drift.
3. Persist a quality report and flag failures in List before publishing the final file.

`pptx-automizer` is also intentionally deferred to that Node-side template-adapter service. It requires a server/Node runtime and an existing company PPTX template, so it does not belong in the browser export bundle. The future adapter can apply company masters before LibreOffice render QA.

## Acceptance criteria

1. A new deck creates no `generation_items` and makes no OpenAI image request.
2. A 50-slide request produces a validated Blueprint with at least five contiguous sections and no section larger than ten slides.
3. The visible preview uses the approved Slide JSON, not a generated screenshot.
4. Exported PPTX contains editable text and shape objects in Pretendard.
5. List can generate, save, preview, and download a presentation without a Netlify worker.
6. `npm run lint`, `npm run test:run`, and `npm run build` pass.

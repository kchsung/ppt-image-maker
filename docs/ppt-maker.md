# PPT Maker Implementation Notes

> 한국어 적용 요약과 품질 기준은 [PPT 구성 및 품질 적용 현황](./ppt-quality-implementation.md)을 참고하세요.

## Current flow

`/ppt-maker` creates editable presentations without a slide-image generation step:

1. `generate-ppt-deck-blueprint` uses OpenAI to create and validate the whole-deck strategy: core thesis, audience need, desired outcome, narrative arc, and a contiguous table of contents. Each section explicitly records its role, key audience question, page range, slide allocation, and visual direction.
2. `analyze-ppt-request` extracts the topic, purpose, audience, presentation duration, recommended slide count, document type, deck format, key message, and required sections. The resulting production conditions are saved in the maker form and attached to the saved deck request.
   It also analyzes attached source material: document text, worksheet rows, and visual references become a stored summary, key points, data candidates, available visual assets, and a source registry for the Blueprint and slide-planning calls.
3. Each Blueprint section contains a role, key question, purpose, key message, page range, and visual focus. The generated preview exposes this outline for review before export. A section contains at most ten slides, so a 50-slide deck is planned as five coherent section batches rather than one oversized response.
4. `generate-ppt-slide-plan` creates Section Slide JSON batches with a bounded concurrency of two for normal requests. Detailed or 21+-slide decks are planned one section at a time to protect the OpenAI token budget; 429 responses honor Retry-After or the provider's retry guidance before bounded retries. Each call receives the controlling Blueprint and a Blueprint-derived handoff from the preceding sections.
5. Each Slide JSON record contains exactly one semantic slide role (`opening`, `context`, `problem-framing`, `evidence`, `comparison`, `solution`, `implementation`, `case-study`, `decision`, or `conclusion`), plus a decision-oriented title, slide objective, main message, three to five supporting proof points (`heading` + complete `detail`), a recommended decision, and a varied visual structure.
   It also stores a narrative dependency: the preceding slide number, the question being answered, this slide's answer summary, and the one question handed to the next slide.
6. `pptDocument.service.ts` is the layout engine. It maps the approved plan to editable text, shape, footer, and logo rules.
7. `PptHtmlSlide.tsx` renders the same plan as HTML/CSS for both the visible preview and an off-screen export surface.
8. `dom-to-pptx` converts that HTML/CSS surface into editable PowerPoint objects. `PptxGenJS` remains the browser fallback and supplies the manual-addition slide.
9. List optionally sends the finished binary to `save-pptx-output`, a short Supabase Storage request.

The primary path does not call `generate-ppt-image-deck`, Claude, a Netlify worker, or a long-running edge function.

## Presentation planning brief

The maker turns the initial request into an explicit planning brief before it creates Slide JSON. Use the input fields to define the presentation rather than hiding these requirements in the source text:

- **Audience** and **Purpose**: who must understand the material and what outcome the deck should create.
- **Analyze request**: runs before planning and extracts the topic, purpose, audience, presentation duration, recommended slide count, and document type. The detected values remain editable, then travel with the request into the Blueprint and each section plan.
- **Source-material extraction**: attach up to eight PDF, DOCX, PPTX, XLSX, PNG, JPEG, or WEBP files. Document text and worksheet rows are extracted in the browser; up to three images are passed to OpenAI as visual input during request analysis. The resulting source summary makes key claims, usable data, and visual references visible before deck planning.
- **Source registry**: every attachment is registered with a source name, document name, publication year when it can be read from the filename or material, URL when it is present in the material, and the local verification date. URLs included in source text are registered too. The planner may only attach factual or numeric slides to IDs in this registry; it cannot invent a citation.
- **Complete missing conditions**: when the source cannot establish the purpose, audience, presentation duration, content detail, or style direction confidently, the analysis returns compact selectable questions. Required answers are stored with the request, update the related form field, and must be confirmed before planning can begin.
- **Topic**, **Document type**, and **Presentation duration**: make the deck's subject, expected delivery time, and intended artifact explicit. The duration is optional; when provided, analysis recommends a slide count that respects the selected content detail.
- **PPT purpose template**: selects a production contract before planning starts. `IR / Investment Deck`, `Business Proposal`, `Company Profile`, `Results Report`, and `Education Material` each supply a different document type, default audience and purpose, a six-stage baseline table of contents, and composition rules. The selected template remains attached to request analysis, the whole-deck Blueprint, and every section-level Slide JSON call. It therefore controls the story shape even when a long deck is planned in parallel batches.
- **Core message**: the single conclusion that the cover, evidence slides, and closing decision must reinforce.
- **Required sections**: named content that must appear in the narrative arc, such as the current challenge, operating model, rollout, and decision request.
- **Content detail**: `Light` produces three concise proof points, `Standard` produces four contextual proof points, and `Detailed` produces five substantial proof points on each slide.
- **Slide roles**: each slide is assigned one narrative job before a layout is selected. This distinguishes a problem statement from evidence, comparison, solution, implementation, case study, decision, or conclusion even when two slides use similar editable objects.
- **Conclusion headlines**: topic-only labels are converted into short message headlines that state the slide's conclusion. The planner uses the approved main message as the factual basis and QA rejects generic or topic-only titles before layout rendering.
- **Slide dependencies**: every slide is linked to its direct predecessor. The prior slide's `nextQuestion` is copied into the following slide's `questionAddressed`, which records the argument chain and lets the assembled deck verify transitions across parallel section batches.
- **Additional instructions**: source-specific constraints, exclusions, evidence requirements, tone, or mandatory data points.

`generate-ppt-deck-blueprint` sends this brief with the source text to OpenAI before any slide is drafted. The Blueprint maps the required sections into a coherent page plan with no more than ten slides per section. It defines what each section must accomplish and the audience question it must answer, then reserves a contiguous range of slides for that work. The client then calls `generate-ppt-slide-plan` once per section, with at most two section calls in flight for normal requests and one for detailed or long decks. Every request receives a short handoff derived from the shared Blueprint. This keeps 50- to 100-slide work bounded, retryable by section, rate-limit aware, and grounded in one shared storyline. The selected QLEARN template remains a style reference, not a reason to repeat the same composition on every slide.

## Important files

- `/ppt-maker`: `src/pages/pptMaker/PptMakerPage.tsx`
- `/ppt-admin`: `src/pages/pptAdmin/PptAdminPage.tsx`
- Slide JSON planner: `src/services/pptMaker.service.ts`
- Layout engine: `src/services/pptDocument.service.ts`
- Shared HTML/CSS slide: `src/components/pptMaker/PptHtmlSlide.tsx`
- Export-only DOM deck: `src/components/pptMaker/PptDomExportDeck.tsx`
- PPTX exporter: `src/services/pptExport.service.ts`

## Supabase functions

- `generate-ppt-deck-blueprint`: whole-deck strategy, sections, page ranges, and section QA.
- `analyze-ppt-request`: extracts and validates the request-level PPT production conditions before Blueprint planning.
- `generate-ppt-slide-plan`: section-level OpenAI copy planning and QA (maximum ten slides per call).
- `create-ppt-generation-job`: saves a `layout-only` deck plan; it creates no image items for new projects.
- `save-pptx-output`: uploads browser-created PPTX output to `ppt-generations/{jobId}/final/`.

## Environment

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_USE_MOCK=false
```

Supabase server secrets:

```dotenv
OPENAI_API_KEY=
OPENAI_PPT_PLAN_MODEL=gpt-5
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` in the Vite environment. The service role key remains inside Supabase functions for Storage persistence only.

## Deployment

```powershell
supabase functions deploy generate-ppt-slide-plan --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy generate-ppt-deck-blueprint --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy analyze-ppt-request --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy create-ppt-generation-job --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy save-pptx-output --project-ref vhktpqsxzcihwijnfaaf
```

## Quality checks

The browser flow validates copy before layout generation and uses the same DOM for preview and export. `dom-to-pptx` is the primary editable converter; the PptxGenJS fallback keeps export available where DOM conversion cannot run.

Every generated deck must satisfy these automated standards before it becomes exportable:

- **Copy integrity:** no clipped ellipses, replacement characters, placeholder copy, mixed target language, duplicate messages, or empty planning fields.
- **Readable editable text:** every text box fits its PowerPoint bounds and stays at or above 7pt after fitting. Detailed English and Korean content is tested across all 12 supported visual structures, including five-proof-point layouts.
- **Design hierarchy:** every slide includes a prominent title, main message, three or more proof-point panels, takeaway, decision, page number, and logo slot.
- **Template fidelity:** the selected template's primary color, accent color, surface colors, and at least one of its recommended visual structures are applied to the editable layout.
- **Contrast and spacing:** primary and supporting text meet a 4.5:1 contrast ratio on their actual rendered surfaces, content stays within slide safe areas, editable text blocks cannot overlap, body content remains above the footer, and every proof point must fit inside its matching panel.
- **Density consistency:** `Light`, `Standard`, and `Detailed` decks require at least three, four, and five proof points respectively. The local mock generator follows the same policy as production planning.
- **Structure variety:** the deck has no consecutive repeated visual structure and contains the required minimum of distinct layouts for its length.
- **Role integrity:** every Slide JSON record receives one valid communication role. The planner makes the title, proof points, decision, and selected visual structure support that role instead of treating the slide as an undifferentiated summary.
- **Narrative continuity:** every non-opening slide links to its direct predecessor and resolves its handoff question; every non-final slide hands off exactly one next question; the final slide closes the chain without an unresolved question.
- **Table-of-contents integrity:** sections cover the requested slide count once and in order, every section has a distinct role and audience-facing key question, and each generated batch stays inside its reserved slide range.
- **Purpose-template fidelity:** the selected purpose template's baseline stages and composition rules are carried into the Blueprint and section briefs; an IR deck ends in an investment ask, a proposal ends in a decision request, a report ends in accountable next actions, and education material ends in learner action.
- **Source integrity:** every numeric claim generated while a source registry is available must reference a recorded source ID. Preview and editable PowerPoint layouts render a short citation, while the output panel retains the full source name, document name, publication year, URL, and verification date for review.

The QA checks run in `pptDocument.service.ts`, `pptTextLayout.ts`, and `pptDesignQuality.ts`. Unit tests cover copy QA, text fit, palette contrast, safe margins, proof-panel hierarchy, and the editable PPTX ZIP output.

LibreOffice rendering, PDF conversion, and pixel comparison require a separate long-running Node/container QA worker. They are deliberately not put back into the interactive export path, because that would reintroduce the timeout behavior this architecture removes.

```powershell
npm run lint
npm run test:run
npm run build
```
# External Integration

For trusted server-to-server integrations, use the modular external API described in [PPT External API](ppt-external-api.md). It exposes request analysis, blueprinting, section-level planning, job persistence, PPTX upload, and output polling without exposing any OpenAI or Supabase service-role credentials to a browser.

# PPT Maker Implementation Notes

## Current flow

`/ppt-maker` creates editable presentations without a slide-image generation step:

1. `generate-ppt-deck-blueprint` uses OpenAI to create and validate the whole-deck strategy: core thesis, audience need, desired outcome, narrative arc, and contiguous named sections.
2. Each Blueprint section contains a purpose, key message, page range, and visual focus. A section contains at most ten slides, so a 50-slide deck is planned as five coherent section batches rather than one oversized response.
3. `generate-ppt-slide-plan` creates Section Slide JSON batches with a bounded concurrency of two. Each call receives the controlling Blueprint and a Blueprint-derived handoff from the preceding sections, so the story continues without waiting for another section request to finish.
4. Each Slide JSON record contains a decision-oriented title, slide objective, main message, three to five supporting proof points (`heading` + complete `detail`), a recommended decision, and a varied visual structure.
5. `pptDocument.service.ts` is the layout engine. It maps the approved plan to editable text, shape, footer, and logo rules.
6. `PptHtmlSlide.tsx` renders the same plan as HTML/CSS for both the visible preview and an off-screen export surface.
7. `dom-to-pptx` converts that HTML/CSS surface into editable PowerPoint objects. `PptxGenJS` remains the browser fallback and supplies the manual-addition slide.
8. List optionally sends the finished binary to `save-pptx-output`, a short Supabase Storage request.

The primary path does not call `generate-ppt-image-deck`, Claude, a Netlify worker, or a long-running edge function.

## Presentation planning brief

The maker turns the initial request into an explicit planning brief before it creates Slide JSON. Use the input fields to define the presentation rather than hiding these requirements in the source text:

- **Audience** and **Purpose**: who must understand the material and what outcome the deck should create.
- **Presentation format**: selects a default narrative and design guide for an executive proposal, strategic decision, education session, investment or IR deck, or implementation roadmap.
- **Core message**: the single conclusion that the cover, evidence slides, and closing decision must reinforce.
- **Required sections**: named content that must appear in the narrative arc, such as the current challenge, operating model, rollout, and decision request.
- **Content detail**: `Light` produces three concise proof points, `Standard` produces four contextual proof points, and `Detailed` produces five substantial proof points on each slide.
- **Additional instructions**: source-specific constraints, exclusions, evidence requirements, tone, or mandatory data points.

`generate-ppt-deck-blueprint` sends this brief with the source text to OpenAI before any slide is drafted. The Blueprint maps the required sections into a coherent page plan with no more than ten slides per section. The client then calls `generate-ppt-slide-plan` once per section, with at most two section calls in flight. Every request receives a short handoff derived from the shared Blueprint rather than waiting for earlier model output. This keeps 50- to 100-slide work bounded, retryable by section, parallel where safe, and grounded in one shared storyline. The selected QLEARN template remains a style reference, not a reason to repeat the same composition on every slide.

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
OPENAI_PPT_PLAN_MODEL=gpt-4o
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` in the Vite environment. The service role key remains inside Supabase functions for Storage persistence only.

## Deployment

```powershell
supabase functions deploy generate-ppt-slide-plan --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy generate-ppt-deck-blueprint --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy create-ppt-generation-job --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy save-pptx-output --project-ref vhktpqsxzcihwijnfaaf
```

## Quality checks

The browser flow validates copy before layout generation and uses the same DOM for preview and export. `dom-to-pptx` is the primary editable converter; the PptxGenJS fallback keeps export available where DOM conversion cannot run.

LibreOffice rendering, PDF conversion, and pixel comparison require a separate long-running Node/container QA worker. They are deliberately not put back into the interactive export path, because that would reintroduce the timeout behavior this architecture removes.

```powershell
npm run lint
npm run test:run
npm run build
```

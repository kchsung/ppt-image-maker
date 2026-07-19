# PPT Maker Detailed Product Specification

## 1. Purpose

PPT Maker converts source material into a presentation in three deliberate stages:

1. An LLM plans the story, the copy, and a different composition for each slide.
2. OpenAI creates one high-quality slide image per approved slide as the visual reference.
3. Claude recreates the full deck as a native PPTX, keeping copy editable and preserving only complex artwork as raster assets.

The product is not an image-to-PPT converter that simply places one PNG on each slide. The expected output is a presentation whose message, composition, and editable text are aligned with the generated reference images.

## 2. Goals And Non-Goals

### Goals

- Produce a coherent 16:9 business presentation from pasted source text.
- Keep all user-facing slide copy in the selected language.
- Prevent placeholder text, page-marker fragments, ellipses used as omitted copy, and mixed-language copy unless the user explicitly requests it.
- Use a selected template or uploaded reference image as a style reference, without repeating the same layout across the full deck.
- Create editable title, subtitle, label, body, takeaway, and footer text in Pretendard.
- Rebuild simple diagrams as native shapes where practical; retain complex illustrations as images when editable reconstruction would reduce fidelity.
- Save source images, job status, and final PPTX so users can resume, preview, download, retry, or delete a project.
- Make long-running PPTX generation observable and recoverable without relying on an open browser tab.

### Non-Goals For The Current Release

- A full browser-based PowerPoint editor.
- Pixel-perfect OCR of arbitrary uploaded presentations.
- Automatic translation between languages after a deck plan is approved.
- Real-time collaborative editing or user-level sharing permissions.
- Automatic replacement of a finished PPTX when a single slide image changes; this requires a new PPTX generation run.

## 3. Users And Access

### Primary User

A presenter, consultant, educator, or startup operator who has source notes and needs a polished first-draft deck with editable text.

### Current Access Assumption

The current prototype has no sign-in. The List page therefore shows projects available through the configured Supabase project. This is acceptable only for internal or controlled use.

### Required Product Decision Before External Release

Choose one of the following before exposing this service to external users:

1. Add Supabase Auth and associate each project, image, and PPTX with `user_id`.
2. Restrict the application to a private company network and use private Storage URLs.

Public Storage must not be used for confidential source material, customer logos, or generated presentations.

## 4. End-To-End User Journey

1. User opens **PPT Maker**.
2. User enters source text, audience, purpose, target language, and target slide count.
3. User selects either a numbered template or uploads a sample slide image. The user may optionally upload a logo.
4. User submits the request.
5. The app creates a slide copy plan and performs copy and layout QA before any image is requested.
6. The app creates a project record and generates one reference image per slide.
7. User can inspect planning details and completed images while generation continues.
8. When all images are complete, the project becomes ready for PPTX generation.
9. User starts PPTX generation from the List page. A Netlify Background Function invokes Claude and persists progress independently of the browser session.
10. When complete, the List page exposes PPTX preview and download. The original images and plan remain available for review.

## 5. Input Requirements

### Mandatory Fields

| Field | Requirement | Validation | Default |
| --- | --- | --- | --- |
| Source text | Material to turn into a deck | Non-empty after trimming; minimum 30 characters | None |
| Audience | Intended viewer | 2-120 characters | `General business audience` |
| Purpose | Expected decision, lesson, or action | 2-160 characters | `Explain the topic clearly` |
| Target language | `Korean` or `English` | Must be selected | Korean |
| Slide count | Desired content slide count | Integer from 3 to 12 | 6 |
| Style source | Numbered template or one sample image | Exactly one active source | Template 01 |

### Optional Fields

| Field | Behaviour |
| --- | --- |
| Logo | Image file used only in the top-right logo area of the final PPTX. |
| Style reference notes | Extra style guidance, not a source of slide copy. |

### Logo Rules

- Accepted formats: PNG, JPG, JPEG, SVG only if the renderer supports it reliably.
- Maximum upload size: 5 MB.
- Preserve aspect ratio and reserve a fixed top-right safe area.
- When no logo is supplied, show the Korean placeholder `로고` in the reference and final editable deck.
- A logo must never overlap the title safe area on the left.

### Source Text Rules

- Source text can contain Korean or English regardless of the selected output language.
- The selected target language governs all generated slide copy, including title, labels, takeaway, footer, and speaker notes.
- The source text itself is retained only as project input; it must not be copied verbatim into slides without LLM review.
- A user should see a concise warning if source text is too short to support the requested number of slides.

## 6. Slide Copy Planning

### Planning Output Contract

The planning LLM must return a `DeckPlan` containing:

- Deck title and output file name.
- One slide object per requested content slide.
- `pageNumber`, story role, visual structure, main message, title, subtitle, labels, takeaway, and image composition instruction for every slide.
- A single deck-level narrative arc explaining the order of slides.

### Required Narrative Arc

The planner should adapt the arc to the source material, but must use clear story roles. A typical business deck may contain:

1. Hero or executive framing.
2. Context, problem, or opportunity.
3. Evidence, audience, or current-state diagnosis.
4. Solution, operating model, or framework.
5. Process, roadmap, or implementation plan.
6. Expected value, metrics, or proof.
7. Decision, next step, or closing commitment.

Not every deck needs every role. The first slide must be a hero or executive framing slide, and the final slide must be a closing, decision, or next-step slide.

### Composition Diversity Contract

For each slide, the planner chooses one visual structure from the supported set:

- Hero visual
- Message emphasis
- Card grid
- Comparison
- Numbered process
- Before/after mapping
- Hub and spoke
- Metrics dashboard
- Roadmap
- Pyramid framework
- Case story
- Closing commitment

Rules:

- Adjacent slides cannot use the same structure.
- A deck uses at least `min(slide count, 4)` distinct structures.
- The structure must fit the message. For example, a comparison structure needs a real contrast, and a roadmap needs sequential phases.
- The selected template controls visual language such as palette, line weight, corner treatment, and typography. It does not force one repeated composition.

### Copy QA Rules

Before image generation, validate every slide:

- Target-language compliance.
- No `...`, ellipsis, `TBD`, lorem ipsum, page numbers used as copy, bracketed placeholders, or template labels left in the copy.
- Title is short enough for two lines in the editable title safe area.
- Subtitle, labels, and takeaway have explicit maximum lengths based on their target regions.
- Each slide communicates one decision-oriented message rather than a collection of unrelated points.
- Slide titles are not duplicated or near-duplicated.
- Source fragments such as `Moves From Insight To`, `Designed for`, or `1페이지` are rejected unless explicitly meaningful content.

### QA Repair Policy

1. The planner receives the failures and repairs the full plan once.
2. The repaired plan is validated again.
3. If it still fails, do not create a generation job. Show the precise failing slide and reason, then let the user edit input and resubmit.

The user must be able to open a right-side planning detail panel to view the deck title, slide structure, approved copy, and validation result before images begin.

## 7. Slide Image Generation

### Purpose

Generated images are visual references for style, hierarchy, and complex artwork. They are not the final PPTX and must not be treated as a substitute for editable copy.

### Prompt Requirements

Every image prompt must include:

- The template or uploaded reference image.
- The selected visual structure and composition instruction.
- The approved title, subtitle, labels, and takeaway exactly as supplied by the plan.
- Target language and the instruction not to introduce a second language.
- 16:9 slide aspect ratio.
- Explicit title safe area at top left and logo safe area at top right.
- Instruction to render all approved text legibly with no truncation.

### Image Quality Rules

- All approved textual content must be present and readable at normal presentation scale.
- Avoid text placed over visually noisy regions.
- Preserve whitespace around title, logo, footer, and page number regions.
- Do not add invented company names, URLs, legal text, or fabricated metrics.
- Do not use visual elements that conflict with the chosen structure.

### Concurrency And Rate Limits

- A job requests one slide image per worker invocation, never the entire deck in one request.
- The client can queue multiple pending slides, but the service must enforce an organization-level OpenAI rate limit.
- Initial operational policy: one active image request per project and a configurable global concurrency limit. The queue retries rate-limit failures with exponential backoff using the API-provided retry delay when available.
- A retry must target only the selected failed or regenerated slide; it must not overwrite another slide.

### Image Result States

| State | Meaning | User Action |
| --- | --- | --- |
| Pending | Not started | Wait or cancel project |
| Generating | Request accepted | View progress only |
| Succeeded | Image stored | Preview or regenerate this slide |
| Failed | Terminal image error | Retry this slide |
| Retrying | Backoff scheduled | Wait; retry control remains disabled |

## 8. Editable PPTX Reconstruction

### Source Of Truth

The approved `DeckPlan` is the source of truth for text. Generated slide images are the source of truth for visual treatment and approximate text placement.

### Claude Reconstruction Requirements

Claude receives all approved slide images, the plan, and optional logo. For each slide it must produce:

1. An editable layout manifest with text boxes, their copy, bounds, hierarchy, font, alignment, color, and layer order.
2. Native shapes for simple lines, arrows, cards, circles, tables, and diagrams when they can be recreated without meaningful quality loss.
3. Cropped or full-image raster layers only for illustrations, complex iconography, textured backgrounds, or elements that are not reliably reproducible as editable shapes.
4. A native editable PPTX generated through the official Anthropic `pptx` skill and code execution.

### Text Placement Rules

- Extract the visual text regions from the reference image as placement evidence, but replace their content with the approved plan copy.
- Do not place generic fixed-layout text boxes on top of unrelated visual regions.
- Title area is left aligned; logo is placed in the top-right safe area.
- Every editable text box uses `Pretendard`. If unavailable in a viewer, PowerPoint may substitute a local fallback, but the PPTX font family must be set to Pretendard.
- Text must not be hidden behind a raster layer, clipped, or reduced below the minimum readable size.
- No text is baked into the background solely because it is easier to export.

### Minimum Editable Elements Per Content Slide

- Title
- Subtitle when present
- Labels or section headings
- Takeaway or decision statement
- Footer and page number where present

Complex illustrations may remain raster. The deck must not claim that every visual is editable.

### Manual Template Slide

The final PPTX includes one additional final slide in the selected style. It contains editable placeholder regions for title, subtitle, labels, body text, takeaway, logo, and page number so the user can add a consistent slide manually.

## 9. Project, Job, And File Lifecycle

### Project Record

One project corresponds to one deck plan, its selected style source, all reference images, and zero or more PPTX attempts.

### Status Model

| User-facing status | System condition | Allowed action |
| --- | --- | --- |
| Planning | Copy plan is being created or repaired | View planning progress |
| Planning failed | Copy or QA cannot be approved | Return to input and resubmit |
| Generating images | At least one image item is pending or running | View images; retry failed item only |
| Images failed | One or more image items failed | Retry failed items or regenerate selected item |
| Ready for PPTX | All required images succeeded | Generate PPTX |
| PPTX queued | Supabase accepted the request and dispatched the worker | Wait; show execution ID internally |
| PPTX generating | Netlify worker has started | Show current phase, percent, and last update time |
| PPTX ready | File exists in Storage and validation passed | Preview, download, regenerate PPTX |
| PPTX failed | Worker reached a terminal error | Show reason and allow retry |
| Deleted | Project and files removed | No further action |

### PPTX Progress Contract

The worker must persist the following with an `updatedAt` timestamp:

- `queued` at 5%: worker dispatch accepted.
- `uploading_references` at 15%: slide and logo uploads to Claude.
- `rebuilding_slides` at 35%: Claude PPTX task is active.
- `downloading_output` at 80%: generated file retrieval.
- `saving_file` at 92%: Supabase Storage upload.
- `ready` at 100%: stored PPTX has a valid path and preview URL.

While rebuilding slides, the worker sends a heartbeat at least every 60 seconds. The List page displays both the phase and "last update" timestamp.

### Stale And Timeout Policy

- A job with no progress update for 3 minutes is marked `PPTX attention required` and displays the last known phase.
- A Netlify Background Function may run for up to 15 minutes. The worker's Claude request timeout must be less than that platform limit.
- If the worker exceeds its configured Claude timeout, it writes a terminal `failed` status with a retryable message.
- If a platform timeout occurs before the worker can write failure state, the List page marks the attempt stale and enables **Restart PPTX**.
- A new attempt always receives a new `executionId`. Updates from an older execution ID must be ignored.

### Retry And Idempotency Rules

- Only one active PPTX execution is allowed per project.
- **Generate PPTX** is disabled only while the current attempt is active.
- **Restart PPTX** becomes available for failed or stale attempts after explicit user confirmation.
- **Regenerate PPTX** is available for a completed project and creates a new PPTX attempt using the same approved plan and images.
- Slide-image retry changes only that image item. It invalidates any previously created PPTX and returns the project to `Ready for PPTX` after the new image succeeds.
- The worker must not overwrite an existing successful PPTX unless the user requested regeneration.

## 10. Screens And Interaction Requirements

### PPT Maker Input

- Use a two-tab flow: **Input** and **Output**.
- Template selection uses a carousel with one prominent preview rather than rendering all templates simultaneously.
- Selected template number, name, description, and accent are visible.
- Upload and template modes are mutually exclusive.
- The submit control is disabled until all mandatory input passes local validation.

### Generation Output

- Show three progress stages: **Structuring slides**, **Generating images**, and **Preparing PPT**.
- Each stage offers a detail control opening a right-side drawer.
- Planning drawer: approved deck title, narrative, slide copy, structure, and QA outcome.
- Image drawer: `completed / total`, image thumbnails, per-slide status, and errors.
- PPT drawer: phase, percentage, last update time, active execution status, and any terminal error.
- When PPTX is ready, show final PPTX preview as the primary preview. Reference-image preview remains available as a secondary view.

### PPT List

- Navigation label: **List**, not Admin.
- Show at most three projects per page.
- Each project displays title, created date, slide count, image status, PPTX status, phase, progress, and last update time.
- Slide thumbnails appear in one horizontal, scrollable row.
- Each thumbnail has a per-slide regenerate or retry action with a visible in-progress state.
- Completed projects show **Preview PPTX**, **Download PPTX**, and **Regenerate PPTX**.
- Incomplete projects show only actions that are valid for their current state.
- Delete requires confirmation and clearly states that images and final files are removed.

### Mobile

- The navigation collapses into a hamburger menu.
- No essential action may be hidden behind horizontal page overflow.
- Slide thumbnail rows may scroll horizontally, but project controls, status, and errors remain readable without horizontal scrolling.

## 11. Error Messages And Supportability

Error messages must identify the stage and user action. Do not show raw provider payloads as the primary message.

| Condition | User-facing message | Action |
| --- | --- | --- |
| Copy plan invalid | `Slide copy planning needs revision: [reason]` | Return to Input |
| OpenAI key missing | `Image generation is not configured.` | Contact administrator |
| OpenAI rate limit | `Image generation is queued. Retrying after [time].` | Wait or retry later |
| One image failed | `Slide N could not be generated: [reason]` | Retry Slide N |
| Worker dispatch failed | `PPTX worker could not start.` | Retry PPTX after configuration check |
| Worker stale | `No PPTX worker update was received since [time].` | Restart PPTX |
| Claude timeout | `Claude did not finish the PPTX in time.` | Restart PPTX |
| PPTX validation failed | `The generated file could not be validated.` | Regenerate PPTX |

Operational logs must contain `jobId`, `executionId`, slide count, current phase, provider request outcome, and terminal error category. Logs must never contain source text, API keys, shared secrets, data URLs, or full file contents.

## 12. Storage, Retention, And Deletion

### Storage Layout

- Templates: `ppt-templates/template-NN.png`
- Slide images: `ppt-generations/{jobId}/slides/`
- Final PPTX: `ppt-generations/{jobId}/final/`
- Optional logo source: `ppt-generations/{jobId}/logo/`

### Retention Policy To Decide

The product owner must choose and document one policy before production release:

- Automatic deletion after 30 days for all generated files, or
- Retention until the project owner deletes the project.

The current List delete operation must delete the database records and every Storage object under the job prefix. Failed and abandoned runs must be covered by the same policy.

## 13. Security Requirements

- `OPENAI_API_KEY`, `CLAUDE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `PPT_WORKER_SECRET` remain server-only values.
- The browser receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Supabase dispatches to the worker with `X-Ppt-Worker-Secret`; the worker rejects unmatched requests.
- Shared secrets are never committed, displayed in UI, logged, or embedded in frontend builds.
- The frontend Netlify site must not receive worker or LLM secrets.
- The worker must be a Netlify Background Function, not an Edge Function, because editable PPTX generation may exceed a standard request timeout.

## 14. Acceptance Criteria

### Copy And Planning

- For Korean output, all generated slide copy is Korean except permitted proper nouns and requested product names.
- For English output, all generated slide copy is English except permitted proper nouns and requested Korean brand names.
- A 10-slide deck uses at least four different visual structures and no adjacent duplicate structure.
- QA stops generation before image creation when copy violates the rules.

### Images

- Every successful image corresponds to exactly one planned slide.
- Retrying Slide 4 cannot regenerate, overwrite, or change Slide 1.
- A rate-limited image request enters a visible retry state rather than failing the entire project immediately.

### PPTX

- The final file is a valid `.pptx` stored in Supabase Storage.
- At least title, subtitle, labels, takeaway, and footer are editable text objects on each content slide.
- Text uses Pretendard in the PPTX font definition.
- Logo is top-right; title is not obscured.
- The final manual template slide is present.
- Preview represents the final PPTX, not merely the generated reference PNG.

### Operations

- Closing the browser does not cancel PPTX generation.
- List refresh shows the latest phase and last update time.
- A worker that exceeds the timeout ends in `failed` or `attention required`, never an indefinite 35% state.
- A stale or failed PPTX attempt can be restarted without creating duplicate active executions.

## 15. Test Plan

### Unit Tests

- Language, placeholder, ellipsis, title-length, and mixed-language QA.
- Structure diversity and first/last slide role validation.
- Image prompt includes approved copy and chosen composition.
- Job state transition guards and execution ID matching.
- Retry targets the correct generation item.

### Integration Tests

- Plan approval precedes job creation and image calls.
- Image completion enables PPTX generation.
- Supabase dispatcher sends the worker URL and secret but never exposes them to the client.
- Worker status updates map to the List UI state.
- Stale worker detection enables restart.

### Manual Release Checks

1. Korean six-slide deck with a template and no logo.
2. English ten-slide deck with a template and a logo.
3. Uploaded sample style image flow.
4. One slide image retry under a simulated rate limit.
5. PPTX worker success, timeout, retry, preview, download, and deletion.
6. Desktop and mobile navigation checks.

## 16. Open Decisions

| Decision | Owner | Why It Matters |
| --- | --- | --- |
| Authentication and project ownership | Product owner | Needed before external use and private content support. |
| Storage access and retention duration | Product owner / security | Determines privacy, cost, and deletion behaviour. |
| Maximum image and PPTX generation budget per user or team | Product owner | Controls LLM and image generation cost. |
| Allowed Netlify plan and worker runtime | Platform owner | Background Functions must have enough runtime for Claude PPTX generation. |
| Preview provider and access model | Product owner / platform owner | Office viewer requires a reachable file URL; private files need signed URL handling. |
| Cancellation semantics | Product owner | Provider calls cannot always be stopped; UX must define whether cancellation stops queued work only. |

## 17. Implementation Traceability

- Current implementation notes: `docs/ppt-maker.md`
- Worker deployment and operational guide: `docs/netlify-pptx-worker.md`
- User route: `/ppt-maker`
- Saved project route: `/ppt-admin`

This specification is the product contract. When implementation and this document differ, the difference must be recorded as either a deliberate scope change or a defect.

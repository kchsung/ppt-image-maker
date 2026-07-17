# PPT Maker Implementation Notes

## Overview

`/ppt-maker` is an image-based PPT generation feature for QLEARN Startup. It takes source text and either a numbered template or an uploaded sample slide image, generates slide images through Supabase Edge Functions and OpenAI, stores generated images in Supabase Storage, and exports a full-bleed PPTX in the browser with PptxGenJS.

The implementation intentionally avoids doing the whole deck generation inside one Edge Function call. Supabase Free tier Edge Functions can time out on long-running image/PPT work, so the flow is split into a job plus one image-generation call per slide.

## User Flow

1. User opens `http://127.0.0.1:5173/ppt-maker`.
2. User enters source text, audience, purpose, language, and slide count.
3. User chooses a style source:
   - Template carousel: `Template 01` through `Template 16`
   - Uploaded sample slide image
4. User clicks `Generate PPT images`.
5. App switches to the Output tab and shows progress.
6. App creates a deck plan locally.
7. App registers a Supabase generation job.
8. App calls the image Edge Function once per slide.
9. Edge Function stores each generated slide image in Supabase Storage and updates job/item status.
10. App calls the document enhancement Edge Function for PPT metadata and speaker notes.
11. User reviews generated images and exports PPTX in the browser.

## Main Route And UI Files

- Route: `/ppt-maker`
- Page: `src/pages/pptMaker/PptMakerPage.tsx`
- Form and template carousel: `src/components/pptMaker/PptMakerForm.tsx`
- Progress panel: `src/components/pptMaker/GenerationProgressPanel.tsx`
- Output image deck panel: `src/components/pptMaker/GeneratedImageDeckPanel.tsx`
- Redux slice: `src/features/pptMaker/pptMakerSlice.ts`
- Model types: `src/types/models/pptMaker.model.ts`

## Services

- `src/services/pptMaker.service.ts`
  - Builds a `PptDeckPlan` from source text.
  - Calls `create-ppt-generation-job`.
  - Calls `generate-ppt-image-deck` once per slide.
  - Combines returned slide images into `GeneratedImageDeck`.

- `src/services/pptDocument.service.ts`
  - Calls `enhance-ppt-document` for deck title, file name, notes, and QA checklist.

- `src/services/pptExport.service.ts`
  - Uses `pptxgenjs` in the browser.
  - Converts Storage image URLs to data URLs when needed.
  - Creates a wide 16:9 PPTX with each image as a full-slide background.

- `src/utils/supabaseFunctionError.ts`
  - Reads the JSON body from Supabase `FunctionsHttpError`.
  - Shows useful errors such as `OPENAI_API_KEY is not configured.` instead of only `Edge Function returned a non-2xx status code`.

## Templates

Template metadata lives in:

- `src/mocks/pptTemplates.mock.ts`

The image files are stored in the public Supabase Storage bucket:

- Bucket: `ppt-templates`
- Public URL base: `https://vhktpqsxzcihwijnfaaf.supabase.co/storage/v1/object/public/ppt-templates`
- Current objects: `template-01.png` through `template-16.png`

To add a new template:

1. Upload the PNG to `ppt-templates/template-NN.png`.
2. Add a matching entry to `src/mocks/pptTemplates.mock.ts`.
3. Include `id`, `templateNumber`, `label`, `name`, `description`, `accentColorLabel`, `imageUrl`, and `storagePath`.

Example upload with Supabase CLI:

```powershell
supabase --experimental storage cp --content-type image/png .tmp\template-17.png ss:///ppt-templates/template-17.png
```

## Supabase Database

Migration:

- `supabase/migrations/20260716143000_create_ppt_generation_jobs.sql`

Tables:

- `generation_jobs`
  - One row per deck generation request.
  - Tracks `status`, `progress`, `total_items`, `completed_items`, request JSON, and errors.

- `generation_items`
  - One row per generated slide image.
  - Tracks item status, input, output Storage path, attempts, and error message.

Storage:

- `ppt-templates`
  - Public template reference images.

- `ppt-generations`
  - Public generated slide images.
  - Created by migration with PNG MIME type and 10 MB file size limit.

## Supabase Edge Functions

### `create-ppt-generation-job`

Path:

- `supabase/functions/create-ppt-generation-job/index.ts`

Responsibilities:

- Validate `deckPlan`.
- Create a `generation_jobs` row.
- Create one `generation_items` row per slide.
- Return `jobId` and item IDs immediately.

This function does not call OpenAI.

### `generate-ppt-image-deck`

Path:

- `supabase/functions/generate-ppt-image-deck/index.ts`

Responsibilities:

- Accept exactly one slide per invocation.
- Mark the job/item as `processing`.
- Load the selected template image or uploaded data URL.
- Call OpenAI image generation/edit API.
- Upload the generated PNG to `ppt-generations`.
- Mark the item as `succeeded` or `failed`.
- Update job progress.
- Return the generated image URL and metadata.

This one-slide-per-call structure is deliberate. It reduces timeout risk and allows partial retry/recovery later.

### `enhance-ppt-document`

Path:

- `supabase/functions/enhance-ppt-document/index.ts`

Responsibilities:

- Call OpenAI text API.
- Generate PPT title, file name, speaker notes, and QA checklist.

## Environment Variables

Local frontend `.env`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_USE_MOCK=false
```

Supabase Edge Function secrets:

```dotenv
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_TEXT_MODEL=gpt-5.6
```

Required:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_IMAGE_MODEL`
- `OPENAI_TEXT_MODEL`

If model secrets are not set, the Edge Functions use their default values.

Important:

- Do not commit `.env`.
- `.env` is ignored by `.gitignore`.
- Only `.env.example` should be committed.
- Supabase Edge Functions cannot read local `.env`; secrets must be set on the Supabase project.

Set OpenAI key from local `.env`:

```powershell
supabase login
$openAiKey = (Get-Content .env | Where-Object { $_ -match '^OPENAI_API_KEY=' } | Select-Object -First 1) -replace '^OPENAI_API_KEY=', ''
supabase secrets set "OPENAI_API_KEY=$openAiKey" --project-ref vhktpqsxzcihwijnfaaf
```

Verify:

```powershell
supabase secrets list --project-ref vhktpqsxzcihwijnfaaf
```

## Deployment Commands

Apply database migrations:

```powershell
supabase db push --linked
```

Deploy Edge Functions:

```powershell
supabase functions deploy create-ppt-generation-job --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy generate-ppt-image-deck --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy enhance-ppt-document --project-ref vhktpqsxzcihwijnfaaf
```

## Validation

Run before merging:

```powershell
npm run lint
npm run test:run
npm run build
```

Expected:

- TypeScript compile passes.
- Vitest suite passes.
- Vite production build passes.

Known build warning:

- Vite may warn that chunks are larger than 500 KB because `pptxgenjs` is included. This is currently accepted for the prototype.

## Troubleshooting

### `Slide 1 image generation failed: OPENAI_API_KEY is not configured.`

The OpenAI key is missing from Supabase Edge Function secrets.

Fix:

```powershell
supabase secrets set "OPENAI_API_KEY=$openAiKey" --project-ref vhktpqsxzcihwijnfaaf
```

### Browser shows CORS plus 500

The root cause is usually the Edge Function 500. The browser can show it as a CORS-like failure if the gateway or function error response is interrupted.

Check:

```powershell
curl.exe -i -X OPTIONS https://vhktpqsxzcihwijnfaaf.supabase.co/functions/v1/generate-ppt-image-deck `
  -H "Origin: http://127.0.0.1:5173" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: authorization, x-client-info, apikey, content-type"
```

Expected header:

```text
Access-Control-Allow-Origin: *
```

### Image generation times out

The current design already splits image generation into one Edge Function call per slide. If a single slide still times out:

- Reduce image prompt complexity.
- Lower image model quality if supported.
- Retry only the failed item.
- Move generation to a long-running worker if production workloads grow.

### Supabase CLI cannot set secrets

If this appears:

```text
Access token not provided.
```

Run:

```powershell
supabase login
```

Then rerun the `supabase secrets set` command.

## Merge Checklist

- Copy `src/pages/pptMaker/PptMakerPage.tsx`.
- Copy `src/components/pptMaker/*`.
- Copy `src/features/pptMaker/pptMakerSlice.ts`.
- Copy `src/services/pptMaker.service.ts`, `pptDocument.service.ts`, and `pptExport.service.ts`.
- Copy `src/interfaces/pptMaker.interface.ts`.
- Copy `src/types/models/pptMaker.model.ts`.
- Copy `src/mocks/pptMaker.mock.ts` and `pptTemplates.mock.ts`.
- Copy `src/utils/pptMaker.ts` and `supabaseFunctionError.ts`.
- Copy Supabase functions under `supabase/functions/`.
- Copy migrations under `supabase/migrations/`.
- Add route `/ppt-maker`.
- Add reducer `pptMaker` to the Redux store.
- Add `.env.example` keys, but never commit `.env`.

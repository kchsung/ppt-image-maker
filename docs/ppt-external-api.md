# PPT External API

This API exposes the QLEARN PPT planning and delivery workflow to server-side integrations. It is intentionally modular: a caller plans a request, creates a deck blueprint, creates section plans, renders an editable PPTX with its own renderer, saves the file, and then polls the saved job.

The modular contract avoids placing a 20 to 100-slide request in one Edge Function execution. It also lets an integrator render Slide JSON with its own HTML/CSS, `dom-to-pptx`, or `PptxGenJS` implementation.

## Endpoint And Authentication

Deploy the `ppt-api` Edge Function without Supabase JWT verification. It has its own mandatory server-side API key check.

```powershell
$apiKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
supabase secrets set PPT_EXTERNAL_API_KEY=$apiKey
supabase functions deploy ppt-api --no-verify-jwt
```

The endpoint is:

```text
https://<your-supabase-project-ref>.supabase.co/functions/v1/ppt-api
```

Send the key only from a trusted backend:

```http
x-ppt-api-key: <PPT_EXTERNAL_API_KEY>
Content-Type: application/json
```

Do not use `VITE_PPT_EXTERNAL_API_KEY`, do not send this key from a browser, and do not commit it to `.env` files. The public `VITE_SUPABASE_ANON_KEY` cannot replace it because it is deliberately safe to expose to clients.

## Request Contract

All calls use `POST` and a JSON body with an `action` field.

| Action | Required payload | Result |
| --- | --- | --- |
| `analyze-request` | `request` (`PptMakerRequest`) | Extracted topic, purpose, audience, timing, density, sources, and follow-up questions. |
| `create-blueprint` | `request` | Deck strategy, sections, per-section question, slide allocation, and visual direction. |
| `create-section-plan` | `request` with `deckBlueprint` and `planningBatch` | Editable `PptDeckPlan` for one section batch. |
| `create-job` | `deckPlan` | A persisted layout-only generation job for the exported PPTX. |
| `save-pptx` | `jobId`, `fileName`, `pptxBase64` | Stores a completed `.pptx` and marks the job succeeded. |
| `get-job` | `jobId` | Job progress, PPTX state, result path, and public download URL. |

`save-pptx` accepts a maximum 25 MiB base64 payload. For larger decks, upload directly to a private integration storage service and adapt the server-side save contract rather than placing a large file in an HTTP JSON body.

## Recommended Workflow

1. Send the complete presentation request to `analyze-request`.
2. Apply clarification answers or defaults, then send the completed request to `create-blueprint`.
3. Split the returned sections into planning batches. Use two to four slides per batch for standard decks and one to two for dense, source-heavy decks.
4. Call `create-section-plan` for each batch. A concurrency of one or two is recommended to stay under OpenAI rate limits.
5. Merge slide plans in `pageNumber` order. Render the Slide JSON with your HTML/CSS layout engine, `dom-to-pptx`, or `PptxGenJS`.
6. Create a storage job through `create-job`.
7. Base64-encode the final PPTX and call `save-pptx`.
8. Poll `get-job` until `pptxStatus` is `succeeded`, then use `pptxUrl` for download or preview.

This repository's in-product renderer uses the same Slide JSON for browser preview and editable PPTX export. External server-side integrations should use `PptxGenJS` directly or run a controlled browser renderer when they need the same fidelity.

## Example: Request Analysis

```bash
curl -X POST "$PPT_API_URL" \
  -H "Content-Type: application/json" \
  -H "x-ppt-api-key: $PPT_EXTERNAL_API_KEY" \
  -d '{
    "action": "analyze-request",
    "request": {
      "sourceText": "Create an investor deck for QLEARN for Startup.",
      "targetLanguage": "English",
      "audience": "Seed investors",
      "purpose": "Secure a pilot and seed investment discussion",
      "slideCount": 12,
      "contentDensity": "standard",
      "presentationIntent": "investment-deck",
      "documentType": "investment",
      "styleReference": {
        "id": "external-default",
        "name": "Executive clarity",
        "notes": "Clean white canvas, deep navy type, restrained orange accent.",
        "primaryColorLabel": "deep navy",
        "accentColorLabel": "orange"
      }
    }
  }'
```

## Example: TypeScript Client

The repository includes a small client at `src/services/pptExternalApi.service.ts`. It is suitable for a Node.js backend, Next.js route handler, or another trusted server. Do not import it into browser code with a real API key.

```ts
import { createPptExternalApiClient } from '@qlearn/ppt-external-api';

const client = createPptExternalApiClient({
  baseUrl: process.env.PPT_API_URL!,
  apiKey: process.env.PPT_EXTERNAL_API_KEY!,
});

const analysis = await client.analyzeRequest(request);
const blueprint = await client.createBlueprint({ ...request, ...analysis });

// Build requests with deckBlueprint + planningBatch for each blueprint section.
const sectionPlan = await client.createSectionPlan(sectionRequest);
const job = await client.createJob(deckPlan);

// Render the deck with PptxGenJS or your own layout engine, then persist it.
await client.savePptx({ jobId: job!.id, fileName: 'qlearn-deck.pptx', pptxBase64 });
const completed = await client.getJob(job!.id);
```

The import path above is illustrative. Before publishing an npm package, export the client through your package entry point. Within this repository use the alias import `@/services/pptExternalApi.service`.

## Error Handling

The API returns JSON error objects for every failure, including upstream functions that return unexpected HTML. Treat `429`, `500`, `502`, and `503` as retryable with exponential backoff. Do not retry `400`, `401`, `404`, or `413` until the request, credentials, job id, or payload size is corrected.

`get-job` reports `pptxStatus` independently from the deck planning state. A job becomes downloadable only when `pptxStatus` is `succeeded` and `pptxUrl` is present.

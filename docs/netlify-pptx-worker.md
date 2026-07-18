# Netlify PPTX Worker

## Why this worker exists

Creating an editable PPTX requires Claude Files API uploads, a Claude Messages request with the `pptx` skill, possible `pause_turn` continuations, and a final Storage upload. That can exceed Supabase Free Edge Function's 150 second hard runtime limit.

The application now uses a two-part flow:

1. The Supabase `generate-claude-pptx` function validates the request, marks the job as queued, and dispatches it to Netlify.
2. The Netlify Background Function creates the PPTX, uploads it to Supabase Storage, and updates `generation_jobs.request.pptxGeneration` with progress and the terminal state.

Netlify Background Functions can run for up to 15 minutes. This must be a Background Function, not a Netlify Edge Function.

## Deploy the worker

1. Push this repository to GitHub.
2. In Netlify, select **Add new project** and import the same repository.
3. Configure the site with these build settings:
   - Base directory: `netlify-worker`
   - Build command: `npm run build`
   - Publish directory: leave empty
4. Deploy the site once. The worker endpoint will be:

   ```text
   https://YOUR-NETLIFY-SITE.netlify.app/pptx-worker
   ```

5. In Netlify **Site configuration > Environment variables**, add these values for production:
   - `CLAUDE_API_KEY`: Anthropic API key used only by the worker.
   - `CLAUDE_MODEL`: `claude-sonnet-5`.
   - `SUPABASE_URL`: the project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase server-only key. Never use this in the Vite app or commit it.
   - `PPT_WORKER_SECRET`: a long random shared secret.
6. Redeploy the Netlify site after saving variables.

## Connect Supabase to the worker

Set the same `PPT_WORKER_SECRET` and the worker URL as Supabase Edge Function secrets:

```powershell
supabase secrets set NETLIFY_PPT_WORKER_URL=https://YOUR-NETLIFY-SITE.netlify.app/pptx-worker --project-ref vhktpqsxzcihwijnfaaf
supabase secrets set PPT_WORKER_SECRET=YOUR_LONG_RANDOM_SECRET --project-ref vhktpqsxzcihwijnfaaf
supabase functions deploy generate-claude-pptx --project-ref vhktpqsxzcihwijnfaaf
```

The `PPT_WORKER_SECRET` protects the worker endpoint from unauthenticated callers. Generate it with a password manager or a cryptographically random string and keep it out of Git.

## Verify the flow

1. Generate a deck in PPT Maker until all slide images are complete.
2. Select **Generate PPTX** from the List page.
3. The project should show `PPTX Generating`, a phase label, and progress that refreshes automatically.
4. At completion it changes to `PPTX Ready`, then **Preview PPTX** and **Download PPTX** become available.
5. For failures, inspect the Netlify function log for `pptx.*` events and the project card's error message.

## Operational notes

- The job is asynchronous. Closing the browser does not stop the Netlify worker.
- Retry only after a terminal failure. The stored status prevents duplicate PPTX jobs for the same presentation.
- Netlify function logs cover the long-running Claude work. Supabase logs cover only dispatch and job-status reads.
- The worker writes the final file into the existing `ppt-generations` Supabase Storage bucket, so the frontend and List page remain unchanged.

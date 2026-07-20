import type { Config } from '@netlify/functions';
import { runPptxWorker } from './generate-pptx.mjs';

// The filename suffix makes this a Netlify Background Function. The custom
// path preserves the public worker URL used by the Supabase dispatcher.
export default async (request: Request): Promise<void> => {
  const response = await runPptxWorker(request);

  if (!response.ok) {
    throw new Error(`PPTX worker rejected the job (${response.status}).`);
  }
};

export const config: Config = {
  path: '/pptx-worker',
  background: true,
};

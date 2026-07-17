interface FunctionErrorBody {
  error?: unknown;
  message?: unknown;
}

export async function getSupabaseFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Supabase Edge Function failed.';
  const context = getErrorContext(error);

  if (!context || typeof context.clone !== 'function') {
    return fallback;
  }

  try {
    const payload = (await context.clone().json()) as FunctionErrorBody;
    const detail = typeof payload.error === 'string' ? payload.error : payload.message;

    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function getErrorContext(error: unknown): Response | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context : null;
}

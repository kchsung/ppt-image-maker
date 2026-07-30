import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '@/utils/concurrency';

describe('mapWithConcurrency', () => {
  it('limits active work while preserving input order', async () => {
    let activeCount = 0;
    let maximumActiveCount = 0;

    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      activeCount += 1;
      maximumActiveCount = Math.max(maximumActiveCount, activeCount);
      await new Promise((resolve) => window.setTimeout(resolve, 5));
      activeCount -= 1;
      return value * 10;
    });

    expect(result).toEqual([10, 20, 30, 40]);
    expect(maximumActiveCount).toBe(2);
  });

  it('rejects an invalid concurrency value', async () => {
    await expect(mapWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(
      'Concurrency must be a positive integer.',
    );
  });
});

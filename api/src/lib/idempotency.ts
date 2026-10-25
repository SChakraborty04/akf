import { isUniqueViolation } from './errors';

/**
 * Offline clients retry writes. The service layer already short-circuits when a
 * `clientId` was seen before, but two retries racing each other can both pass
 * that check; the loser then hits the unique index. Resolve that by returning
 * the winner's record instead of an error.
 */
export async function withClientIdRetry<R>(
  clientId: string | undefined,
  run: () => Promise<R>,
  lookupExisting: () => Promise<R | null>,
): Promise<R> {
  try {
    return await run();
  } catch (err) {
    if (clientId && isUniqueViolation(err, 'client')) {
      const existing = await lookupExisting();
      if (existing) return existing;
    }
    throw err;
  }
}

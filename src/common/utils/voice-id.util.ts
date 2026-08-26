import { randomUUID } from 'crypto';

type ExistsFn = (voiceId: string) => Promise<boolean>;

export async function generateUniqueVoiceId(
  exists: ExistsFn,
  options?: { maxAttempts?: number; prefix?: string },
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const prefix = options?.prefix ?? 'voice_';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = `${prefix}${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  throw new Error('VoiceId üretilemedi, lütfen tekrar deneyin.');
}

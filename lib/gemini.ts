import type { Part } from '@google/generative-ai';

/** Vision-capable flash aliases that still accept generateContent for new AI Studio keys. */
export const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

let quotaBlockedUntil = 0;
let cachedWorkingModel: string | null = null;

export function parseJsonFromText(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object') {
      return parsed[0] as Record<string, unknown>;
    }
  } catch {
    /* fall through to substring match */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function getApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  return key?.trim() || undefined;
}

export interface GeminiResult {
  text?: string;
  error?: string;
  model?: string;
}

function isFlashModel(name: string): boolean {
  const n = name.replace(/^models\//, '').toLowerCase();
  if (!n.includes('flash')) return false;
  if (/(tts|live|audio|embedding|aqa|robotics|computer-use|omni)/.test(n)) return false;
  // Image-generation models (gemini-*-flash-image) share a tiny quota and 429 the whole scan.
  if (n.includes('image')) return false;
  if (n.includes('exp') || n.includes('high-res')) return false;
  // Retired for new AI Studio keys — ListModels still returns them, generateContent 404s.
  if (/^gemini-1\.5/.test(n) || /^gemini-2\.0/.test(n) || /^gemini-2\.5-flash/.test(n)) return false;
  return true;
}

function modelPriority(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('lite') && n.includes('latest')) return 0;
  if (n.includes('latest')) return 1;
  if (n.includes('lite')) return 2;
  if (n.includes('3.5') || n.includes('3.6') || n.includes('3.8')) return 3;
  return 4;
}

function extractCandidateText(data: { candidates?: { content?: { parts?: { text?: string }[] } }[] }): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => p?.text).filter(Boolean).join('\n').trim();
}

function mimeFromDataUrl(imageBase64: string, fallback: string): string {
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  let mime = (match?.[1] || fallback || 'image/jpeg').toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  return mime;
}

function isQuotaError(raw: string): boolean {
  const lower = raw.toLowerCase();
  return raw.includes('429')
    || lower.includes('quota')
    || lower.includes('resource_exhausted')
    || lower.includes('rate limit')
    || lower.includes('exceeded your current');
}

function toUserFriendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (raw.includes('401') || raw.includes('403') || lower.includes('permission_denied') || lower.includes('unauthenticated') || lower.includes('invalid_api_key')) {
    return 'Invalid GEMINI_API_KEY — use a key from aistudio.google.com/apikey, then restart: npm run dev:clean';
  }
  if (isQuotaError(raw)) {
    return 'Gemini free-tier quota exceeded — wait 2–5 minutes before scanning again. Check usage at aistudio.google.com';
  }
  if (raw.includes('404') || lower.includes('not_found') || lower.includes('not found') || lower.includes('no working gemini model')) {
    return 'Gemini API not set up for this key — enable "Generative Language API" in Google Cloud, or create a key at aistudio.google.com/apikey. Then restart: npm run dev:clean';
  }
  if (lower.includes('block') || lower.includes('safety') || lower.includes('prohibited')) {
    return 'Image could not be analyzed (safety filter). Try a different photo.';
  }
  if (
    (lower.includes('invalid') && (lower.includes('image') || lower.includes('base64')))
    || lower.includes('unable to process input image')
    || lower.includes('image data is empty')
  ) {
    return 'Invalid image data — re-upload the photo and try again.';
  }
  if (raw.includes('Could not parse AI response')) {
    return 'AI responded but format was invalid — click Scan & Analyze once more.';
  }
  if (raw && raw !== 'all models failed' && raw !== 'empty AI response') {
    return `Gemini error: ${raw.slice(0, 160)}`;
  }
  return 'Could not analyze this photo. Wait a few minutes and try Scan & Analyze once.';
}

async function discoverFlashModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',
      { headers: { 'x-goog-api-key': apiKey } },
    );
    if (!res.ok) return [];

    const data = await res.json();
    const discovered = (data.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[]; name?: string }) =>
        m.supportedGenerationMethods?.includes('generateContent') && m.name)
      .map((m: { name: string }) => m.name.replace(/^models\//, ''))
      .filter(isFlashModel)
      .sort((a: string, b: string) => modelPriority(a) - modelPriority(b));

    if (process.env.NODE_ENV === 'development' && discovered.length) {
      console.log('[gemini] Available flash models:', discovered.slice(0, 6).join(', '));
    }
    return discovered;
  } catch {
    return [];
  }
}

async function resolveModelCandidates(apiKey: string, preferred?: string[]): Promise<string[]> {
  const merged = new Set<string>();
  if (cachedWorkingModel) merged.add(cachedWorkingModel);
  for (const m of preferred ?? []) merged.add(m);
  for (const m of GEMINI_MODELS) merged.add(m);
  for (const m of await discoverFlashModels(apiKey)) merged.add(m);
  return [...merged];
}

/** Tries models on 404/503/empty; stops on auth errors. Vision-quota 429 still cooldowns. */
async function geminiGenerateParts(
  apiKey: string,
  parts: Part[],
  options?: { jsonMode?: boolean; models?: string[] },
): Promise<GeminiResult> {
  if (Date.now() < quotaBlockedUntil) {
    return { error: toUserFriendlyError('429 quota cooldown active') };
  }

  const candidates = (await resolveModelCandidates(apiKey, options?.models))
    .filter(isFlashModel)
    .slice(0, 8);
  const bodyBase: Record<string, unknown> = {
    contents: [{ parts }],
  };
  if (options?.jsonMode !== false) {
    bodyBase.generationConfig = { responseMimeType: 'application/json' };
  }

  let lastMeaningfulError = '';
  let notFoundCount = 0;

  for (const modelName of candidates) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(bodyBase),
        },
      );

      if (!res.ok) {
        const errBody = await res.text();
        const raw = `${res.status} ${errBody.slice(0, 200)}`;

        if (res.status === 404) {
          notFoundCount++;
          lastMeaningfulError = raw;
          continue;
        }

        lastMeaningfulError = raw;

        if (res.status === 429 || isQuotaError(raw)) {
          quotaBlockedUntil = Date.now() + 120_000;
          if (process.env.NODE_ENV === 'development') {
            console.error('[gemini] quota exceeded — cooldown 2 min, model:', modelName);
          }
          return { error: toUserFriendlyError(raw) };
        }

        if (res.status === 401 || res.status === 403) {
          if (process.env.NODE_ENV === 'development') console.error('[gemini]', raw);
          return { error: toUserFriendlyError(raw) };
        }

        if (process.env.NODE_ENV === 'development') console.error('[gemini]', raw);
        continue;
      }

      const data = await res.json();
      const text = extractCandidateText(data);
      if (text) {
        cachedWorkingModel = modelName;
        return { text, model: modelName };
      }

      const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || '';
      lastMeaningfulError = blockReason ? `blocked: ${blockReason}` : 'empty AI response';
      if (process.env.NODE_ENV === 'development') {
        console.error('[gemini] empty/blocked on', modelName, lastMeaningfulError);
      }
      continue;
    } catch (e) {
      lastMeaningfulError = e instanceof Error ? e.message : 'Network error';
      if (process.env.NODE_ENV === 'development') console.error('[gemini]', lastMeaningfulError);
      continue;
    }
  }

  if (notFoundCount > 0 && notFoundCount >= candidates.length) {
    lastMeaningfulError = 'no working gemini model (all 404)';
  }

  if (process.env.NODE_ENV === 'development' && lastMeaningfulError) {
    console.error('[gemini]', lastMeaningfulError);
  }

  return { error: toUserFriendlyError(lastMeaningfulError || 'all models failed') };
}

export async function geminiVisionJson(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  options?: { useGoogleSearch?: boolean; jsonMode?: boolean; models?: string[] },
): Promise<{ parsed: Record<string, unknown> | null; error?: string; rawText?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { parsed: null, error: 'GEMINI_API_KEY not set in .env' };

  const resolvedMime = mimeFromDataUrl(imageBase64, mimeType);
  const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '');
  if (!base64Data || base64Data.length < 100) {
    return { parsed: null, error: 'Image data is empty or too small — re-upload the photo.' };
  }

  const parts: Part[] = [
    { inlineData: { mimeType: resolvedMime || 'image/jpeg', data: base64Data } },
    { text: prompt },
  ];

  const result = await geminiGenerateParts(apiKey, parts, {
    jsonMode: options?.jsonMode !== false,
    models: options?.models,
  });

  if (result.text) {
    const parsed = parseJsonFromText(result.text);
    if (parsed) return { parsed, rawText: result.text };
    return { parsed: null, error: 'Could not parse AI response', rawText: result.text };
  }

  return { parsed: null, error: result.error };
}

export async function geminiTextJson(
  prompt: string,
  options?: { useGoogleSearch?: boolean },
): Promise<{ parsed: Record<string, unknown> | null; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { parsed: null, error: 'GEMINI_API_KEY not set' };

  const result = await geminiGenerateParts(apiKey, [{ text: prompt }], { jsonMode: true });
  if (result.text) {
    const parsed = parseJsonFromText(result.text);
    if (parsed) return { parsed };
  }
  return { parsed: null, error: result.error };
}

export function hasGeminiKey(): boolean {
  return Boolean(getApiKey());
}

export function getGeminiKeyHint(): string {
  if (!hasGeminiKey()) {
    return 'Add GEMINI_API_KEY to your .env file (free at https://aistudio.google.com/apikey)';
  }
  return '';
}

/**
 * Lightweight plain-text Gemini call — no JSON schema, low token budget.
 * Used by the chat assistant route to get conversational answers fast.
 */
export async function geminiTextPlain(prompt: string): Promise<GeminiResult> {
  const apiKey = getApiKey();
  if (!apiKey) return { error: 'GEMINI_API_KEY not set' };
  return geminiGenerateParts(apiKey, [{ text: prompt }], { jsonMode: false });
}

import type { Part } from '@google/generative-ai';

/** Tried in order — only advances to next on 404 (not on quota errors). */
export const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
];

let quotaBlockedUntil = 0;
let cachedWorkingModel: string | null = null;

export function parseJsonFromText(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
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
  const n = name.toLowerCase();
  if (!n.includes('flash')) return false;
  if (n.includes('tts') || n.includes('live') || n.includes('audio') || n.includes('preview-tts')) return false;
  if (n.includes('embedding') || n.includes('image-generation') || n.includes('aqa')) return false;
  if (n.includes('robotics') || n.includes('computer-use')) return false;
  return true;
}

function modelPriority(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('lite')) return 0;
  if (n.includes('2.5')) return 1;
  if (n.includes('2.0')) return 2;
  if (n.includes('latest')) return 3;
  return 4;
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
  if (lower.includes('invalid') && (lower.includes('image') || lower.includes('base64'))) {
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

/** Tries models on 404 only; stops immediately on quota/auth errors. */
async function geminiGenerateParts(
  apiKey: string,
  parts: Part[],
  options?: { jsonMode?: boolean; models?: string[]; maxOutputTokens?: number; temperature?: number },
): Promise<GeminiResult> {
  if (Date.now() < quotaBlockedUntil) {
    return { error: toUserFriendlyError('429 quota cooldown active') };
  }

  const candidates = await resolveModelCandidates(apiKey, options?.models);
  const generationConfig: Record<string, unknown> = {};
  if (options?.jsonMode !== false) {
    generationConfig.responseMimeType = 'application/json';
  }
  if (options?.maxOutputTokens) {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }
  if (options?.temperature !== undefined) {
    generationConfig.temperature = options.temperature;
  }

  const bodyBase: Record<string, unknown> = {
    contents: [{ parts }],
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  };

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
          continue; // try next model
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
      const rawParts = data?.candidates?.[0]?.content?.parts;
      let text = '';
      if (Array.isArray(rawParts)) {
        const textParts = rawParts.filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === 'string');
        text = textParts.length > 0 ? textParts.map((p: { text: string }) => p.text).join('') : (rawParts[0]?.text || '');
      } else if (rawParts?.[0]?.text) {
        text = rawParts[0].text;
      }
      if (text && text.trim()) {
        cachedWorkingModel = modelName;
        return { text: text.trim(), model: modelName };
      }

      const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || '';
      lastMeaningfulError = blockReason ? `blocked: ${blockReason}` : 'empty AI response';
      break;
    } catch (e) {
      lastMeaningfulError = e instanceof Error ? e.message : 'Network error';
      break;
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

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  if (!base64Data || base64Data.length < 100) {
    return { parsed: null, error: 'Image data is empty or too small — re-upload the photo.' };
  }

  const parts: Part[] = [
    { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } },
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

export async function geminiText(
  prompt: string,
  options?: { models?: string[]; maxOutputTokens?: number; temperature?: number },
): Promise<{ text: string | null; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { text: null, error: 'GEMINI_API_KEY not set' };

  const result = await geminiGenerateParts(apiKey, [{ text: prompt }], {
    jsonMode: false,
    models: options?.models,
    maxOutputTokens: options?.maxOutputTokens,
    temperature: options?.temperature,
  });

  if (result.text) {
    return { text: result.text.trim() };
  }
  return { text: null, error: result.error };
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

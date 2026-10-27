import { buildPolishMessages, parsePolished } from './markdown.ts';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_CHAT_MODEL = 'openai/gpt-oss-20b';

// Rapikan transkrip dengan LLM; null bila gagal apa pun agar pemanggil bisa fallback.
export async function polish(
  transcript: string,
  groqKey: string | undefined,
  chatModel: string | undefined,
  fetchFn: typeof fetch = fetch,
) {
  if (!groqKey) return null;
  try {
    const res = await fetchFn(GROQ_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: chatModel ?? DEFAULT_CHAT_MODEL,
        messages: buildPolishMessages(transcript),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parsePolished(data?.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}

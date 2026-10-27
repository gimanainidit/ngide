import { initWhisper, type WhisperContext } from 'whisper.rn/index'; // paket hanya mengekspor subpath
import type { ModelId } from './models';

const PROMPT = 'Catatan ide pribadi dalam Bahasa Indonesia, kadang bercampur istilah English seperti app, feature, deadline, user.';

let loaded: { path: string; context: WhisperContext } | null = null;

async function contextFor(path: string) {
  if (loaded?.path === path) return loaded.context;
  await releaseLocalWhisper();
  const context = await initWhisper({ filePath: path });
  loaded = { path, context };
  return context;
}

// WAV 16 kHz mono → teks, sepenuhnya di HP.
export async function transcribeLocal(
  wavUri: string,
  model: { id: ModelId; path: string },
  onProgress?: (percent: number) => void,
): Promise<{ text: string; model: string }> {
  const context = await contextFor(model.path);
  const { promise } = context.transcribe(wavUri, { language: 'id', prompt: PROMPT, maxThreads: 4, onProgress });
  const { result } = await promise;
  return { text: result.trim(), model: `whisper.cpp:${model.id}` };
}

export async function releaseLocalWhisper() {
  const current = loaded;
  loaded = null;
  await current?.context.release();
}

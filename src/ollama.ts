const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'qwen3-embedding:8b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 10000;

/**
 * A client class for interacting with the Ollama API with timeouts and resilience.
 */
export class OllamaClient {
  /**
   * Directly queries the Ollama /api/embed API using light native fetch with AbortSignal timeout.
   *
   * @param text The input text to be embedded
   * @returns A promise resolving with an array of embeddings as numbers
   */
  public static async getEmbedding(text: string): Promise<number[]> {
    const url = `${OLLAMA_URL}/api/embed`;
    const cleanText = text.trim();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: cleanText,
        }),
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        model: string;
        embeddings: number[][];
      };

      if (!data.embeddings || data.embeddings.length === 0) {
        throw new Error('Ollama API returned an empty embedding array');
      }

      // /api/embed returns an array of embeddings (since it can take array input)
      return data.embeddings[0];
    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        console.error(`[Ollama] Request timed out after ${OLLAMA_TIMEOUT_MS}ms:`, url);
      } else {
        console.error('[Ollama] Failed to fetch embedding:', error);
      }
      throw error;
    }
  }

  /**
   * Directly queries the Ollama /api/generate API for local LLM inference with AbortSignal timeout.
   *
   * @param prompt The input text for generation
   * @param system Optional, specifies the system model to use
   * @returns A promise resolving with generated text as a string
   */
  public static async generateText(prompt: string, system?: string): Promise<string> {
    const url = `${OLLAMA_URL}/api/generate`;
    const model = process.env.LLM_MODEL || 'llama3.2';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          system: system,
          stream: false,
        }),
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        response: string;
      };

      return data.response.trim();
    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        console.error(`[Ollama] Generation timed out after ${OLLAMA_TIMEOUT_MS}ms:`, url);
      } else {
        console.error('[Ollama] Failed to generate text:', error);
      }
      throw error;
    }
  }
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'qwen3-embedding:8b';

/**
 * A client class for interacting with the Ollama API.
 */
export class OllamaClient {
  /**
   * Directly queries the Ollama /api/embed API using light native fetch.
   * This completely bypasses heavy wrapper libraries to ensure optimal performance.
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
    } catch (error) {
      console.error('[Ollama] Failed to fetch embedding:', error);
      throw error;
    }
  }

  /**
   * Directly queries the Ollama /api/generate API for local LLM inference.
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        response: string;
      };

      return data.response.trim();
    } catch (error) {
      console.error('[Ollama] Failed to generate text:', error);
      throw error;
    }
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaClient } from '../src/ollama';

describe('OllamaClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEmbedding', () => {
    it('should successfully fetch and return an embedding array', async () => {
      const mockResponse = {
        model: 'qwen3-embedding:8b',
        embeddings: [[0.1, 0.2, 0.3]],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const embedding = await OllamaClient.getEmbedding('test text');
      expect(embedding).toEqual([0.1, 0.2, 0.3]);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if the API returns an error status', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      await expect(OllamaClient.getEmbedding('test text')).rejects.toThrow('Ollama API error (500): Internal Server Error');
    });

    it('should throw an error if the API returns an empty embedding array', async () => {
      const mockResponse = {
        model: 'qwen3-embedding:8b',
        embeddings: [],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(OllamaClient.getEmbedding('test text')).rejects.toThrow('Ollama API returned an empty embedding array');
    });

    it('should throw an error if fetch fails (e.g. network error)', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      await expect(OllamaClient.getEmbedding('test text')).rejects.toThrow('Network error');
    });
  });

  describe('generateText', () => {
    it('should successfully fetch and return generated text', async () => {
      const mockResponse = {
        response: '  generated answer  ',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const text = await OllamaClient.generateText('hello', 'system prompt');
      expect(text).toBe('generated answer'); // Should trim
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if the API returns an error status', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as Response);

      await expect(OllamaClient.generateText('hello')).rejects.toThrow('Ollama API error (400): Bad Request');
    });

    it('should throw an error if fetch fails (e.g. network error)', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      await expect(OllamaClient.generateText('hello')).rejects.toThrow('Network error');
    });
  });
});

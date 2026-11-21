import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';

// Mock Ollama so tests run deterministically in-memory without network
vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(4096).fill(0.01);
      // Give each unique text a slightly different vector component
      vec[0] = (text.length % 10) * 0.1;
      return vec;
    }),
  },
}));

describe('Memory Profiles & Zero-Copy Context Anchors', () => {
  beforeEach(async () => {
    process.env.MEMORY_DB_PATH = ':memory:';
    DatabaseManager.getInstance();
  });

  afterEach(() => {
    DatabaseManager.close();
  });

  it('should store and isolate memories across user, working, and agent_core profiles', async () => {
    // 1. Store in user profile (default)
    const userRes = await executeMemoryStore({
      text: 'User prefers dark mode and communicates in Russian',
      importance: 0.8,
      profile: 'user',
    });
    expect(userRes.success).toBe(true);
    expect(userRes.record.metadata.profile).toBe('user');

    // 2. Store in agent_core profile with Zero-Copy Pointer Ref
    const agentCoreRes = await executeMemoryStore({
      text: 'Cluster topology: ASUS TUF is Windows 11 with RTX 3050 Ti, T460s is Ubuntu 24.04',
      importance: 0.9,
      profile: 'agent_core',
      metadata: {
        ref: {
          vault_path: 'knowledge-base/infrastructure/homelab_nodes_inventory.md',
          wikilink:
            '[[homelab_nodes_inventory#5-реестр-конфигураций-путей-и-автозапуска-zero-trash-registry]]',
          section: 'Zero-Trash Registry',
        },
      },
    });
    expect(agentCoreRes.success).toBe(true);
    expect(agentCoreRes.record.metadata.profile).toBe('agent_core');
    expect(agentCoreRes.record.metadata.ref?.wikilink).toContain('homelab_nodes_inventory');

    // 3. Store in working profile
    const workingRes = await executeMemoryStore({
      text: 'Investigating network jitter on port 8910 during router migration',
      importance: 0.5,
      profile: 'working',
    });
    expect(workingRes.success).toBe(true);
    expect(workingRes.record.metadata.profile).toBe('working');

    // 4. Search with profile: 'agent_core' -> must find cluster specs and NOT user preference
    const coreSearch = await executeMemorySearch({
      query: 'cluster topology hardware specs',
      threshold: 0.0,
      profile: 'agent_core',
    });
    expect(coreSearch.success).toBe(true);
    expect(coreSearch.results.length).toBeGreaterThan(0);
    expect(coreSearch.results[0].metadata.profile).toBe('agent_core');
    expect(coreSearch.results[0].metadata.ref?.vault_path).toBe(
      'knowledge-base/infrastructure/homelab_nodes_inventory.md'
    );
    const hasUserLeak = coreSearch.results.some((r) => r.metadata.profile === 'user');
    expect(hasUserLeak).toBe(false);

    // 5. Search with profile: 'user' -> must find dark mode preference and NOT agent_core
    const userSearch = await executeMemorySearch({
      query: 'dark mode Russian language',
      threshold: 0.0,
      profile: 'user',
    });
    expect(userSearch.success).toBe(true);
    expect(userSearch.results.length).toBeGreaterThan(0);
    expect(userSearch.results[0].metadata.profile).toBe('user');
    const hasCoreLeak = userSearch.results.some((r) => r.metadata.profile === 'agent_core');
    expect(hasCoreLeak).toBe(false);

    // 6. Search with profile: 'all' -> returns records from any profile
    const allSearch = await executeMemorySearch({
      query: 'topology dark mode network',
      threshold: 0.0,
      profile: 'all',
      limit: 10,
    });
    expect(allSearch.success).toBe(true);
    const profiles = allSearch.results.map((r) => r.metadata.profile);
    expect(profiles).toContain('agent_core');
    expect(profiles).toContain('user');
    expect(profiles).toContain('working');
  });
});

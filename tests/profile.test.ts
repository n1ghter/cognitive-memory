import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/db.js';
import { executeMemorySearch } from '../src/tools/search.js';
import { executeMemoryStore } from '../src/tools/store.js';

vi.mock('../src/ollama.js', () => ({
  OllamaClient: {
    getEmbedding: vi.fn(async (text: string) => {
      const vec = new Array(4096).fill(0.01);
      vec[0] = (text.length % 10) * 0.1;
      return vec;
    }),
  },
}));

describe('Memory Profiles & Zero-Copy Context Anchors', () => {
  beforeEach(() => {
    DatabaseManager.getInstance();
  });

  afterEach(() => {
    DatabaseManager.close();
  });

  it('should store and isolate memories across user, working, and agent_core profiles', async () => {
    const userRes = await executeMemoryStore({
      text: 'User prefers concise responses and strict TypeScript types',
      importance: 0.8,
      profile: 'user',
    });
    expect(userRes.success).toBe(true);
    expect(userRes.record.metadata.profile).toBe('user');

    const agentCoreRes = await executeMemoryStore({
      text: 'Deployment topology: primary worker runs Node 24 on Linux with SQLite WAL enabled',
      importance: 0.9,
      profile: 'agent_core',
      metadata: {
        ref: {
          vault_path: 'knowledge-base/infrastructure/deployment_topology.md',
          wikilink: '[[deployment_topology#runtime-inventory]]',
          section: 'Runtime Inventory',
        },
      },
    });
    expect(agentCoreRes.success).toBe(true);
    expect(agentCoreRes.record.metadata.profile).toBe('agent_core');
    expect(agentCoreRes.record.metadata.ref?.wikilink).toContain('deployment_topology');

    const workingRes = await executeMemoryStore({
      text: 'Investigating retry latency spike on staging gateway port 8080',
      importance: 0.5,
      profile: 'working',
    });
    expect(workingRes.success).toBe(true);
    expect(workingRes.record.metadata.profile).toBe('working');

    const coreSearch = await executeMemorySearch({
      query: 'deployment topology runtime specs',
      threshold: 0.0,
      profile: 'agent_core',
    });
    expect(coreSearch.success).toBe(true);
    expect(coreSearch.results.length).toBeGreaterThan(0);
    expect(coreSearch.results[0].metadata.profile).toBe('agent_core');
    expect(coreSearch.results[0].metadata.ref?.vault_path).toBe(
      'knowledge-base/infrastructure/deployment_topology.md'
    );
    expect(coreSearch.results.some((r) => r.metadata.profile === 'user')).toBe(false);

    const userSearch = await executeMemorySearch({
      query: 'concise TypeScript preferences',
      threshold: 0.0,
      profile: 'user',
    });
    expect(userSearch.success).toBe(true);
    expect(userSearch.results.length).toBeGreaterThan(0);
    expect(userSearch.results[0].metadata.profile).toBe('user');
    expect(userSearch.results.some((r) => r.metadata.profile === 'agent_core')).toBe(false);

    const allSearch = await executeMemorySearch({
      query: 'topology preferences latency',
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

  it('should combine scope and profile filters across local and global DBs', async () => {
    await executeMemoryStore({
      text: 'Global user preference: always run pnpm verify before pushing',
      scope: 'global',
      profile: 'user',
    });
    await executeMemoryStore({
      text: 'Global core rule: never expose unauthenticated network sockets',
      scope: 'global',
      profile: 'agent_core',
    });

    const res = await executeMemorySearch({
      query: 'global rule',
      scope: 'global',
      profile: 'agent_core',
      threshold: 0.0,
    });
    expect(res.results).toHaveLength(1);
    expect(res.results[0].scope).toBe('global');
    expect(res.results[0].metadata.profile).toBe('agent_core');
  });
});

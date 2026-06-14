import fs from 'node:fs';
import path from 'node:path';

const SKILL_CONTENT = `---
name: memory-auto-capture
description: >
  Autonomous memory management skill. Agent dynamically captures facts, preferences,
  decisions, and context using the local memory MCP tools (\`cognitive-memory\` using SQLite).
  Updates and prunes stale memories. Fully offline and local-first.
---

# Global Memory Auto-Capture Skill

This skill defines **autonomous cognitive memory behavior** across all workspaces and projects. The agent manages its own long-term memory without user intervention, relying on the registered \`cognitive-memory\` MCP server tools.

---

## 1. Dynamic Cognitive Retrieval (When to Read)

Instead of blindly loading memory on session startup, you MUST dynamically trigger retrieval based on **Semantic Context Triggers** in your dialogue:
- **Uncertainty Trigger**: The user references past work, a specific naming, or a past technical decision you have no current context for.
- **Architecture Trigger**: Before proposing a database engine, package manager, library, or system architecture, query the memory to check for user preferences.
- **Error Match Trigger**: Upon encountering a compilation, runtime, or OS-level error, query the memory to see if a similar bug was resolved in previous sessions.

**Usage (On-demand Search)**:
Call the \`memory_search\` MCP tool:
\`\`\`json
{
  "query": "<search_query>",
  "limit": 5,
  "threshold": 0.6
}
\`\`\`

---

## 2. Event-Driven Real-Time Capture (When to Write)

Do not wait for the end of the session to write memories. Capture them dynamically at **Cognitive Milestones / Decision Points**:
- **Commit Moments**: The user confirms an architecture or tech stack choice. Relate and store immediately.
- **Eureka Moments**: A complex bug is resolved or a script syntax error is successfully bypassed.
- **Fact Discovery**: The user shares a stable personal preference, work schedule, or hardware/OS detail.

**Usage (Immediate Write)**:
Call the \`memory_store\` MCP tool, setting \`metadata.type\` appropriately:
\`\`\`json
{
  "text": "<atomic_fact_to_remember>",
  "importance": 0.7,
  "metadata": {
    "category": "<category_name>",
    "type": "semantic"
  }
}
\`\`\`

---

## 3. Dynamic Milestone Capture

Capture episodic memory dynamically when:
- **Task Resolution**: A specific coding task or bug-fix is completed and verified.
- **Git Commit**: Upon a successful git commit, write a concise episodic memory documenting the changes and their rationale.

**Usage (Milestone Write)**:
Call the \`memory_store\` MCP tool with \`metadata.type = "episodic"\`:
\`\`\`json
{
  "text": "Task Completed: [concise technical summary of what was solved and why]",
  "importance": 0.6,
  "metadata": {
    "type": "episodic"
  }
}
\`\`\`

---

## 4. Graph Relations and Housekeeping

You have full access to manage the memory database autonomously using the complete suite of 7 MCP tools:
- **memory_relate**: When you realize two separate memories are conceptually linked, create a relationship between them to build the knowledge graph.
- **memory_delete**: If you verify a memory is objectively false, obsolete, or incorrect, delete it.
- **memory_consolidate**: If there are many duplicate or noisy memories about a single topic, trigger consolidation to merge them into a single high-quality node.
- **memory_export**: Export the database into Markdown files for the user's Obsidian vault.
- **memory_clear_all**: NUCLEAR OPTION - use only if explicitly requested by the user.
`;

const AGENTS_MD_CHECKLIST = `
## Autonomous Memory Checklist
**CRITICAL FORCING FUNCTION**: As an autonomous agent operating in this repository, you are strictly required to manage long-term memory via the \`cognitive-memory\` MCP tools. 

Before providing your final response or concluding any major task (e.g. bug fix, feature implementation, refactor), you **MUST** execute the \`memory-auto-capture\` skill and output the following completed checklist in your response:

- [ ] Task completed and verified.
- [ ] Episodic Memory recorded via \`memory_store\` (summarizing what was done and why).
- [ ] Semantic Annotations updated for any modified core files.

**DO NOT** conclude a conversation without completing this checklist.
`;

export async function runInit() {
  const cwd = process.cwd();
  console.log('Initializing cognitive-memory agent rules...');

  // 1. Create .agents/skills/memory-auto-capture/SKILL.md
  const agentsDir = path.join(cwd, '.agents', 'skills', 'memory-auto-capture');
  const skillPath = path.join(agentsDir, 'SKILL.md');

  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  if (!fs.existsSync(skillPath)) {
    fs.writeFileSync(skillPath, SKILL_CONTENT, 'utf-8');
    console.log(
      '✅ Created memory-auto-capture skill at .agents/skills/memory-auto-capture/SKILL.md'
    );
  } else {
    console.log('ℹ️ Skill already exists at .agents/skills/memory-auto-capture/SKILL.md');
  }

  // 2. Append or Create AGENTS.md
  const agentsMdPath = path.join(cwd, 'AGENTS.md');
  let agentsMdContent = '';

  if (fs.existsSync(agentsMdPath)) {
    agentsMdContent = fs.readFileSync(agentsMdPath, 'utf-8');
  }

  if (!agentsMdContent.includes('Autonomous Memory Checklist')) {
    fs.writeFileSync(agentsMdPath, `${agentsMdContent}\n${AGENTS_MD_CHECKLIST}`, 'utf-8');
    console.log('✅ Injected Autonomous Memory Checklist forcing function into AGENTS.md');
  } else {
    console.log('ℹ️ Autonomous Memory Checklist already exists in AGENTS.md');
  }

  console.log(
    '\n🚀 Initialization complete! Your local AI agents will now automatically write to memory.'
  );
}

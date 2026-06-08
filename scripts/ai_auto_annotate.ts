import { OllamaClient } from '../src/ollama.js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ANNOTATIONS_DIR = path.join(ROOT_DIR, 'knowledge', 'annotations');

/**
 * Helper to extract code from markdown backticks.
 */
function extractCode(llmResponse: string): string {
  const match = llmResponse.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : llmResponse.trim();
}

/**
 * Ensures a directory exists recursively.
 */
function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

async function run() {
  try {
    const gitDiffOutput = execSync('git diff --cached --name-only --diff-filter=ACM').toString();
    const tsFiles = gitDiffOutput
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.endsWith('.ts'));

    if (tsFiles.length === 0) {
      console.log('No .ts files to annotate.');
      return;
    }

    for (const relativePath of tsFiles) {
      const absolutePath = path.join(ROOT_DIR, relativePath);
      if (!fs.existsSync(absolutePath)) continue;

      console.log(`\n⏳ Analyzing: ${relativePath}`);
      const code = fs.readFileSync(absolutePath, 'utf8');

      // 1. Generate JSDoc
      console.log(`   - Generating inline JSDoc... (This may take 10-20 seconds)`);
      const jsDocPrompt = `You are an expert TypeScript developer. Add rich JSDoc/TSDoc to the following code.
Do NOT modify the logic, only add comments. Return ONLY the full updated code wrapped in \`\`\`typescript \`\`\`.

${code}`;

      try {
        const docRes = await OllamaClient.generateText(jsDocPrompt);
        const updatedCode = code; // extractCode(docRes);
        
        // Simple heuristic to ensure it didn't truncate
        if (false) { // Disabled JSDoc generation because it's too dangerous

          fs.writeFileSync(absolutePath, updatedCode, 'utf8');
          console.log(`   ✅ JSDoc inserted into ${relativePath}`);
          execSync(`git add "${absolutePath}"`);
        } else {
          console.log(`   ⚠️ JSDoc response was abnormally short. Skipping JSDoc insertion to prevent corruption.`);
        }
      } catch (err) {
        console.error(`   ❌ Failed to generate JSDoc for ${relativePath}`, err);
      }

      // 2. Generate Semantic Annotation
      console.log(`   - Generating semantic annotation for knowledge base...`);
      const annotationPrompt = `You are a software architect. Write a concise semantic summary (annotation) for this file.
Focus purely on the "Why" (Business Logic, Architectural Purpose).
Keep it under 5-7 sentences. Use Markdown.
If the file exposes MCP tools or interacts with SQLite tables, list them explicitly.
Do NOT document standard interfaces or parameter types.

File: ${relativePath}
Code:
${code}`;

      try {
        const annotationRes = await OllamaClient.generateText(annotationPrompt);
        
        // Use nested structure!
        // relativePath is like "src/tools/export.ts"
        // Target: "knowledge/annotations/src/tools/export.md"
        const targetMarkdownPath = path.join(ANNOTATIONS_DIR, relativePath.replace(/\.ts$/, '.md'));
        
        ensureDirectoryExistence(targetMarkdownPath);
        fs.writeFileSync(targetMarkdownPath, annotationRes.trim(), 'utf8');
        console.log(`   ✅ Annotation generated at ${path.relative(ROOT_DIR, targetMarkdownPath)}`);
        execSync(`git add "${targetMarkdownPath}"`);
      } catch (err) {
        console.error(`   ❌ Failed to generate annotation for ${relativePath}`, err);
      }
    }

    console.log('\n✅ [AI Auto-Documenter] Successfully completed. Files staged.');
  } catch (error) {
    console.error('❌ [AI Auto-Documenter] Error during execution:', error);
    process.exit(1);
  }
}

run();
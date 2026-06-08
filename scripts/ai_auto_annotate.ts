import { OllamaClient } from '../src/ollama.js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Helper to extract code from markdown backticks.
 *
 * @param llmResponse Markdown response to extract code from
 * @returns Extracted TypeScript code
 */
function extractCode(llmResponse: string): string {
  const match = llmResponse.match(/
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface LabelSpec {
  name: string;
  color: string;
  description: string;
}

const labelsPath = resolve(process.cwd(), '.github/labels.json');
const labels = JSON.parse(readFileSync(labelsPath, 'utf8')) as LabelSpec[];
const repoArg = process.argv[2];

for (const label of labels) {
  const args = [
    'label',
    'create',
    label.name,
    '--color',
    label.color,
    '--description',
    label.description,
    '--force',
  ];
  if (repoArg) {
    args.push('--repo', repoArg);
  }
  execFileSync('gh', args, { stdio: 'inherit' });
}

console.error(`Synced ${labels.length} deterministic labels from .github/labels.json.`);

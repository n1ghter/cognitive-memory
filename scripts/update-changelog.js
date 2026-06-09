import fs from 'fs';
import path from 'path';

const packageJsonPath = path.join(process.cwd(), 'package.json');
const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = pkg.version;
const date = new Date().toISOString().split('T')[0];

let changelog = fs.readFileSync(changelogPath, 'utf8');

// We want to replace "## [Unreleased]" with:
// ## [Unreleased]
//
// ## [x.y.z] - YYYY-MM-DD

const unreleasedHeader = '## [Unreleased]';
const newHeader = `${unreleasedHeader}\n\n## [${version}] - ${date}`;

if (changelog.includes(`## [${version}]`)) {
  console.log(`Version ${version} already in CHANGELOG.md`);
  process.exit(0);
}

if (!changelog.includes(unreleasedHeader)) {
  console.error('Could not find ## [Unreleased] header in CHANGELOG.md');
  process.exit(1);
}

changelog = changelog.replace(unreleasedHeader, newHeader);
fs.writeFileSync(changelogPath, changelog);
console.log(`Updated CHANGELOG.md for version ${version}`);

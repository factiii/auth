#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSource = join(__dirname, '..', 'prisma', 'schema.prisma');
const targetDir = resolve(process.cwd(), 'prisma');
const targetFile = join(targetDir, 'auth-schema.prisma');

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
@factiii/auth CLI

Usage:
  npx @factiii/auth <command>

Commands:
  init     Copy the reference Prisma schema to your project
  schema   Print the schema path (for manual copying)
  doctor   Check your project setup for common issues
  help     Show this help message

Examples:
  npx @factiii/auth init
  npx @factiii/auth doctor
`);
}

function init() {
  // Ensure prisma directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    console.log('Created prisma/ directory');
  }

  // Check if file already exists
  if (existsSync(targetFile)) {
    console.log(`⚠️  ${targetFile} already exists`);
    console.log('   To overwrite, delete it first and run again.');
    process.exit(1);
  }

  // Copy schema
  try {
    copyFileSync(schemaSource, targetFile);
    console.log(`✓ Copied schema to ${targetFile}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Review and customize the schema for your database provider');
    console.log('  2. Merge models into your existing schema.prisma (if you have one)');
    console.log('  3. Run: npx prisma generate');
    console.log('  4. Run: npx prisma db push (or prisma migrate dev)');
  } catch (err) {
    console.error('Failed to copy schema:', err.message);
    process.exit(1);
  }
}

function printSchemaPath() {
  console.log('Schema location:');
  console.log(`  ${schemaSource}`);
  console.log('');
  console.log('Copy manually:');
  console.log(`  cp "${schemaSource}" ./prisma/auth-schema.prisma`);
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

const ok = (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`);
const fail = (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`);
const warn = (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
const hint = (msg) => console.log(`${colors.dim}  ${msg}${colors.reset}`);

/**
 * Recursively find all .prisma files in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} files - Accumulator for found files
 * @returns {string[]} Array of file paths
 */
function findPrismaFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'migrations') {
        findPrismaFiles(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.prisma')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Directory read failed
  }

  return files;
}

/**
 * Find and read all Prisma schema files (supports single file and modularized schemas)
 * Patterns supported:
 *   - prisma/schema.prisma (single file)
 *   - prisma/schema/*.prisma (modularized in schema dir)
 *   - prisma/schema.prisma + prisma/models/*.prisma (hybrid)
 *   - prisma/*.prisma (multiple files in prisma dir)
 * @returns {{ found: boolean, schemaContent: string, location: string }}
 */
function findPrismaSchema() {
  const prismaDir = resolve(process.cwd(), 'prisma');

  if (!existsSync(prismaDir)) {
    return { found: false, schemaContent: '', location: '' };
  }

  // Find all .prisma files recursively (excluding migrations)
  const allFiles = findPrismaFiles(prismaDir);

  if (allFiles.length === 0) {
    return { found: false, schemaContent: '', location: '' };
  }

  // Read and combine all schema files
  const combinedSchema = allFiles
    .map(f => readFileSync(f, 'utf-8'))
    .join('\n');

  // Build location description
  let location;
  if (allFiles.length === 1 && allFiles[0] === join(prismaDir, 'schema.prisma')) {
    location = 'prisma/schema.prisma';
  } else {
    // Get unique directories
    const dirs = [...new Set(allFiles.map(f => dirname(f).replace(prismaDir, 'prisma')))];
    location = `${dirs.join(', ')} (${allFiles.length} files)`;
  }

  return {
    found: true,
    schemaContent: combinedSchema,
    location
  };
}

function parseReferenceSchema() {
  const schema = readFileSync(schemaSource, 'utf-8');

  // Extract model names
  const models = [...schema.matchAll(/model\s+(\w+)\s*\{/g)].map(m => m[1]);

  // Extract enum names
  const enums = [...schema.matchAll(/enum\s+(\w+)\s*\{/g)].map(m => m[1]);

  // Extract fields for each model
  const modelFields = {};
  for (const model of models) {
    const modelMatch = schema.match(new RegExp(`model\\s+${model}\\s*\\{([^}]+)\\}`, 'm'));
    if (modelMatch) {
      const block = modelMatch[1];
      // Match field names (first word on lines that aren't comments or @@)
      const fields = [...block.matchAll(/^\s*(\w+)\s+\w+/gm)]
        .map(m => m[1])
        .filter(f => !f.startsWith('@@'));
      modelFields[model] = fields;
    }
  }

  return { models, enums, modelFields };
}

function doctor() {
  console.log(`${colors.bold}${colors.cyan}Running diagnostics...${colors.reset}\n`);

  let issues = 0;
  let warnings = 0;

  // Parse reference schema to get required models/enums/fields
  let reference;
  try {
    reference = parseReferenceSchema();
  } catch (e) {
    fail('Could not read reference schema from package');
    process.exit(1);
  }

  // Check 1: package.json exists
  const packageJsonPath = resolve(process.cwd(), 'package.json');
  if (!existsSync(packageJsonPath)) {
    fail('No package.json found in current directory');
    issues++;
  } else {
    ok('package.json found');

    // Check for @prisma/client dependency
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['@prisma/client']) {
        ok('@prisma/client is installed');
      } else {
        fail('@prisma/client not found in dependencies');
        hint('Run: npm install @prisma/client');
        issues++;
      }
    } catch (e) {
      warn('Could not parse package.json');
      warnings++;
    }
  }

  // Check 2: Prisma schema exists (supports single file and modularized schemas)
  const { found: schemaFound, schemaContent: schema, location: schemaLocation } = findPrismaSchema();
  if (!schemaFound) {
    fail('No Prisma schema found');
    hint('Checked: prisma/schema.prisma, prisma/schema/*.prisma, prisma/*.prisma');
    hint('Run: npx @factiii/auth init');
    issues++;
  } else {
    ok(`Prisma schema found (${schemaLocation})`);

    // Parse user's schema
    try {
      // Check models
      for (const model of reference.models) {
        const regex = new RegExp(`model\\s+${model}\\s*\\{`, 'm');
        if (regex.test(schema)) {
          ok(`Model ${colors.cyan}${model}${colors.reset} found`);
        } else {
          fail(`Model ${colors.cyan}${model}${colors.reset} not found in schema`);
          issues++;
        }
      }

      // Check enums
      for (const enumName of reference.enums) {
        const regex = new RegExp(`enum\\s+${enumName}\\s*\\{`, 'm');
        if (regex.test(schema)) {
          ok(`Enum ${colors.cyan}${enumName}${colors.reset} found`);
        } else {
          fail(`Enum ${colors.cyan}${enumName}${colors.reset} not found in schema`);
          issues++;
        }
      }

      // Check fields for each model
      for (const [model, fields] of Object.entries(reference.modelFields)) {
        const modelMatch = schema.match(new RegExp(`model\\s+${model}\\s*\\{([^}]+)\\}`, 'm'));
        if (modelMatch) {
          const block = modelMatch[1];
          for (const field of fields) {
            const fieldRegex = new RegExp(`\\b${field}\\b`, 'm');
            if (!fieldRegex.test(block)) {
              warn(`${model}.${colors.cyan}${field}${colors.reset} field not found`);
              warnings++;
            }
          }
        }
      }
    } catch (e) {
      warn('Could not parse Prisma schema');
      warnings++;
    }
  }

  // Summary
  console.log(`\n${colors.bold}--- Summary ---${colors.reset}`);
  if (issues === 0 && warnings === 0) {
    console.log(`${colors.green}${colors.bold}✓ All checks passed!${colors.reset} Your setup looks good.`);
  } else {
    if (issues > 0) {
      console.log(`${colors.red}${colors.bold}✗ ${issues} issue(s) found${colors.reset}`);
    }
    if (warnings > 0) {
      console.log(`${colors.yellow}${colors.bold}⚠ ${warnings} warning(s) found${colors.reset}`);
    }
  }

  process.exit(issues > 0 ? 1 : 0);
}

switch (command) {
  case 'init':
    init();
    break;
  case 'schema':
    printSchemaPath();
    break;
  case 'doctor':
    doctor();
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}

#!/usr/bin/env node

/**
 * Script de migração automatizada: Phosphor Icons → Lucide Icons
 *
 * Uso:
 *   node scripts/migrate-phosphor-to-lucide.mjs <file1> <file2> ...
 *
 * Funcionalidades:
 * - Substitui imports de @phosphor-icons/react → lucide-react
 * - Renomeia ícones conforme mapping table
 * - Transforma props weight (fill/bold/regular) → fill/strokeWidth
 * - Avisa sobre casos que precisam review manual
 */

import fs from 'fs';
import path from 'path';

// Mapping table: Phosphor → Lucide
const ICON_MAP = {
  ArrowsClockwise: 'RotateCw',
  CaretDown: 'ChevronDown',
  CaretLeft: 'ChevronLeft',
  CaretRight: 'ChevronRight',
  Folders: 'Folder',
  FunnelSimple: 'Filter',
  Gear: 'Settings',
  PencilSimple: 'Edit',
  Robot: 'Bot',
  SquaresFour: 'Grid',
  Stop: 'Square',
  Trash: 'Trash2',
  UploadSimple: 'Upload',
  Warning: 'AlertTriangle',
  WarningCircle: 'AlertCircle',
};

// Transform weight props (Phosphor) → fill/strokeWidth (Lucide)
const transformProps = (content, filePath) => {
  let modified = content;
  let hasWarnings = false;

  // weight="fill" → fill="currentColor" strokeWidth={2}
  if (modified.includes('weight="fill"')) {
    modified = modified.replace(/weight="fill"/g, 'fill="currentColor" strokeWidth={2}');
    console.log(`  → Transformed weight="fill" → fill="currentColor" strokeWidth={2}`);
  }

  // weight="bold" → strokeWidth={2.5}
  if (modified.includes('weight="bold"')) {
    modified = modified.replace(/weight="bold"/g, 'strokeWidth={2.5}');
    console.log(`  → Transformed weight="bold" → strokeWidth={2.5}`);
  }

  // weight="regular" → remove (default in Lucide)
  if (modified.includes('weight="regular"')) {
    modified = modified.replace(/\s+weight="regular"/g, '');
    console.log(`  → Removed weight="regular" (default)`);
  }

  // weight={...} dynamic → needs manual review
  const dynamicWeightRegex = /weight=\{[^}]+\}/g;
  const dynamicMatches = content.match(dynamicWeightRegex);
  if (dynamicMatches) {
    console.warn(`  ⚠️  Found ${dynamicMatches.length} dynamic weight prop(s) - NEEDS MANUAL REVIEW:`);
    dynamicMatches.forEach(match => {
      console.warn(`      ${match}`);
    });
    hasWarnings = true;
  }

  return { content: modified, hasWarnings };
};

// Main transform function
const migrateFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return { success: false, needsReview: false };
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  let needsReview = false;

  console.log(`\n📄 Processing: ${path.relative(process.cwd(), filePath)}`);

  // 1. Replace import statement
  if (content.includes('@phosphor-icons/react')) {
    content = content.replace(/@phosphor-icons\/react/g, 'lucide-react');
    changed = true;
    console.log(`  ✓ Updated import: @phosphor-icons/react → lucide-react`);
  }

  // 2. Replace icon names in imports and JSX
  Object.entries(ICON_MAP).forEach(([phosphor, lucide]) => {
    const importRegex = new RegExp(`\\b${phosphor}\\b`, 'g');
    const matches = content.match(importRegex);
    if (matches) {
      content = content.replace(importRegex, lucide);
      changed = true;
      console.log(`  ✓ Renamed: ${phosphor} → ${lucide} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    }
  });

  // 3. Transform props
  if (content.includes('weight=')) {
    const result = transformProps(content, filePath);
    content = result.content;
    if (result.hasWarnings) {
      needsReview = true;
    }
    if (result.content !== content) {
      changed = true;
    }
  }

  // 4. Write back if changed
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✅ File updated successfully`);
    return { success: true, needsReview };
  } else {
    console.log(`  ℹ️  No Phosphor references found - skipped`);
    return { success: false, needsReview: false };
  }
};

// Run migration
const main = () => {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error('❌ Usage: node migrate-phosphor-to-lucide.mjs <file1> <file2> ...');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/migrate-phosphor-to-lucide.mjs src/components/app-layout.tsx');
    process.exit(1);
  }

  console.log('🚀 Starting Phosphor → Lucide migration...');
  console.log(`📦 Processing ${files.length} file${files.length > 1 ? 's' : ''}...\n`);

  let migratedCount = 0;
  let reviewNeeded = [];

  files.forEach(file => {
    const result = migrateFile(file);
    if (result.success) {
      migratedCount++;
      if (result.needsReview) {
        reviewNeeded.push(file);
      }
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Migration complete: ${migratedCount} of ${files.length} file${files.length > 1 ? 's' : ''} updated`);

  if (reviewNeeded.length > 0) {
    console.log('\n⚠️  MANUAL REVIEW NEEDED for:');
    reviewNeeded.forEach(file => {
      console.log(`   - ${path.relative(process.cwd(), file)}`);
    });
    console.log('\n   Look for dynamic weight props like: weight={condition ? "fill" : "regular"}');
    console.log('   Transform to: fill={condition ? "currentColor" : "none"}');
  }

  console.log('='.repeat(60) + '\n');
};

main();

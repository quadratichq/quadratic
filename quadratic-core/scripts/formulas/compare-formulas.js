#!/usr/bin/env node

/**
 * Compares Excel formulas with Quadratic formulas to identify:
 * 1. Functions missing from Quadratic (in Excel but not in Quadratic)
 * 2. Functions unique to Quadratic (in Quadratic but not in Excel)
 */

const fs = require('fs');
const path = require('path');

// Load the JSON files
const excelFormulasPath = path.join(__dirname, 'excel-formulas.json');
const quadraticFormulasPath = path.join(__dirname, 'quadratic-formulas.json');

const excelFormulas = JSON.parse(fs.readFileSync(excelFormulasPath, 'utf8'));
const quadraticFormulas = JSON.parse(fs.readFileSync(quadraticFormulasPath, 'utf8'));

// Convert to Sets for efficient comparison
const excelSet = new Set(excelFormulas.map(f => f.toUpperCase()));
const quadraticSet = new Set(quadraticFormulas.map(f => f.toUpperCase()));

// Find functions missing from Quadratic (in Excel but not in Quadratic)
const missingFromQuadratic = [...excelSet].filter(f => !quadraticSet.has(f)).sort();

// Find functions unique to Quadratic (in Quadratic but not in Excel)
const uniqueToQuadratic = [...quadraticSet].filter(f => !excelSet.has(f)).sort();

// Find functions present in both
const inBoth = [...excelSet].filter(f => quadraticSet.has(f)).sort();

// Output results
console.log('=' .repeat(60));
console.log('FORMULA COMPARISON: Excel vs Quadratic');
console.log('='.repeat(60));
console.log();

console.log(`Total Excel formulas: ${excelFormulas.length}`);
console.log(`Total Quadratic formulas: ${quadraticFormulas.length}`);
console.log(`Formulas in both: ${inBoth.length}`);
console.log();

console.log('-'.repeat(60));
console.log(`MISSING FROM QUADRATIC (${missingFromQuadratic.length} functions)`);
console.log('-'.repeat(60));
if (missingFromQuadratic.length === 0) {
  console.log('None - Quadratic has all Excel functions!');
} else {
  missingFromQuadratic.forEach(f => console.log(`  - ${f}`));
}
console.log();

console.log('-'.repeat(60));
console.log(`UNIQUE TO QUADRATIC (${uniqueToQuadratic.length} functions)`);
console.log('-'.repeat(60));
if (uniqueToQuadratic.length === 0) {
  console.log('None - All Quadratic functions exist in Excel.');
} else {
  console.log('These are Quadratic-specific extensions not in Excel:');
  uniqueToQuadratic.forEach(f => console.log(`  - ${f}`));
}
console.log();

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
const coverage = ((inBoth.length / excelFormulas.length) * 100).toFixed(1);
console.log(`Excel function coverage: ${coverage}% (${inBoth.length}/${excelFormulas.length})`);
console.log(`Missing Excel functions: ${missingFromQuadratic.length}`);
console.log(`Quadratic-specific functions: ${uniqueToQuadratic.length}`);

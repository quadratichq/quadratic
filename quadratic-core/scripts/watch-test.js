#!/usr/bin / env node

//! This script is used to watch a test and print the output to the console. It
//! displays operations and the prints the first sheet after each operation.
//!
//! Usage:
//!
//! ```bash
//! npm run watch:test <test-name>
//! ```

const { exec } = require('child_process');
const path = require('path');

// Get the test name from command line arguments
const testName = process.argv[2];

if (!testName) {
  console.error('Please provide a test name as an argument');
  process.exit(1);
}

// Construct the cargo watch command
const command = `cargo watch --clear --exec "test ${testName} --features show-first-sheet-operations -- --nocapture"`;
console.log(command);
// Execute the command
const child = exec(command, { cwd: path.resolve(__dirname, '..') });

// Pipe the output to the console
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

// Handle process termination
child.on('close', (code) => {
  process.exit(code);
});

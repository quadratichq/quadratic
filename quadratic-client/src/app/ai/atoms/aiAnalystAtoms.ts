/**
 * AI Analyst Atoms
 *
 * This file re-exports from the modular aiAnalystAtoms/ directory.
 * The atoms are now organized into separate files for better maintainability:
 *
 * - store.ts      - Jotai store for vanilla JS access
 * - types.ts      - Type definitions and default values
 * - primitives.ts - Base atoms (simple state containers)
 * - chatAtoms.ts  - Chat-related derived atoms
 * - selectors.ts  - Read-only computed atoms
 * - effectAtoms.ts - Atoms with side effects in setters
 * - actions.ts    - Action functions with side effects (for vanilla JS)
 * - utils.ts      - Helper functions
 */

export * from './aiAnalystAtoms/index';

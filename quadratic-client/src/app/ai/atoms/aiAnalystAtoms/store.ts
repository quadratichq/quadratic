import { getDefaultStore } from 'jotai';

/**
 * Default Jotai store for vanilla JS access outside React components.
 * Use this when you need to read/write atoms from non-React code like AISession.
 */
export const aiStore = getDefaultStore();

/**
 *
 * @param {undefined | function(): string} stdin
 * @param {undefined | function(string)} stdout
 * @param {undefined | function(string)} stderr
 * @private
 */
export function setStandardStreams(stdin: undefined | (() => string), stdout: undefined | ((arg0: string) => any), stderr: undefined | ((arg0: string) => any)): void;
/**
 * Make the home directory inside the virtual file system,
 * then change the working directory to it.
 *
 * @param {string} path
 * @private
 */
export function setHomeDirectory(path: string): void;
export type Module = any;
/**
 * @typedef {import('emscripten').Module} Module
 */
/**
 * The Emscripten Module.
 *
 * @private
 * @type {Module}
 */
export let Module: any;

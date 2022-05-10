/**
 * @param {string} indexURL
 * @private
 */
export function initializePackageIndex(indexURL: string): Promise<void>;
export function _fetchBinaryFile(indexURL: any, path: any): Promise<ArrayBufferLike>;
/**
 * @callback LogFn
 * @param {string} msg
 * @returns {void}
 * @private
 */
/**
 * Load a package or a list of packages over the network. This installs the
 * package in the virtual filesystem. The package needs to be imported from
 * Python before it can be used.
 *
 * @param {string | string[] | PyProxy} names Either a single package name or
 * URL or a list of them. URLs can be absolute or relative. The URLs must have
 * file name ``<package-name>.js`` and there must be a file called
 * ``<package-name>.data`` in the same directory. The argument can be a
 * ``PyProxy`` of a list, in which case the list will be converted to JavaScript
 * and the ``PyProxy`` will be destroyed.
 * @param {LogFn=} messageCallback A callback, called with progress messages
 *    (optional)
 * @param {LogFn=} errorCallback A callback, called with error/warning messages
 *    (optional)
 * @async
 */
export function loadPackage(names: string | string[] | PyProxy, messageCallback?: LogFn | undefined, errorCallback?: LogFn | undefined): Promise<void>;
/**
 * @param {string) url
 * @async
 * @private
 */
export let loadScript: any;
/**
 *
 * The list of packages that Pyodide has loaded.
 * Use ``Object.keys(pyodide.loadedPackages)`` to get the list of names of
 * loaded packages, and ``pyodide.loadedPackages[package_name]`` to access
 * install location for a particular ``package_name``.
 *
 * @type {object}
 */
export let loadedPackages: object;
export type LogFn = (msg: string) => void;
export type PyProxy = any;

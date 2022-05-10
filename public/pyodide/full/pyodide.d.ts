/**
 * Load the main Pyodide wasm module and initialize it.
 *
 * Only one copy of Pyodide can be loaded in a given JavaScript global scope
 * because Pyodide uses global variables to load packages. If an attempt is made
 * to load a second copy of Pyodide, :any:`loadPyodide` will throw an error.
 * (This can be fixed once `Firefox adopts support for ES6 modules in webworkers
 * <https://bugzilla.mozilla.org/show_bug.cgi?id=1247687>`_.)
 *
 * @param {string} config.indexURL - The URL from which Pyodide will load
 * packages
 * @param {string} config.homedir - The home directory which Pyodide will use inside virtual file system
 * Default: /home/pyodide
 * @param {boolean} config.fullStdLib - Load the full Python standard library.
 * Setting this to false excludes following modules: distutils.
 * Default: true
 * @param {undefined | function(): string} config.stdin - Override the standard input callback. Should ask the user for one line of input.
 * Default: undefined
 * @param {undefined | function(string)} config.stdout - Override the standard output callback.
 * Default: undefined
 * @param {undefined | function(string)} config.stderr - Override the standard error output callback.
 * Default: undefined
 * @returns The :ref:`js-api-pyodide` module.
 * @memberof globalThis
 * @async
 */
export function loadPyodide(config: any): Promise<{
    globals: import("./pyproxy.gen.js").PyProxy;
    FS: any;
    pyodide_py: import("./pyproxy.gen.js").PyProxy;
    version: string;
    loadPackage: typeof loadPackage;
    loadPackagesFromImports: typeof import("./api.js").loadPackagesFromImports;
    loadedPackages: any;
    isPyProxy: typeof import("./pyproxy.gen.js").isPyProxy;
    runPython: typeof import("./api.js").runPython;
    runPythonAsync: typeof import("./api.js").runPythonAsync;
    registerJsModule: typeof registerJsModule;
    unregisterJsModule: typeof import("./api.js").unregisterJsModule;
    setInterruptBuffer: typeof import("./api.js").setInterruptBuffer;
    checkInterrupt: typeof import("./api.js").checkInterrupt;
    toPy: typeof import("./api.js").toPy;
    pyimport: typeof import("./api.js").pyimport;
    unpackArchive: typeof import("./api.js").unpackArchive;
    registerComlink: typeof import("./api.js").registerComlink;
    PythonError: typeof import("./api.js").PythonError;
    PyBuffer: typeof import("./pyproxy.gen.js").PyBuffer;
}>;
export type PyProxy = import('./pyproxy.gen').PyProxy;
export type PyProxyWithLength = import('./pyproxy.gen').PyProxyWithLength;
export type PyProxyWithGet = import('./pyproxy.gen').PyProxyWithGet;
export type PyProxyWithSet = import('./pyproxy.gen').PyProxyWithSet;
export type PyProxyWithHas = import('./pyproxy.gen').PyProxyWithHas;
export type PyProxyIterable = import('./pyproxy.gen').PyProxyIterable;
export type PyProxyIterator = import('./pyproxy.gen').PyProxyIterator;
export type PyProxyAwaitable = import('./pyproxy.gen').PyProxyAwaitable;
export type PyProxyBuffer = import('./pyproxy.gen').PyProxyBuffer;
export type PyProxyCallable = import('./pyproxy.gen').PyProxyCallable;
export type Py2JsResult = import('./pyproxy.gen').Py2JsResult;
export type TypedArray = import('./pyproxy.gen').TypedArray;
export type PyBuffer = import('./pyproxy.gen').PyBuffer;
import { loadPackage } from "./load-pyodide.js";
import { registerJsModule } from "./api.js";

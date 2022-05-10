/**
 * Is the argument a :any:`PyProxy`?
 * @param jsobj {any} Object to test.
 * @returns {jsobj is PyProxy} Is ``jsobj`` a :any:`PyProxy`?
 */
export function isPyProxy(jsobj: any): jsobj is PyProxy;
/**
 * @typedef {Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array} TypedArray;
 */
/**
 * A class to allow access to a Python data buffers from JavaScript. These are
 * produced by :any:`PyProxy.getBuffer` and cannot be constructed directly.
 * When you are done, release it with the :any:`release <PyBuffer.release>`
 * method.  See
 * `Python buffer protocol documentation
 * <https://docs.python.org/3/c-api/buffer.html>`_ for more information.
 *
 * To find the element ``x[a_1, ..., a_n]``, you could use the following code:
 *
 * .. code-block:: js
 *
 *    function multiIndexToIndex(pybuff, multiIndex){
 *       if(multindex.length !==pybuff.ndim){
 *          throw new Error("Wrong length index");
 *       }
 *       let idx = pybuff.offset;
 *       for(let i = 0; i < pybuff.ndim; i++){
 *          if(multiIndex[i] < 0){
 *             multiIndex[i] = pybuff.shape[i] - multiIndex[i];
 *          }
 *          if(multiIndex[i] < 0 || multiIndex[i] >= pybuff.shape[i]){
 *             throw new Error("Index out of range");
 *          }
 *          idx += multiIndex[i] * pybuff.stride[i];
 *       }
 *       return idx;
 *    }
 *    console.log("entry is", pybuff.data[multiIndexToIndex(pybuff, [2, 0, -1])]);
 *
 * .. admonition:: Contiguity
 *    :class: warning
 *
 *    If the buffer is not contiguous, the ``data`` TypedArray will contain
 *    data that is not part of the buffer. Modifying this data may lead to
 *    undefined behavior.
 *
 * .. admonition:: Readonly buffers
 *    :class: warning
 *
 *    If ``buffer.readonly`` is ``true``, you should not modify the buffer.
 *    Modifying a readonly buffer may lead to undefined behavior.
 *
 * .. admonition:: Converting between TypedArray types
 *    :class: warning
 *
 *    The following naive code to change the type of a typed array does not
 *    work:
 *
 *    .. code-block:: js
 *
 *        // Incorrectly convert a TypedArray.
 *        // Produces a Uint16Array that points to the entire WASM memory!
 *        let myarray = new Uint16Array(buffer.data.buffer);
 *
 *    Instead, if you want to convert the output TypedArray, you need to say:
 *
 *    .. code-block:: js
 *
 *        // Correctly convert a TypedArray.
 *        let myarray = new Uint16Array(
 *            buffer.data.buffer,
 *            buffer.data.byteOffset,
 *            buffer.data.byteLength
 *        );
 */
export class PyBuffer {
    /**
     * The offset of the first entry of the array. For instance if our array
     * is 3d, then you will find ``array[0,0,0]`` at
     * ``pybuf.data[pybuf.offset]``
     * @type {number}
     */
    offset: number;
    /**
     * If the data is readonly, you should not modify it. There is no way
     * for us to enforce this, but it may cause very weird behavior.
     * @type {boolean}
     */
    readonly: boolean;
    /**
     * The format string for the buffer. See `the Python documentation on
     * format strings
     * <https://docs.python.org/3/library/struct.html#format-strings>`_.
     * @type {string}
     */
    format: string;
    /**
     * How large is each entry (in bytes)?
     * @type {number}
     */
    itemsize: number;
    /**
     * The number of dimensions of the buffer. If ``ndim`` is 0, the buffer
     * represents a single scalar or struct. Otherwise, it represents an
     * array.
     * @type {number}
     */
    ndim: number;
    /**
     * The total number of bytes the buffer takes up. This is equal to
     * ``buff.data.byteLength``.
     * @type {number}
     */
    nbytes: number;
    /**
     * The shape of the buffer, that is how long it is in each dimension.
     * The length will be equal to ``ndim``. For instance, a 2x3x4 array
     * would have shape ``[2, 3, 4]``.
     * @type {number[]}
     */
    shape: number[];
    /**
     * An array of of length ``ndim`` giving the number of elements to skip
     * to get to a new element in each dimension. See the example definition
     * of a ``multiIndexToIndex`` function above.
     * @type {number[]}
     */
    strides: number[];
    /**
     * The actual data. A typed array of an appropriate size backed by a
     * segment of the WASM memory.
     *
     * The ``type`` argument of :any:`PyProxy.getBuffer`
     * determines which sort of ``TypedArray`` this is. By default
     * :any:`PyProxy.getBuffer` will look at the format string to determine the most
     * appropriate option.
     * @type {TypedArray}
     */
    data: TypedArray;
    /**
     * Is it C contiguous?
     * @type {boolean}
     */
    c_contiguous: boolean;
    /**
     * Is it Fortran contiguous?
     * @type {boolean}
     */
    f_contiguous: boolean;
    /**
     * Release the buffer. This allows the memory to be reclaimed.
     */
    release(): void;
    _released: boolean;
}
export type PyProxy = PyProxyClass & {
    [x: string]: Py2JsResult;
};
export type Py2JsResult = PyProxy | number | bigint | string | boolean | undefined;
export type PyProxyWithLength = PyProxy & PyProxyLengthMethods;
export type PyProxyWithGet = PyProxy & PyProxyGetItemMethods;
export type PyProxyWithSet = PyProxy & PyProxySetItemMethods;
export type PyProxyWithHas = PyProxy & PyProxyContainsMethods;
export type PyProxyIterable = PyProxy & PyProxyIterableMethods;
export type PyProxyIterator = PyProxy & PyProxyIteratorMethods;
export type PyProxyAwaitable = PyProxy & Promise<Py2JsResult>;
export type PyProxyCallable = PyProxyClass & {
    [x: string]: Py2JsResult;
} & PyProxyCallableMethods & ((...args: any[]) => Py2JsResult);
export type PyProxyBuffer = PyProxy & PyProxyBufferMethods;
/**
 * ;
 */
export type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array;
/**
 * @typedef {(PyProxyClass & {[x : string] : Py2JsResult})} PyProxy
 * @typedef { PyProxy | number | bigint | string | boolean | undefined } Py2JsResult
 */
declare class PyProxyClass {
    /**
     * The name of the type of the object.
     *
     * Usually the value is ``"module.name"`` but for builtins or
     * interpreter-defined types it is just ``"name"``. As pseudocode this is:
     *
     * .. code-block:: python
     *
     *    ty = type(x)
     *    if ty.__module__ == 'builtins' or ty.__module__ == "__main__":
     *        return ty.__name__
     *    else:
     *        ty.__module__ + "." + ty.__name__
     *
     * @type {string}
     */
    get type(): string;
    /**
     * @returns {string}
     */
    toString(): string;
    /**
     * Destroy the ``PyProxy``. This will release the memory. Any further
     * attempt to use the object will raise an error.
     *
     * In a browser supporting `FinalizationRegistry
     * <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry>`_
     * Pyodide will automatically destroy the ``PyProxy`` when it is garbage
     * collected, however there is no guarantee that the finalizer will be run
     * in a timely manner so it is better to ``destroy`` the proxy explicitly.
     *
     * @param {string} [destroyed_msg] The error message to print if use is
     *        attempted after destroying. Defaults to "Object has already been
     *        destroyed".
     */
    destroy(destroyed_msg?: string): void;
    /**
     * Make a new PyProxy pointing to the same Python object.
     * Useful if the PyProxy is destroyed somewhere else.
     * @returns {PyProxy}
     */
    copy(): PyProxy;
    /**
     * Converts the ``PyProxy`` into a JavaScript object as best as possible. By
     * default does a deep conversion, if a shallow conversion is desired, you can
     * use ``proxy.toJs({depth : 1})``. See :ref:`Explicit Conversion of PyProxy
     * <type-translations-pyproxy-to-js>` for more info.
     *
     * @param {object} options
     * @param {number} [options.depth] How many layers deep to perform the
     * conversion. Defaults to infinite.
     * @param {array} [options.pyproxies] If provided, ``toJs`` will store all
     * PyProxies created in this list. This allows you to easily destroy all the
     * PyProxies by iterating the list without having to recurse over the
     * generated structure. The most common use case is to create a new empty
     * list, pass the list as `pyproxies`, and then later iterate over `pyproxies`
     * to destroy all of created proxies.
     * @param {boolean} [options.create_pyproxies] If false, ``toJs`` will throw a
     * ``ConversionError`` rather than producing a ``PyProxy``.
     * @param {boolean} [options.dict_converter] A function to be called on an
     * iterable of pairs ``[key, value]``. Convert this iterable of pairs to the
     * desired output. For instance, ``Object.fromEntries`` would convert the dict
     * to an object, ``Array.from`` converts it to an array of entries, and ``(it) =>
     * new Map(it)`` converts it to a ``Map`` (which is the default behavior).
     * @return {any} The JavaScript object resulting from the conversion.
     */
    toJs({ depth, pyproxies, create_pyproxies, dict_converter, }?: {
        depth?: number;
        pyproxies?: any[];
        create_pyproxies?: boolean;
        dict_converter?: boolean;
    }): any;
    /**
     * Check whether the :any:`PyProxy.length` getter is available on this PyProxy. A
     * Typescript type guard.
     * @returns {this is PyProxyWithLength}
     */
    supportsLength(): this is PyProxyWithLength;
    /**
     * Check whether the :any:`PyProxy.get` method is available on this PyProxy. A
     * Typescript type guard.
     * @returns {this is PyProxyWithGet}
     */
    supportsGet(): this is PyProxyWithGet;
    /**
     * Check whether the :any:`PyProxy.set` method is available on this PyProxy. A
     * Typescript type guard.
     * @returns {this is PyProxyWithSet}
     */
    supportsSet(): this is PyProxyWithSet;
    /**
     * Check whether the :any:`PyProxy.has` method is available on this PyProxy. A
     * Typescript type guard.
     * @returns {this is PyProxyWithHas}
     */
    supportsHas(): this is PyProxyWithHas;
    /**
     * Check whether the PyProxy is iterable. A Typescript type guard for
     * :any:`PyProxy.[Symbol.iterator]`.
     * @returns {this is PyProxyIterable}
     */
    isIterable(): this is PyProxyIterable;
    /**
     * Check whether the PyProxy is iterable. A Typescript type guard for
     * :any:`PyProxy.next`.
     * @returns {this is PyProxyIterator}
     */
    isIterator(): this is PyProxyIterator;
    /**
     * Check whether the PyProxy is awaitable. A Typescript type guard, if this
     * function returns true Typescript considers the PyProxy to be a ``Promise``.
     * @returns {this is PyProxyAwaitable}
     */
    isAwaitable(): this is PyProxyAwaitable;
    /**
     * Check whether the PyProxy is a buffer. A Typescript type guard for
     * :any:`PyProxy.getBuffer`.
     * @returns {this is PyProxyBuffer}
     */
    isBuffer(): this is PyProxyBuffer;
    /**
     * Check whether the PyProxy is a Callable. A Typescript type guard, if this
     * returns true then Typescript considers the Proxy to be callable of
     * signature ``(args... : any[]) => PyProxy | number | bigint | string |
     * boolean | undefined``.
     * @returns {this is PyProxyCallable}
     */
    isCallable(): this is PyProxyCallable;
    get [Symbol.toStringTag](): string;
}
/**
 * @typedef { PyProxy & PyProxyLengthMethods } PyProxyWithLength
 */
declare class PyProxyLengthMethods {
    /**
     * The length of the object.
     *
     * Present only if the proxied Python object has a ``__len__`` method.
     * @returns {number}
     */
    get length(): number;
}
/**
 * @typedef {PyProxy & PyProxyGetItemMethods} PyProxyWithGet
 */
/**
 * @interface
 */
declare class PyProxyGetItemMethods {
    /**
     * This translates to the Python code ``obj[key]``.
     *
     * Present only if the proxied Python object has a ``__getitem__`` method.
     *
     * @param {any} key The key to look up.
     * @returns {Py2JsResult} The corresponding value.
     */
    get(key: any): Py2JsResult;
}
/**
 * @typedef {PyProxy & PyProxySetItemMethods} PyProxyWithSet
 */
declare class PyProxySetItemMethods {
    /**
     * This translates to the Python code ``obj[key] = value``.
     *
     * Present only if the proxied Python object has a ``__setitem__`` method.
     *
     * @param {any} key The key to set.
     * @param {any} value The value to set it to.
     */
    set(key: any, value: any): void;
    /**
     * This translates to the Python code ``del obj[key]``.
     *
     * Present only if the proxied Python object has a ``__delitem__`` method.
     *
     * @param {any} key The key to delete.
     */
    delete(key: any): void;
}
/**
 * @typedef {PyProxy & PyProxyContainsMethods} PyProxyWithHas
 */
declare class PyProxyContainsMethods {
    /**
     * This translates to the Python code ``key in obj``.
     *
     * Present only if the proxied Python object has a ``__contains__`` method.
     *
     * @param {*} key The key to check for.
     * @returns {boolean} Is ``key`` present?
     */
    has(key: any): boolean;
}
/**
 * @typedef {PyProxy & PyProxyIterableMethods} PyProxyIterable
 */
declare class PyProxyIterableMethods {
    /**
     * This translates to the Python code ``iter(obj)``. Return an iterator
     * associated to the proxy. See the documentation for `Symbol.iterator
     * <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator>`_.
     *
     * Present only if the proxied Python object is iterable (i.e., has an
     * ``__iter__`` method).
     *
     * This will be used implicitly by ``for(let x of proxy){}``.
     *
     * @returns {Iterator<Py2JsResult, Py2JsResult, any>} An iterator for the proxied Python object.
     */
    [Symbol.iterator](): Iterator<Py2JsResult, Py2JsResult, any>;
}
/**
 * @typedef {PyProxy & PyProxyIteratorMethods} PyProxyIterator
 */
declare class PyProxyIteratorMethods {
    /**
     * This translates to the Python code ``next(obj)``. Returns the next value
     * of the generator. See the documentation for `Generator.prototype.next
     * <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/next>`_.
     * The argument will be sent to the Python generator.
     *
     * This will be used implicitly by ``for(let x of proxy){}``.
     *
     * Present only if the proxied Python object is a generator or iterator
     * (i.e., has a ``send`` or ``__next__`` method).
     *
     * @param {any=} [value] The value to send to the generator. The value will be
     * assigned as a result of a yield expression.
     * @returns {IteratorResult<Py2JsResult, Py2JsResult>} An Object with two properties: ``done`` and ``value``.
     * When the generator yields ``some_value``, ``next`` returns ``{done :
     * false, value : some_value}``. When the generator raises a
     * ``StopIteration(result_value)`` exception, ``next`` returns ``{done :
     * true, value : result_value}``.
     */
    next(arg?: any): IteratorResult<Py2JsResult, Py2JsResult>;
    [Symbol.iterator](): PyProxyIteratorMethods;
}
/**
 * @typedef { PyProxy & PyProxyCallableMethods & ((...args : any[]) => Py2JsResult) } PyProxyCallable
 */
declare class PyProxyCallableMethods {
    apply(jsthis: any, jsargs: any): any;
    call(jsthis: any, ...jsargs: any[]): any;
    /**
     * Call the function with key word arguments.
     * The last argument must be an object with the keyword arguments.
     */
    callKwargs(...jsargs: any[]): any;
    prototype: Function;
}
/**
 * @typedef {PyProxy & PyProxyBufferMethods} PyProxyBuffer
 */
declare class PyProxyBufferMethods {
    /**
     * Get a view of the buffer data which is usable from JavaScript. No copy is
     * ever performed.
     *
     * Present only if the proxied Python object supports the `Python Buffer
     * Protocol <https://docs.python.org/3/c-api/buffer.html>`_.
     *
     * We do not support suboffsets, if the buffer requires suboffsets we will
     * throw an error. JavaScript nd array libraries can't handle suboffsets
     * anyways. In this case, you should use the :any:`toJs` api or copy the
     * buffer to one that doesn't use suboffets (using e.g.,
     * `numpy.ascontiguousarray
     * <https://numpy.org/doc/stable/reference/generated/numpy.ascontiguousarray.html>`_).
     *
     * If the buffer stores big endian data or half floats, this function will
     * fail without an explicit type argument. For big endian data you can use
     * ``toJs``. `DataViews
     * <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView>`_
     * have support for big endian data, so you might want to pass
     * ``'dataview'`` as the type argument in that case.
     *
     * @param {string=} [type] The type of the :any:`PyBuffer.data <pyodide.PyBuffer.data>` field in the
     * output. Should be one of: ``"i8"``, ``"u8"``, ``"u8clamped"``, ``"i16"``,
     * ``"u16"``, ``"i32"``, ``"u32"``, ``"i32"``, ``"u32"``, ``"i64"``,
     * ``"u64"``, ``"f32"``, ``"f64``, or ``"dataview"``. This argument is
     * optional, if absent ``getBuffer`` will try to determine the appropriate
     * output type based on the buffer `format string
     * <https://docs.python.org/3/library/struct.html#format-strings>`_.
     * @returns {PyBuffer} :any:`PyBuffer <pyodide.PyBuffer>`
     */
    getBuffer(type?: string | undefined): PyBuffer;
}
export {};

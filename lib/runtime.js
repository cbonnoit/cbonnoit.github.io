let fs

export function isNode () {
    return typeof (process) === 'object'
}

export function isBrowser () {
    return typeof (window) !== 'undefined'
}

export function isChrome () {
    return isBrowser() && typeof (chrome) === 'object'
}

/**
 * This function asynchronously readies all state needed for compatibility in the current time.
 * It returns a promise that on fulfillment denotes that state has finished loading.
 */
export async function readyRuntime () {
    if (isNode()) {
        fs = await import('fs')
        return Promise.resolve('Done')
    }
}

/**
 * Qualifies a relative path by prefixing it with the appropriate relative location
 * @param {string} path: Relative path to qualify
 */
export function localPathToFullyQualified (path) {
    if (isNode()) {
        // todo: find better way of qualifying in node.js
        if (path[0] === '.') path = path.slice(1)
        return process.cwd() + path
    }
    if (isChrome()) return chrome.runtime.getURL(path)
    throw new Error('Unknown environment')
}

const _LOCAL_NODE_CACHE = new Map()
/**
 * Return a promise to get a resource at the specified resource path.
 * @param {string} fullyQualifiedPath: Fully qualified path to resource
 * @param {string} encoding: Encoding to use when decoding result.
 * @param {Boolean} cache: Use cache iff true
 * @return {Promise.<String>}
 */
export function getTextResource (fullyQualifiedPath, encoding='utf-8', cache=true) {
    if (isNode()) {
        // check the cache first
        if (cache && _LOCAL_NODE_CACHE.has(fullyQualifiedPath))
            return Promise.resolve(_LOCAL_NODE_CACHE.get(fullyQualifiedPath))

        // otherwise read from the file system
        return new Promise(function(resolve, reject) {
            fs.readFile(fullyQualifiedPath, encoding, function(err, data) {
                if (err) {
                    reject(err);
                } else {
                    if (cache) _LOCAL_NODE_CACHE.set(fullyQualifiedPath, data)
                    resolve(data);
                }
            });
        });
    } else if (isBrowser()) {
        return fetch(fullyQualifiedPath).then((response) => response.text())
    }
}

/**
 * Return a promise resolving when `data` has been written to `path`
 * @param path {String} Path to write data to
 * @param data {String} textual data to write to file
 */
export function writeTextResource (path, data) {
    if (!isNode()) throw new Error('Write not implemented in browser')
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, (err) => {
            if (err == null) resolve()
            else reject()
        })
    })
}

export function addEventCallback (callback, delayMs=0) {
    if (isNode()) {
        return delayMs === 0 ? setImmediate(callback) : setTimeout(callback, delayMs)
    } else {
        return window.setTimeout(callback, delayMs)
    }
}

/**
 * Return time in milliseconds for performance calculations.
 */
export function performanceTime() {
    if (isNode()) return (new Date()).valueOf()
    return performance.now()
}

// function to perform a literal equality check between items.  note nan will equal nan
/**
 * Return logical equality of `a` and `b`.
 * @param a Object to compare
 * @param b Object to compare
 */
 export function equals (a, b) {
  // types must be equivalent
  if (typeof (a) !== typeof (b))
    return false

  // special handling for null and nan values
  if (a === null)
    return b === null
  if (b === null)
    // noinspection PointlessBooleanExpressionJS
    return a === null
  if (typeof (a) === 'number' && isNaN(a))
    return isNaN(b)
  if (typeof (b) === 'number' && isNaN(b))
    return isNaN(a)

  // for arrays: recurse on elements
  if (Array.isArray(a)) {
    if (a.length !== b.length)
      return false
    for (let i = 0; i < a.length; i++) if (!equals(a[i], b[i]))
      return false
    return true
  }

  // for maps: check key-value equivalence, ignoring order
  const [aIsMap, bIsMap] = [a instanceof Map, b instanceof Map]
  if (aIsMap || bIsMap) {
    if (!aIsMap || !bIsMap)
      return false
    if (a.size !== b.size)
      return false
    for (const [aKey, aValue] of a)
      if (!b.has(aKey) || !equals(b.get(aKey), aValue))
        return false
    return true
  }

  // for times: compare values
  if (a instanceof Date || b instanceof Date){
    if (!(a instanceof Date) || !(b instanceof Date))
      return false
    return a.getTime() === b.getTime()
  }

  // for sets: check key equivalence, ignore order
  const [aIsSet, bIsSet] = [a instanceof Set, b instanceof Set]
  if (aIsSet || bIsSet) {
    if (!aIsSet || !bIsSet)
      return false
    if (a.size !== b.size)
      return false
    for (const key of a)
      if (!b.has(key))
        return false
    return true
  }

  // for objects: check key-value equivalence, ignoring order
  if (typeof (a) === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    // ignore key order (which is undetermined)
    if (!equals(new Set(keysA), new Set(keysB)))
      return false
    for (const key of keysA)
      if (!equals(a[key], b[key]))
        return false
    return true
  }

  // otherwise: check exactly
  return a === b
}

/**
 * Return logical xor of an arbitrary number of arguments
 * @param  {...any} args 
 * @returns {bool}
 */
export function xor (...args) {
  let seen = false
  for (const arg of args) {
    const value = Boolean(arg)
    if (value & seen) return false
    if (value) seen = true
  }
  return seen
}

/**
 * Flip the first and second index of an array-of-arrays
 * @param {Array} array: Array-of-arrays to
 */
 export function transpose (array) {
  if (!Array.isArray(array)) throw new Error('Transposing a non-array object')
  if (array.length === 0) return []
  const numRows = array.length
  const numColumns = getUniqueValue(array.map((x) => x.length))
  if (numColumns == null) throw new Error('Transposing a nested non-array object')
  const result = Array(numColumns)
  for (let c = 0; c < numColumns; c += 1) {
    result[c] = Array(numRows)
    for (let r = 0; r < array.length; r += 1) result[c][r] = array[r][c]
  }
  return result
}

/**
 * Return the `offset` element from the back
 * @param array {Array} Array to get element from
 * @param offset {Number} Offset position to get
 */
 export function back (array, offset=1) {
  if (offset <= 0) throw new RangeError(`Invalid offset ${offset}`)
  return array[array.length - offset]
}

export function hasUniqueValue (values) {
  const value = values[0]
  for (let i = 1; i < values.length; i += 1) if (values[i] !== value) return false
  return true
}

/**
 * Returns the unique value in an array, or throws an exception if the value is not unique
 * @param {Array} values: Array of values
 */
export function getUniqueValue (values) {
  if (!hasUniqueValue(values)) throw new Error('Value is not unique')
  return values[0]
}

/**
 * Create an Map between key <> [values]
 * @param {Array} items: Items to group
 * @param {String, Function} keyFuncOrString: Means of determing keys for each item
 * @param {String, Function} valueFuncOrString: (optional) If provided, will be used to transform values prior to collection
 * @param {Map} target: (optional) target to group into
 */
 export function groupByKeys (items, keyFuncOrString, valueFuncOrString = null, target=null) {
  const keyFuncIsString = typeof (keyFuncOrString) === 'string'
  const valueFuncIsString = typeof (valueFuncOrString) === 'string'
  if (target == null) target = new Map()
  let key, value, item
  for (let i = 0; i < items.length; i++) {
    item = items[i]
    key = keyFuncIsString ? item[keyFuncOrString] : keyFuncOrString(item, i)
    value = valueFuncIsString ? item[valueFuncOrString] : (valueFuncOrString == null ? item : valueFuncOrString(item, i))
    if (!target.has(key)) target.set(key, [])
    target.get(key).push(value)
  }
  return target
}

/**
 * Filters an object based on a boolean-valued function
 * @param object {Object} Object to filter
 * @param filterCallable {CallableFunction} Function to evaluate to perform filtration
 */
 export function objectFilter(object, filterCallable) {
  return Object.fromEntries(Object.entries(object).filter(([k, v]) => filterCallable(k, v)))
}

/**
 * Transforms the values of an object based on a supplied function
 * @param object {Object} Object to filter
 * @param valueCallable {CallableFunction} Function to evaluate to map values
 */
export function objectMapValues(object, valueCallable) {
  return Object.fromEntries(Object.entries(object).map(([k, v]) => [k, valueCallable(v)]))
}

/**
 * Collect a map between key <> supporting indices
 * @param values {Array} Items to group
 */
 export function valueToIndices (values) {
  const map = new Map()
  let indices
  for (let i = 0; i < values.length; i++) {
    indices = map.get(values[i])
    if (indices == null) {
      indices = []
      map.set(values[i], indices)
    }
    indices.push(i)
  }
  return map
}

/**
 * Return a map from {item: # of occurrences of item}
 */
export function count (items, target=null) {
  if (target == null) target = new Map()
  for (const item of items) {
    if (target.has(item)) target.set(item, target.get(item) + 1)
    else target.set(item, 1)
  }
  return target
}

/**
 * Comparison function based on native inequality comparison
 * @param a First item to compare
 * @param b Second item to compare
 */
function singleCompareFunc (a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Comparison function based on index rank order
 * @param a First array to compare
 * @param b Second array to compare
 */
export function arrayCompareFunc(a, b) {
  let compare
  for (let i = 0; i < a.length; i++) {
    compare = singleCompareFunc(a[i], b[i])
    if (compare !== 0) return compare
  }
  return 0
}

/**
 * Factory returning a bound comparison function respecting key order
 * @param keys Ordered keys to compare by
 */
function makeObjectCompareFunc(keys) {
  return function compareFunction (a, b) {
    let compare
    for (let k = 0; k < keys.length; k++) {
      compare = singleCompareFunc(a[keys[k]], b[keys[k]])
      if (compare !== 0) return compare
    }
    return 0
  }
}

/**
 * Simple wrapper to sort without modifying the input array.
 * @param items {Array, Iterable}: Items to sort
 * @param ascending {boolean}: Return ascending (true) or descending (false) order
 * @param compareFunc {CallableFunction}: (Optional) Function to perform comparison with
 */
export function sort(items, ascending=true, compareFunc=singleCompareFunc) {
  const newArray = [...items]
  newArray.sort(compareFunc)
  if (!ascending)
    newArray.reverse()
  return newArray
}

/**
 * Sort an array based on comparing `key` values
 * @param items {Array, Iterable}: Items to sort
 * @param key {String}: Key to compare on
 * @param ascending {boolean}: Return ascending (true) or descending (false) order
 */
export function sortByKey(items, key, ascending=true) {
  return sort(items, ascending, (a, b) => singleCompareFunc(a[key], b[key]))
}

/**
 * Sort an array based on comparing `key` values
 * @param items {Array, Iterable}: Items to sort
 * @param keys {Array.<String>}: Key to compare on
 * @param ascending {boolean}: Return ascending (true) or descending (false) order
 */
export function sortByKeys(items, keys, ascending=true) {
  return sort(items, ascending, makeObjectCompareFunc(keys))
}

/**
 * Return the order in which items should be selected to create a sorted array.
 * @param items {Array, Iterable}: Items to sort
 * @param ascending {boolean}: Return ascending (true) or descending (false) order
 * @param compareFunc {CallableFunction}: (Optional) Callable function for comparison
 */
export function argSort(items, ascending=true, compareFunc=singleCompareFunc) {
  const lifted = items.map((x, i) => ([x, i]))
  lifted.sort((a, b) => compareFunc(a[0], b[0]))
  const order = lifted.map((x) => x[1])
  if (!ascending) order.reverse()
  return order
}

export function argSortByKey(items, key, ascending=true) {
  return argSort(items, ascending, (a, b) => singleCompareFunc(a[key], b[key]))
}

export function argSortByKeys(items, keys, ascending=true) {
  return argSort(items, ascending, makeObjectCompareFunc(keys))
}

export function argSortByArray(items, ascending=true) {
  return argSort(items, ascending, arrayCompareFunc)
}

/**
 * Returns the position in a sorted `array` that `x` should be inserted in to maintain sort order
 * If there is a degeneracy, this will return the leftmost such position
 * @param array {Array}: Sorted array to insert into.
 * @param x {Number, string}: Element to insert
 * @param leftmost {Boolean} Return the leftmost insertion position (if false, will return the rightmost position)
 */
export function binarySearch (array, x, leftmost=true) {
  if (array.length === 0) return 0
  if (!(['number', 'string'].includes(typeof (x)))) throw new Error(`Unable to search for ${x}`)

  // iteratively restrict an interval [start, end] which spans the insertion position
  let start = 0, end = array.length
  let middle, value
  while (end - start > 1) {
    middle = Math.floor((start + end) / 2)
    value = array[middle]
    if (value < x || (value === x && !leftmost)) start = middle
    else if (value > x || leftmost) end = middle
  }

  // terminal comparison for an array of size 0 or 1
  return x < array[start] || (x === array[start] && leftmost) ? start : start + 1
}

/**
 * Returns the index of the first occurance of x in an array.
 * @param array {Array} Array to search in
 * @param x {Number, string}: Element to search for
 */
export function linearSearch(array, x) {
  const position = array.indexOf(x)
  return position === -1 ? null : position
}

/**
 * Returns the position of the item in a sorted `array` that is closest to `x`
 * @param array {Array}: Sorted array to insert into.
 * @param x {Number, string}: Element to find the closest support of
 */
export function binarySearchClosest(array, x) {
  if (array.length === 0) return null
  const bIdx = binarySearch(array, x)
  if (bIdx >= array.length - 1) return array.length - 1
  return Math.abs(array[bIdx] - x) < Math.abs(array[bIdx + 1] - x) ? bIdx : bIdx + 1
}

/**
 * Wrapper to pass a value through unless it is an error, in which case an exception is thrown
 * @param value Value to check
 * @param nanIsError {Boolean} Nan is treated as an error iff true
 * @param makeError {CallableFunction} (Optional) Construct a custom error to throw
 */
export function checkError(value, nanIsError=true, makeError=null) {
  if (value == null || (nanIsError && typeof(value) === 'number' && isNaN(value)))
    throw new Error(makeError == null ? 'Error found' : makeError())
  return value
}

/**
 * Wrapper to execute a callable and return a boolean of if it raised Exception
 * @param callable {Function} Function to execute
 * @param error {ErrorConstructor} Error class to test for raising
 */
export function hasError(callable, error) {
  let thrown = false
  try {
    callable()
  } catch (e) {
    if (e instanceof error)
      thrown = true
    else
      throw e
  }
  return thrown
}

/**
 * Wrapper to execute a callable; return the result of callable if it has not raised an exception, or elseValue if it has
 * @param callable {CallableFunction} Function to execute
 * @param elseValue Return value if an exception is raised
 */
export function tryElseValue (callable, elseValue) {
  try {
    return callable()
  } catch (e) {
    return elseValue
  }
}

/**
 * Compute cartesian product over multiple arrays
 * @param arrays {Array}: Array of items to create cartesian products from
 */
export function cartesianProduct(...arrays) {
  if (arrays.length === 0) return []
  const shape = arrays.map((x) => x.length)
  const result = []
  const indices = Array(arrays.length).fill(0)
  while (true) {
    // collect terms
    result.push(arrays.map((x, i) => x[indices[i]]))

    // iterate to next index
    indices[indices.length - 1] ++
    for (let i = shape.length - 1; i >= 0; i--) {
      if (indices[i] < shape[i]) break
      if (i === 0) return result
      indices[i] = 0
      indices[i - 1] ++
    }
  }
}

/**
 * Return a boolean which is true iff callable throws an exception
 * @param callable {CallableFunction} Function to execute
 */
export function throwsException(callable) {
  try {
    callable()
    return false
  } catch (e) {
    return true
  }
}

/**
 * Helper to write a log message with a time stamp
 * @param {String} message 
 */
 export function logInfo (message, ...terms) {
  const formater = new Intl.DateTimeFormat("en" , {
    hour: "2-digit", minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  });
  console.log(`${formater.format(new Date())} ${message}`, ...terms)
}
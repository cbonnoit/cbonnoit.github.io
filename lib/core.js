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
 * Helper to write a log message with a time stamp
 * @param {String} message 
 */
 export function logInfo (message) {
  const formater = new Intl.DateTimeFormat("en" , {
    hour: "2-digit", minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  });
  console.log(`${formater.format(new Date())} ${message}`)
}
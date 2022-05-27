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
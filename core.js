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
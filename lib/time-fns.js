import { HOUR_TO_MS, MIN_TO_MS, SEC_TO_MS } from '../cfg/const.js'

/**
 * Return a string representation of a duration
 * @param {Number} duration Elapsed time in ms
 */
export function durationToString(duration) {
  // define a helper to format a number as a two digit string
  const toTwoDigit = (x) => {
    const string = x.toFixed(0)
    return string.length == 2 ? string : ('0' + string)
  }
  
  // collect string representation
  let result = ''
  
  // include hours if any
  const numHours = Math.floor(duration / HOUR_TO_MS)
  if (numHours > 0) {
    result = numHours.toFixed(0) + ':'
    duration -= numHours * HOUR_TO_MS
  }

  // include minutes
  const minutes = Math.floor(duration / MIN_TO_MS)
  result += (numHours > 0 ? toTwoDigit(minutes) : minutes.toFixed(0)) + ':'
  duration -= minutes * MIN_TO_MS

  // include seconds
  const seconds = Math.floor(duration / SEC_TO_MS)
  result += toTwoDigit(seconds)
  
  return result
}
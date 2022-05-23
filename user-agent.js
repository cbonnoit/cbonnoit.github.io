export const SVGNAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * Create and return a node with specified attributes and text value
 * @param tag {String} Node tag
 * @param attributes {Object} Key-value association of objects
 * @param textValue {String} (optional) text value to include
 */
 export function createNode(tag, attributes=null, textValue=null) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attributes ?? {}))
    node.setAttribute(key, value)
  if (textValue != null)
    node.textContent = textValue
  return node
}

/**
 * Namespace-aware wrappers to create elements and set attributes
 */
 export function createSVGElement(tagname, attributes=null, textContent=null) {
  // make the node in the right namespace
  const node = document.createElementNS(SVGNAMESPACE, tagname)

  // set attributes
  if (attributes != null)
    for (const [key, value] of Object.entries(attributes))
      node.setAttribute(key, value)

  // set text
  if (textContent != null)
    node.textContent = textContent

  if (tagname == 'svg')
    node.setAttribute('xlmns', 'http://www.w3.org/2000/svg')

  return node
}

/**
 * Helper to set or remove the 'hidden' attribute on an element
 * @param element {HTMLElement} Element to change hidden attribute of
 * @param isHidden {Boolean} Status to set element to
 */
 export function setHidden(element, isHidden) {
  // if the element already matches the state, do nothing
  const elementIsHidden = element.getAttribute('hidden') != null
  if (isHidden === elementIsHidden) return
  if (isHidden) element.setAttribute('hidden', true)
  else element.removeAttribute('hidden')
}


/**
 * Create a one dimensional path by unioning segments
 * @param {Array.<Number>} starts 
 * @param {Array.<Number} ends 
 * @param {Number} y
 */
export function svgPathOneDimensional(starts, ends, y=0) {
  if (starts.length !== ends.length) throw new RangeError('Starts and ends do not align')
  if (starts.length === 0) return ''
  return starts.map((s, i) => `M ${s} ${y} L${ends[i]} ${y}`).join(' ')
}
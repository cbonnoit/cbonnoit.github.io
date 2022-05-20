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

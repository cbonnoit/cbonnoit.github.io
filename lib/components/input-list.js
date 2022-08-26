import { createNode } from '../user-agent.js'

class InputList extends HTMLElement {
  constructor ()  {
    super()

    // set up a root for showing expanded choices
    this._root = this.appendChild(createNode('div'))
    this._inputRoot = this._root.appendChild(createNode('div', {'class': 'inputListRoot'}))
    const addRow = this._root.appendChild(createNode('div', {'class': 'flexRowLeft'}))
    addRow.appendChild(createNode('div', {'class': 'buttonSymbol ctaPrimary'}, '+'))
    
    // keep track of rows by an index counter
    this._nextIdx = 0
    this._idxToInputRow = new Map()
    
    // add event listener for remove clicks
    this._inputRoot.addEventListener('click', (ev) => {
      const rowIdxStr = ev.target.getAttribute('rowIdx')
      if (!rowIdxStr) return
      const rowIdx = parseInt(rowIdxStr)
      const inputRow = this._idxToInputRow.get(rowIdx)
      this._inputRoot.removeChild(inputRow)  
    })
  
    // add event listener for add clicks
    addRow.addEventListener('click', () => this.newRow())
  }

  /**
   * Create a new input row with an optional value to set
   * @param {String, null} value Default value to set
   */
  newRow (value=null) {
    const inputRow = this._inputRoot.appendChild(createNode('div'))
    const inputNode = inputRow.appendChild(createNode('input'))
    inputRow.appendChild(createNode('div', {'class': 'buttonSymbol ctaSecondary', 'rowIdx': this._nextIdx}, 'x'))
    if (value) inputNode.value = value
    this._idxToInputRow.set(this._nextIdx, inputRow)
    this._nextIdx += 1
  }

  /**
   * Set the selected value
   */
  select (optionValue) {
    this._valueToOptionNodes[this._selectedOptionValue].removeAttribute('selected')
    this._valueToOptionNodes[optionValue].setAttribute('selected', 'true')
    this._selectedOptionValue = optionValue
    this.removeAttribute('expanded')
  }

  /**
   * Get the values
   */
  getValueArray () {
    const result = []
    for (const inputRow of this._idxToInputRow.values())
      result.push(inputRow.querySelector('input').value)
    return result
  }
}

customElements.define('input-list', InputList)
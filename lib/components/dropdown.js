import { createNode } from '../user-agent.js'

class UserSelect extends HTMLElement {
  constructor ()  {
    super()

    // collect options from the initial configuration
    const allOptions = Array.from(this.querySelectorAll('div'))    

    // set up a root for showing expanded choices
    this._choiceRoot = this.appendChild(createNode('div', {'class': 'choiceRoot'}))
    this._valueToOptionNodes = {}

    // mirror the options within the choice root
    allOptions.forEach((x) => this.addOption(x))

    // set a default
    const selectedChoice = allOptions.filter((x) => x.hasAttribute('selected'))[0] ?? allOptions[0]
    if (!selectedChoice.hasAttribute('selected')) selectedChoice.setAttribute('selected', 'true')
    this._selectedOptionValue = selectedChoice.textContent

    // expand the choice list when clicking on the selected node
    this.addEventListener('click', (ev) => {
      if (this.hasAttribute('expanded')) return
      if (this._choiceRoot.contains(ev.target)) return
      this.setAttribute('expanded', 'true')})
    
    // contract the choice list on click away
    document.addEventListener('click', (ev) => {
      if (!this.hasAttribute('expanded')) return
      if (this.contains(ev.target) || this._choiceRoot.contains(ev.target)) return
      this.removeAttribute('expanded')
    })

    // if clicking on an element in the choice list, set that as the active value
    this._choiceRoot.addEventListener('click', (ev) => this.select(ev.target.textContent))
  }

  addOption (optionNode) {
    this._valueToOptionNodes[optionNode.textContent] = optionNode
    this._choiceRoot.appendChild(createNode('div', {}, optionNode.textContent))
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
}

customElements.define('user-select', UserSelect)
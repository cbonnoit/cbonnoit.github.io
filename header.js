import { createNode } from "./helpers.js";

class TrellusHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'})

    this.setStyle()
    this.setContent()
  }

  setStyle () {
    const style = this.shadowRoot.appendChild(document.createElement('style'))
    style.textContent = `
      * {
        font-family: Poppins; font-style: normal
      }
      
      a:link {
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    
      #frame {
        position: relative; 
        width: 100%;
        padding-left: max(20px, calc(50% - 580px)); 
        padding-right: max(20px, calc(50% - 580px));  
        box-sizing: border-box;
      }
      
      #row {
        display: flex; width: 100%; justify-content: space-between; align-items: center;
      }
      
      #actions {
        display: flex; width: 30%; justify-content: space-between;
      }
      
      #actions a {
        color: #03214E; font-weight: 600; font-size: 16px;
      }
    `
  }

  setContent() {
    const contentRoot = this.shadowRoot.appendChild(createNode('div', {id: 'frame'}))
    const row = contentRoot.appendChild(createNode('div', {id: 'row'}))
    row.appendChild(createNode('img', {src: 'img/logo-horizontal.svg', height: 46}))
    const actions = row.appendChild(createNode('div', {id: 'actions'}))
    actions.appendChild(createNode('a', {href: 'null'}, 'About'))
    actions.appendChild(createNode('a', {href: 'null'}, 'Use Cases'))
    actions.appendChild(createNode('a', {href: 'null'}, 'Contact Us'))
    row.appendChild(createNode('div', {class: 'button', style: 'width: 180px; height: 60px'}, 'Get Started'))
  }

}


customElements.define('trellus-header', TrellusHeader)

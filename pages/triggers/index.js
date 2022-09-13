import { MESSAGE_TYPES } from "../../cfg/messages.js"
import { getUserTriggers, saveUserTriggers } from "../../lib/app/services.js"
import { groupByKeys } from "../../lib/core.js"

// define constants
let _TRELLUS_EXTENSION_API_KEY = null
let _FORCE_SERVICES_HOSTNAME = null

// initialize page
initialize()


function initialize () {
  // start listener
  listenExtensionInformation()

  // bind button clicks
  document.querySelector('#add').addEventListener('click', () => appendTrigger('', false, '', ['']))
  document.querySelector('#save').addEventListener('click', () => saveTriggers())

  console.log('Page initialized')
}

/**
 * Listen for extension information
 */
function listenExtensionInformation () {
  window.addEventListener("message", (event) => {
    const messageType = event.data['type']
    if (messageType ===  MESSAGE_TYPES.APP_TO_EXTERNAL_SET_EXTENSION_INFO) {
      _TRELLUS_EXTENSION_API_KEY = event.data['apiKey']
      _FORCE_SERVICES_HOSTNAME = event.data['forceServiceHostname']
      loadTriggers()
    } else {
      console.log(`Unknown message type ${messageType}`)
    }
  })
}

/**
 * Load triggers from database and render
 */
async function loadTriggers () {
  // get triggers
  const [triggers, formulas] = await getUserTriggers(_TRELLUS_EXTENSION_API_KEY, _FORCE_SERVICES_HOSTNAME)

  // group by trigger id
  const idToFormulas = groupByKeys(formulas, 'trigger_id', 'trigger_formula')

  // append each
  for (const trigger of triggers) 
    appendTrigger(trigger['trigger_name'], trigger['triggers_on_user'], trigger['trigger_prompt'], idToFormulas.get(trigger['trigger_id']) ?? [])
}

async function saveTriggers () {
  // collect triggers and formulas over trigger nodes
  const triggers = []
  const formulas = []
  const panels = Array.from(document.querySelector('#panel-list').childNodes)
  for (let i = 0; i < panels.length; i++) {
    // collect triggers
    const node = panels[i]
    const name = node.querySelector('input[data-trigger-node-id="trigger-name"]').value
    const onUser = node.querySelector('input[data-trigger-node-id="triggers-on-you"]').checked
    const prompt = node.querySelector('input-list[data-trigger-node-id="trigger-prompts"]').getValueArray().join('\n')
    triggers.push({'trigger_id': `${i}`, 'trigger_name': name, 'trigger_prompt': prompt, 'triggers_on_user': onUser})

    // collect formulas
    for (const formula of node.querySelector('input-list[data-trigger-node-id="trigger-formulas"]').getValueArray())
      formulas.push({'trigger_id': `${i}`, 'trigger_formula': formula})
  }

  // write results
  try {
    const result = await saveUserTriggers(triggers, formulas, _TRELLUS_EXTENSION_API_KEY, _FORCE_SERVICES_HOSTNAME)
    if (result['success'])
      document.querySelector('#status').textContent='Success!'
  } catch (e) {
    document.querySelector('#status').textContent=`Failure - ${e.message}`
  }  
}

/**
 * 
 * @param {String} name 
 * @param {Boolean} triggersOnUser 
 * @param {String} prompt 
 * @param {Array.<String>} formulas 
 */
function appendTrigger (name, triggersOnUser, prompt, formulas) {
  // make a template clone
  const template = document.querySelector('#panel-template')
  const clone = template.content.firstElementChild.cloneNode(true)

  // add to panel list
  const panelList = document.querySelector('#panel-list')
  panelList.appendChild(clone)

  // associate radio button group
  const radioYou = clone.querySelector('input[data-trigger-node-id="triggers-on-you"]')
  const radioProspect = clone.querySelector('input[data-trigger-node-id="triggers-on-prospect"]')
  const radioGroupName = crypto.randomUUID()
  radioYou.setAttribute('name', radioGroupName)
  radioProspect.setAttribute('name', radioGroupName)

  // fill in values
  clone.querySelector('input[data-trigger-node-id="trigger-name"]').value = name
  radioYou.checked = triggersOnUser
  for (const promptLine of prompt.split('\n'))
    clone.querySelector('input-list[data-trigger-node-id="trigger-prompts"]').newRow(promptLine)
  for (const formulaLine of formulas)
    clone.querySelector('input-list[data-trigger-node-id="trigger-formulas"]').newRow(formulaLine)

  // connect remove button
  clone.querySelector('div[data-trigger-node-id="trigger-remove"]').addEventListener('click', () => {
    clone.parentElement.removeChild(clone)
  })
}

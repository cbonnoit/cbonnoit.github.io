import { MICRO_TO_SEC } from "../../cfg/const.js"
import { getListConversations } from "../../lib/app/services.js"
import { back } from "../../lib/core.js"
import { durationToString } from "../../lib/time-fns.js"
import { createNode, deleteAllChildren } from "../../lib/user-agent.js"

// define constants
let _API_KEY = null
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
    if (messageType === 'APP_TO_EXTERNAL_SET_EXTENSION_INFO') {
        _API_KEY = event.data['apiKey']
        _FORCE_SERVICES_HOSTNAME = event.data['forceServicesHostname']
        loadHistory()
    }
  })
}

/**
 * Return the users conversation history from maxStart
 * @param {Number|null} maxStartMicroSec
 */
async function loadHistory (maxStartMicroSec=null) {
    // get data
    const conversations = await getListConversations(_API_KEY, maxStartMicroSec, _FORCE_SERVICES_HOSTNAME)
    
    // clear the table
    const table = document.querySelector('tbody')
    deleteAllChildren(table)

    // add new rows for each conversation
    conversations.forEach((x) => {
        const startTime = new Date(x['start'] * MICRO_TO_SEC)
        const duration = (x['end'] - x['start']) * MICRO_TO_SEC
        let name = x['person_name']
        if (x['num_other_people'] > 1) name += ` + ${x['num_other_people']} others`
        const row = conversations.appendChild(createNode('tr', {'data-session-id': x['session_id']}))
        row.appendChild(createNode('td', null, startTime.toISOString()))
        row.appendChild(createNode('td', null, durationToString(duration)))
        row.appendChild(createNode('td', null, name))
        const detailsNode = row.appendChild(createNode('td'))
        detailsNode.appendChild(createNode('a', {'href': `./session/${x['session_id']}}`}))
    })

    // save the max start on the table
    if (conversations.length > 0)
        table.setAttribute('data-max-start-micro', back(conversations)['start'])
}
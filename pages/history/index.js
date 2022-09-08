import { MICRO_TO_MS } from "../../cfg/const.js"
import { getListConversations } from "../../lib/app/services.js"
import { back, logInfo } from "../../lib/core.js"
import { durationToString } from "../../lib/time-fns.js"
import { createNode, deleteAllChildren } from "../../lib/user-agent.js"

// define constants
let _API_KEY = (new URLSearchParams(window.location.search)).get('apiKey')
let _FORCE_SERVICES_HOSTNAME = (new URLSearchParams(window.location.search)).get('forceServicesName')
let _INITILIZED = false

const _LOG_SCOPE = `[Trellus][History page]`

// initialize page
listenExtensionInformation()
if (_API_KEY != null && !_INITILIZED) {
  _INITILIZED = true
  loadHistory()
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
        if (!_INITILIZED) {
          _INITILIZED = true
          loadHistory()
        }
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

  // make a date formater
  const formater = new Intl.DateTimeFormat("en" , {
    month: 'short', day: 'numeric', hour: "numeric", minute: '2-digit', hour12: true,
  });

  // add new rows for each conversation
  conversations.forEach((x) => {
    const hasAudio = x['start'] != null
    const startDate = hasAudio ? new Date(x['start'] * MICRO_TO_MS) : null
    const duration = hasAudio ? (x['end'] - x['start']) * MICRO_TO_MS : 0
    let name = x['person_name']
    if (x['num_other_people'] > 1) name += ` + ${x['num_other_people']} others`
    const row = table.appendChild(createNode('tr', {'data-session-id': x['session_id']}))
    row.appendChild(createNode('td', null, formater.format(startDate)))
    row.appendChild(createNode('td', null, durationToString(duration)))
    row.appendChild(createNode('td', null, name))
    const detailsNode = row.appendChild(createNode('td'))
    detailsNode.appendChild(createNode('a', {'href': `./session/${x['session_id']}${window.location.search}`}, 'See more'))
  })

  // save the max start on the table
  if (conversations.length > 0)
      table.setAttribute('data-max-start-micro', back(conversations)['start'])
}
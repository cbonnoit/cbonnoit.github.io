import { MICRO_TO_MS } from "../../cfg/const.js"
import { getListUserSessions } from "../../lib/app/services.js"
import { back } from "../../lib/core.js"
import { durationToString } from "../../lib/time-fns.js"
import { createNode, deleteAllChildren } from "../../lib/user-agent.js"

// define constants
let _API_KEY = (new URLSearchParams(window.location.search)).get('apiKey')
let _FORCE_SERVICES_HOSTNAME = (new URLSearchParams(window.location.search)).get('forceServicesName')
let _INITILIZED = false

// initialize page
listenExtensionInformation()
listenMoreClick()
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
 * Register a listener on the more button
 */
function listenMoreClick () {
  const moreButton = document.querySelector('#more-button')
  moreButton.addEventListener('click', () => {
    const moreMaxStart = moreButton.getAttribute('data-max-start-micro')
    loadHistory(moreMaxStart == null ? null : parseInt(moreMaxStart))
  })
}


/**
 * Return the users conversation history from maxStart
 * @param {Number|null} maxStartMicroSec
 */
async function loadHistory (maxStartMicroSec=null) {
  // get data
  const conversations = await getListUserSessions(_API_KEY, maxStartMicroSec, _FORCE_SERVICES_HOSTNAME)
  
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
    const startDate = new Date(x['scheduled_start'] * MICRO_TO_MS)
    const duration = hasAudio ? (x['end'] - x['start']) * MICRO_TO_MS : 0
    let name = x['person_name']
    if (x['num_other_people'] > 1) name += ` + ${x['num_other_people']} others`
    const row = table.appendChild(createNode('tr', {'data-session-id': x['session_id']}))
    row.appendChild(createNode('td', null, formater.format(startDate)))
    row.appendChild(createNode('td', null, durationToString(duration)))
    row.appendChild(createNode('td', null, name))
    const detailsNode = row.appendChild(createNode('td'))
    const searchParams = new URLSearchParams(window.location.search)
    searchParams.append('sessionId', x['session_id'])
    detailsNode.appendChild(createNode('a', {'href': `../session/index.html?${searchParams.toString()}`}, 'See more'))
  })

  // save the max start on the button
  const moreMaxStart = conversations.length > 0 ? back(conversations)['scheduled_start'] : 0
  document.querySelector('#more-button').setAttribute('data-max-start-micro', moreMaxStart)
}
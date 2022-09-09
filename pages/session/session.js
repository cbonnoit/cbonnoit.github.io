import { MICRO_TO_MS, SEC_TO_MS } from "../../cfg/const.js"
import { getSessionData } from "../../lib/app/services.js"
import { back, sortByKey } from "../../lib/core.js"
import { durationToString } from "../../lib/time-fns.js"
import { createNode, deleteAllChildren } from "../../lib/user-agent.js"

// define constants
let _SESSION_ID = (new URLSearchParams(window.location.search)).get('sessionId')
let _API_KEY = (new URLSearchParams(window.location.search)).get('apiKey')
let _FORCE_SERVICES_HOSTNAME = (new URLSearchParams(window.location.search)).get('forceServicesName')
let _INITILIZED = false

// initialize page
listenExtensionInformation()
if (_API_KEY != null && !_INITILIZED) {
  _INITILIZED = true
  loadSession()
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
          loadSession()
        }
    }
  })
}

async function loadSession () {
  // get data
  const data = await getSessionData(_API_KEY, _SESSION_ID, _FORCE_SERVICES_HOSTNAME)

  // update the title with session information
  const formater = new Intl.DateTimeFormat("en" , {
    month: 'short', day: 'numeric', hour: "numeric", minute: '2-digit', hour12: true,
  });
  const sessionStart = new Date(data['session']['scheduled_start'] * MICRO_TO_MS)
  document.querySelector('div.header').textContent = `Conversation on ${formater.format(sessionStart)}`

  // figure out who the user is
  const userPersonId = data['session']['person_id']
  const prospects = data['party_people'].map(([_, x]) => x).filter((x) => x.person_id != userPersonId)
  const userCode = data['party_people'].filter(([_, x]) => x.person_id == userPersonId).map((x) => x[0])[0]['party_code']

  // make a map from party code to person
  const partyToName = new Map(data['party_people'].map(([party, person]) => [party.party_code, person.person_name]))

  // flatten transcripts (with party code)
  let flatWords = []
  for (let i = 0; i < data['transcript_data'].length; i++)
    for (const word of data['transcript_data'][i])
      flatWords.push({...word, 'party_code': data['transcripts'][i]['party_code']})
  flatWords = sortByKey(flatWords, 'start_time')

  // create notes
  const container = document.querySelector('#transcript-container')
  let lastNode, lastParty
  for (const word of flatWords) {
    // case 1: this is a new party => make a new block
    if (word['party_code'] != lastParty) {
      const templateId = (word['party_code'] === userCode) ? 'template-right' : 'template-left'
      lastNode = document.querySelector(`#${templateId}`).content.firstElementChild.cloneNode(true)
      lastNode.querySelector('div[data-transcript-node-id="transcript-name"]').textContent = partyToName.get(word['party_code'])
      lastNode.querySelector('div[data-transcript-node-id="transcript-time"]').textContent = durationToString(word['start_time'] * SEC_TO_MS)
      lastNode.querySelector('div[data-transcript-node-id="transcript-text"]').textContent = word['text']
      lastParty = word['party_code']
      container.appendChild(lastNode)
    } else {
      // case 2: extend the previous block
      lastNode.querySelector('div[data-transcript-node-id="transcript-text"]').textContent += ' ' + word['text']
    }
  }
}

import { APPLICATION_PAGE_MESSAGE_TYPES } from "../../cfg/endpoints.js";

const _LOG_SCOPE = '[Trellus][App page]'

function onPageLoad () {
  console.log(`${_LOG_SCOPE} Starting session listener`)
  window.addEventListener("message", receiveMessage, false);
}

function receiveMessage (event) {
  const message = event.data
  console.log(`${_LOG_SCOPE} Receiving message type ${message['type']}`)
  if (message['type'] === APPLICATION_PAGE_MESSAGE_TYPES.START_COACHING)
    startSession(message['session'])
  else
    console.log(`${_LOG_SCOPE} Skipping message of type ${message['type']}`)
}

/**
 * Set the active session
 * @param {Object} session 
 */
function startSession (session) {
  const sessionNode = document.querySelector('#session')
  sessionNode.textContent = JSON.stringify(session)
}

window.addEventListener("load", () => onPageLoad())


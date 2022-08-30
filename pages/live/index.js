const _LOG_SCOPE = '[Trellus][App page extension]'

function onPageLoad () {
  console.log(`${_LOG_SCOPE} Starting session listener`)
  window.addEventListener("message", receiveMessage, false);
}

function receiveMessage (event) {
  const message = event.data
  console.log(`${_LOG_SCOPE} Receiving message type ${message['type']}`)
    if (message['type'] === 'START_COACHING') {
        document.querySelector()
    } else {
      throw new Error(`[Trellus][App page] Unknown `)
    }
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


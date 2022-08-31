import { EXTENSION_ID, SUBSCRIBE_CLIENT_ENDPOINT } from "../../cfg/endpoints.js";
import { MESSAGE_TYPES } from "../../cfg/messages.js";
import { logInfo } from "../../lib/core.js";
import { createLoggingWebsocketPromise } from "../../lib/network.js";

const _LOG_SCOPE = '[Trellus][External page]'

let _session = null
let _socketPromise = null
let _extensionId = EXTENSION_ID


/**
 * Main entry point to setting up javascript after page is loaded
 */
function onPageLoad () {
  logInfo(`${_LOG_SCOPE} Starting session listener`)

  // listen for messages posted from the extension app content script
  window.addEventListener("message", receiveMessage, false);
  
  // add responsivity to buttons
  document.querySelector('#realtimeEnabled').addEventListener('click', (ev) => {
    // send the extension a message that realtime coaching is disabled
    chrome.runtime.sendMessage(_extensionId, {
      'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_REALTIME_ENABLED,
      'realtimeIsEnabled': ev.target.checked,
    })

    // if disabling coaching, ensure that any active session is disabled
    if (!ev.target.checked && _session != null)
      _endSession(_session['session_id'])
  })
}

function receiveMessage (event) {
  const message = event.data
  logInfo(`${_LOG_SCOPE} Receiving message type ${message['type']}`)
  switch (message['type']) {
    case MESSAGE_TYPES.APP_TO_EXTERNAL_START_COACHING:
      _startSession(message['session'])
      break
    case MESSAGE_TYPES.APP_TO_EXTERNAL_END_COACHING:
      _endSession(message['sessionId'])
      break
    case MESSAGE_TYPES.APP_TO_EXTERNAL_SET_EXTENSION_INFO:
      _extensionId = message['extensionId']
      document.querySelector('#realtimeEnabled').checked = message['realtimeEnabled']
      break
    default:
      logInfo(`${_LOG_SCOPE} Skipping message of type ${message['type']}`)
  }  
}

/**
 * Set the active session
 * @param {Object} session 
 */
async function _startSession (session) {
  logInfo(`${_LOG_SCOPE} Starting session ${session['session_id']}`)
  await _reset()
  _session = session
  _socketPromise = _createClientSocket(session)
}

async function _endSession (sessionId) {
  logInfo(`${_LOG_SCOPE} Ending session ${sessionId}`)
  // only end the session if it is the current session
  if (_session == null || _session['session_id'] != sessionId) return
  _session = null
  if (_socketPromise != null) {
    await _socketPromise.close()
    _socketPromise = null
  }
}

async function _reset () {
  // reset the session
  _session = null

  // reset the socket
  if (_socketPromise != null) {
    const socket = await _socketPromise
    socket.close()
  }
  _socketPromise = null

  // todo: reset the ui...
}

/**
 * Create a WebSocket to receive coaching related data
 * @param {Object} session
 */
async function _createClientSocket(session) {
  const queryString = new URLSearchParams({'session_id': session['session_id']}).toString()
  const socketUrl = `wss://${session['realtime_hostname']}/${SUBSCRIBE_CLIENT_ENDPOINT}?${queryString}`
  const callback = (dataString) => {
    const data = JSON.parse(dataString)
    logInfo('Receving data from client socket', JSON.stringify(data))
    if (data['transcript_data'] != null) 
      _updateTranscript(data['transcript_data'])
    else if (data['coaching_data'] != null)
      _updateCoachingData(data['coaching_data'])
    else if (data['weather_data'] != null)
      _updateWeather(data['weather_data'])
  }
  return await createLoggingWebsocketPromise('clientSocket', socketUrl, callback, false)
}

/**
 * Add transript to display
 * @param {Object} transcript Transcript object to add
 */
function _updateTranscript (transcript) {
  logInfo('got transcript')
}

/**
 * Update coaching based on input
 * @param {object} coaching
 */
function _updateCoachingData (coaching) { 
  logInfo('got coaching')
}

/**
 * Update weatheer based on input
 * @param {object} weather
 */
 function _updateWeather (weather) { 
  logInfo('got weather')
}

window.addEventListener("load", () => onPageLoad())

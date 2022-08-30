import { APPLICATION_PAGE_MESSAGE_TYPES } from "../../cfg/endpoints.js";
import { logInfo } from "../../lib/core.js";
import { createLoggingWebsocketPromise } from "../../lib/network.js";

const _LOG_SCOPE = '[Trellus][App page]'

let _session = null
let _socketPromise = null


function onPageLoad () {
  logInfo(`${_LOG_SCOPE} Starting session listener`)
  window.addEventListener("message", receiveMessage, false);
}

function receiveMessage (event) {
  const message = event.data
  logInfo(`${_LOG_SCOPE} Receiving message type ${message['type']}`)
  if (message['type'] === APPLICATION_PAGE_MESSAGE_TYPES.START_COACHING)
    startSession(message['session'])
  else
  logInfo(`${_LOG_SCOPE} Skipping message of type ${message['type']}`)
}

/**
 * Set the active session
 * @param {Object} session 
 */
async function startSession (session) {
  await reset()
  _session = session
  _socketPromise = _createClientSocket(session)
}

async function reset () {
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
  return await createLoggingWebsocketPromise('clientSocket', socketUrl, callback)
}

/**
 * Add transript to display
 * @param {Object} transcript Transcript object to add
 */
function _updateTranscript (transcript) {
  logInfo(transcript)
}

/**
 * Update coaching based on input
 * @param {object} coaching
 */
function _updateCoachingData (coaching) { 
  logInfo(coaching)
}

/**
 * Update weatheer based on input
 * @param {object} coaching
 */
 function _updateWeather (weather) { 
  logInfo(weather)
}


window.addEventListener("load", () => onPageLoad())


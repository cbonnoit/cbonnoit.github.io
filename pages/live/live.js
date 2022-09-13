import { EXTENSION_ID, SUBSCRIBE_CLIENT_ENDPOINT } from "../../cfg/endpoints.js";
import { MESSAGE_TYPES } from "../../cfg/messages.js";
import { MIN_TO_SEC, SEC_TO_MS } from "../../cfg/const.js"
import { BEHAVIORAL_PROMPTS, BEHAVIORAL_PROMPTS_TO_IMAGE,
  PROMPT_TYPES } from '../../cfg/coach.js';
import { logInfo, back } from "../../lib/core.js";
import { createLoggingWebsocketPromise } from "../../lib/network.js";
import { generateColor } from '../../lib/graphics.js'
import { createNode, deleteAllChildren } from "../../lib/user-agent.js";
import { durationToString } from "../../lib/time-fns.js"

const _LOG_SCOPE = '[Trellus][External page]'

let _session = null
let _socketPromise = null
let _extensionId = EXTENSION_ID
let _partyCodeToColor = {}
let _transcripts = []
let partyToSummary = new Map()

// keep track of the current shown behavioral prompt
let activePrompt = null
let activePromptIntervalId = null
let dismissObjectionIntervalId = null
let promptPersistanceDuration = SEC_TO_MS * 5

// run setup
setup()

/**
 * Main entry point to setting up javascript after page is loaded
 */
function setup () {
  logInfo(`${_LOG_SCOPE} Starting session listener`)

  // listen for messages posted from the extension app content script
  window.addEventListener("message", receiveMessage, false);
  // add responsivity to buttons
  document.querySelector('#realtimeEnabled').addEventListener('click', (ev) => {
    // send the extension a message that realtime coaching is disabled
    chrome.runtime.sendMessage(_extensionId, {
      'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_REALTIME_ENABLED,
      'realtimeIsEnabled': ev.target.checked
    })

    const updateText = ev.target.checked ? 'Coaching Enabled' : 'Coaching Disabled'
    document.querySelector('#realtimeEnabledText').textContent =  updateText

    // if disabling coaching, ensure that any active session is disabled
    if (!ev.target.checked && _session != null) 
      _endSession(_session['session_id'])
    
  })

  // tell the content script that the app is loaded
  window.postMessage({type: MESSAGE_TYPES.EXTERNAL_TO_APP_IS_LOADED})
}

function receiveMessage (event) {
  const message = event.data
  logInfo(`${_LOG_SCOPE} Receiving message type ${message['type']}`)
  switch (message['type']) {
    case MESSAGE_TYPES.APP_TO_EXTERNAL_CHECK_IS_LOADED:
      window.postMessage({type: MESSAGE_TYPES.EXTERNAL_TO_APP_IS_LOADED})
      break
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
    case MESSAGE_TYPES.EXTERNAL_TO_APP_IS_LOADED:
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
    (await _socketPromise).close()
    _socketPromise = null
  }
}

async function _reset () {
  setDefaultsAndClearUI()
  // reset the session and socket
  if (_session != null)
    await _endSession(_session['session_id'])
}

function setDefaultsAndClearUI () {
  _partyCodeToColor = {}
  _transcripts = []
  partyToSummary = new Map()
  
  activePrompt = null
  activePromptIntervalId = null
  dismissObjectionIntervalId = null
  promptPersistanceDuration = SEC_TO_MS * 5

  // clear weather & news
  //   <div class="weather" id="weather-main">
  //   <div class="placeholder-text" id="weather-placeholder-text" >Gathering weather data...</div>
  // </div>
  const weatherElement = document.querySelector('#weather-main')
  weatherElement.innerHTML = ''
  weatherElement.appendChild(createNode('div', {'class': 'placeholder-text', 'id': 'weather-placeholder-text'}, 'Gathering weather data...'))

  // clear behavioral coaching
  _clearBehavioralSuggestion()
  _updateBuyingIntent(0)

  // clear suggestions
  _clearObjection()

  // clear transcript and summary
  document.querySelector('#trellus-summary').innerHTML = ''
  document.querySelector('#transcriptRoot').innerHTML = ''
}

/**
 * Create a WebSocket to receive coaching related data
 * @param {Object} session
 */
async function _createClientSocket(session) {
  logInfo(`${_LOG_SCOPE} Creating client socket for ${session['session_id']}`)
  const queryString = new URLSearchParams({'session_id': session['session_id']}).toString()
  const socketUrl = `wss://${session['realtime_hostname']}/${SUBSCRIBE_CLIENT_ENDPOINT}?${queryString}`
  const callback = (dataString) => {
    const data = JSON.parse(dataString)
    logInfo(`${_LOG_SCOPE} Receving data from client socket`, JSON.stringify(data))
    if (data['transcript_data'] != null) 
      _updateTranscript(data['transcript_data'])
    else if (data['coaching_data'] != null)
      _updateCoachingData(data['coaching_data'])
    else if (data['weather_data'] != null)
      _updateWeather(data['weather_data']['weather']) // todo: weather by party...
  }
  return await createLoggingWebsocketPromise('clientSocket', socketUrl, callback, false)
}

/**
 * Add transript to display
 * @param {Object} transcript Transcript object to add
 */
function _updateTranscript (transcript) {
  logInfo(`${_LOG_SCOPE} Transcript from ${transcript['person_name']} (${transcript['party_code']}). Text: "${transcript['text']}"`)
  // get party code and name
  const partyCode = transcript['party_code']

  // if new party ID - generate a color for that party
  if (!(partyCode in _partyCodeToColor))
    _partyCodeToColor[partyCode] = generateColor(Object.keys(_partyCodeToColor).length)

  // get the text
  const text = transcript['text']

  // nothing to do if there is no text
  if (text === '') return

  const root = document.querySelector('#transcriptRoot')
  const isScrolledToBottom = Math.abs((root.scrollTop + root.offsetHeight) - root.scrollHeight) < 5

  // if this party is also the party of the last transcript, then append the text
  if ((back(_transcripts) ?? {})['partyCode'] === partyCode)
    _extendLastTranscript(text)
  else {
    // get the start time (relative to audio zero)
    const startTimeMs = transcript['start_time'] * SEC_TO_MS
    // create a new transcript
    _addNewTranscript(text, partyCode, transcript['person_name'], startTimeMs)
  }

  // keep scroll at bottom. note: if this is done immediately, layout may not be complete
  if (isScrolledToBottom) setTimeout(() => root.scrollTop = root.scrollHeight, 0)
}

/**
 * Extend the last transcript with additional words
 * @param {String} text Text to extend transcript with
 */
function _extendLastTranscript (text) {
  const transcript = back(_transcripts)
  transcript.contentNode.textContent += ' ' + text
}

/**
 * Create new dom nodes associated with a new transcript
 * @param {String} text
 * @param {Number} partyCode
 * @param {String} partyName
 * @param {Number} startTime Start time (in milliseconds)
 */
function _addNewTranscript (text, partyCode, partyName, startTime) {
  const root = document.querySelector('#transcriptRoot')
  // create nodes

  const transcriptRoot = root.appendChild(createNode('div', {'class': 'flexColumn transcript'}))

  let transcriptHeader
  let contentStyle

  if (partyCode == 0) {// prospect and should be RHS
    transcriptHeader = transcriptRoot.appendChild(createNode('div', {'class': 'flexRow', 'style': 'margin-left: 20%'}))
    contentStyle = 'margin-left: 20%'
  } else {
    transcriptHeader = transcriptRoot.appendChild(createNode('div', {'class': 'flexRow'}))
    contentStyle = 'margin-right: 20%'
  }

  
  transcriptHeader.appendChild(createNode('div', {'class': 'flexColumn transcriptTime'}, durationToString(startTime)))
  const nameAttributes = {'class': 'transcriptName', 'style': `color: ${_partyCodeToColor[partyCode]};`}
  transcriptHeader.appendChild(createNode('div', nameAttributes, partyName))

  const contentNode = transcriptRoot.appendChild(createNode('div', {'class': 'transcriptContent', 'style': contentStyle}, text))  
  // store transcript information
  _transcripts.push({'partyCode': partyCode, 'contentNode': contentNode})
}


/**
 * Update coaching based on input
 * @param {object} coaching
 */
function _updateCoachingData (coaching) { 
  // starting with 9ce9a73b6d the backend started sending coaching data through the 'coaching' parameter
  if (coaching.hasOwnProperty('coaching'))
    coaching = coaching['coaching']
  
  const prompt = coaching['prompt'].toUpperCase()

  // per-prompt rendering
  if (prompt === PROMPT_TYPES.SUMMARY_V2) {
    _updateSummary(coaching['value'])
  } else if (prompt === PROMPT_TYPES.OBJECTION_RESPONSE) {
    _updateTrigger(coaching['value']['objection'], coaching['value']['response'])
  } else if (prompt === PROMPT_TYPES.TRIGGER) {
    _updateTrigger(coaching['value']['trigger_name'], coaching['value']['trigger_prompt'])
  }else if (BEHAVIORAL_PROMPTS.includes(prompt)) {
    _updateBehavioralSuggestion(prompt)
  } else if (prompt === PROMPT_TYPES.BUYING_INTENT) {
    _updateBuyingIntent(coaching['value'])
  } else {
    logInfo(`Unknown prompt ${prompt}`)
  }
}

function _clearObjection() {
  document.querySelector('#objection-header').textContent = 'Suggestions'
  document.querySelector('#objection').innerHTML = '';
  document.querySelector('#objection').appendChild(createNode('div', {id: 'objection-placeholder-text', class: 'placeholder-text'}, "Listening for objections..."))
  document.querySelector('#objection').appendChild(createNode('div', {id: 'objection-container', class: 'flexColumn'}))
}

/**
 * Updates objection data with new data
 * @param {string} triggerName trigger name
 * @param {string} triggerPrompt trigger prompt
 */
function _updateTrigger (triggerName, triggerPrompt) {
  // cancel any existing objection callback
  if (dismissObjectionIntervalId != null)
    clearInterval(dismissObjectionIntervalId)

  // set objection text
  const placeholderText = document.querySelector('#objection-placeholder-text')
  if (placeholderText) placeholderText.remove()

  document.querySelector('#objection-header').textContent = `Objection: ${triggerName.toLowerCase()}`
  const objectionContainer = document.querySelector('#objection-container')
  deleteAllChildren(objectionContainer)
  const responses = Array.isArray(triggerPrompt) ? triggerPrompt : triggerPrompt.split('\n')
  for (const response of responses) {
    objectionContainer.appendChild(_createCheckListElement(response, false))
  }

  // add a callback dismissing the objection
  dismissObjectionIntervalId = setTimeout(() => {
    _clearObjection()
  }, promptPersistanceDuration * 2)
}

/**
 * Creates a checklist element
 * @param labelText text for checklist element
 * @param checked whether the element should already be checked
 * @returns {HTMLDivElement}
 */
function _createCheckListElement(labelText, checked) {
  const checklistItem = createNode('div', {'class': 'trellus-guidance-checklist-item'})
  const checkbox = createNode('div', {'class': 'checklist-checkbox'})
  const checklistItemText = createNode('div', {'class': 'checklist-text'}, labelText)

  if (checked === true) {
    checkbox.classList.add("checked")
    checklistItemText.classList.add("checked")
  }

  checklistItem.appendChild(checkbox)
  checklistItem.appendChild(checklistItemText)
  return checklistItem;
}

function _clearBehavioralSuggestion() {
  // show the prompt
  const behavioralImg = document.querySelector('#behavioral-guidance-img')
  behavioralImg.style.opacity = '0'
  behavioralImg.src = '/images/great_work.png'
  behavioralImg.style.opacity = '100%'
}

/**
 * Updates the behavioral suggestion with a new prompt
 * @param {String} prompt
 */
function _updateBehavioralSuggestion (prompt) {
  // if there is an active prompt and the new prompt is different, ignore the new prompt
  // the assumption here is that prompts will get refreshed as long as they are valid for
  // and the font end should avoid flickering between multiple simultaneously valid prompts
  if (activePrompt != null && activePrompt !== prompt) return;

  // clear any pending interruptions
  if (activePromptIntervalId != null) {
    clearInterval(activePromptIntervalId);
  }

  if (!BEHAVIORAL_PROMPTS_TO_IMAGE.hasOwnProperty(prompt)) {
    logInfo(`image not created for prompt: ${prompt}`)
    return
  }

  const behavioralImg = document.querySelector('#behavioral-guidance-img')
  behavioralImg.style.opacity = '0'
  behavioralImg.src = BEHAVIORAL_PROMPTS_TO_IMAGE[prompt]
  behavioralImg.style.opacity = '100%'

  activePrompt = prompt;

  // automatically hide the prompt
  activePromptIntervalId = setTimeout(() => {
    _clearBehavioralSuggestion()
    activePrompt = null;
    activePromptIntervalId = null;
  }, promptPersistanceDuration)
}

/**
 * Update the summary
 * @param {Array.<Object>} data Summary data
 */
function _updateSummary (data) {
  if (partyToSummary.size === 0) {
    logInfo(`Sending coaching loaded to coaching UI`)
    window.parent.postMessage({"type": "coachingLoaded"}, '*'); // only load on receiving first summary
  }

  let totalTalkTime = 0
  data.forEach((partyData) => {
    partyData['intervals'].forEach(({start, end}) => {
      totalTalkTime += end - start
    })    
  })

  for (const partyData of data)
    _updateActiveIntervals(partyData['party_code'], partyData['party_name'], partyData['intervals'], totalTalkTime)
}

/**
 * Update intervals by party
 * @param {Number} partyCode Party identifier to update intervals for
 * @param {String} partyName Party name to display with intervals
 * @param {Array.<Object>} intervals intervals in the form {start, end}
 */
function _updateActiveIntervals (partyCode, partyName, intervals, totalTalkTime) {
  // create the party summary
  if (!partyToSummary.has(partyCode))
    _createPartySummary(partyCode, partyName)

  // update party names. note there can be a race condition in the coaching run loop between receipt of
  // audio data and party person data, so it is possible to get a transitive `Unknown` name
  partyToSummary.get(partyCode).parentElement.querySelector('.summaryName').textContent = partyName

  // remove all previous lines
  const container = partyToSummary.get(partyCode).querySelector('.summaryIntervalContainer')
  deleteAllChildren(container)

  // get scale converting between time (in sec) and pixel
  const width = container.getBoundingClientRect().width
  const maxTime = 10 * MIN_TO_SEC
  const scale = width / maxTime

  let partyTalkTime = 0

  // draw intervals
  intervals.forEach(({start, end}) => {
    const style = `left: ${start * scale}px; width: ${(end - start) * scale}px`
    container.appendChild(createNode('div', {'style': style}))
    partyTalkTime += end - start
  })

  const partyTalkPercentage = Math.round((partyTalkTime / totalTalkTime) * 100)
  partyToSummary.get(partyCode).parentElement.querySelector('.summaryPercentage').textContent = partyTalkPercentage + '%'
}

/**
 * Create DOM elements for a party summary for `partyCode`
 * @param {Number} partyCode Party identifier to update intervals for
 * @param {String} partyName Party name to display with intervals
 */
function _createPartySummary (partyCode, partyName) {
  // create layout
  const root = document.querySelector('#trellus-summary')
  const summary = root.appendChild(createNode('div', {'class': 'flexRow full summary'}))
  summary.appendChild(createNode('div', {'class': 'flexRow full summaryName'}, partyName))
  const payloadContainer = summary.appendChild(createNode('div', {'class': 'flexRow full summaryRight', 'style': 'position: relative'}))
  payloadContainer.appendChild(createNode('div', {'class': 'flexRow full summaryTop summaryIntervalContainer'}))
  payloadContainer.appendChild(createNode('div', {'class': 'flexRow full summaryBottom summaryEventContainer'}))
  summary.appendChild(createNode('div', {'class': 'flexRow full summaryPercentage'}, partyName))

  // keep a reference to the payload container
  partyToSummary.set(partyCode, payloadContainer)
}

function _updateBuyingIntent(data) {
  const buyingSignalMeter = document.querySelector('#buyingSignal')
  const percentageSignal = parseFloat(data)*100
  buyingSignalMeter.setAttribute('aria-valuenow', `${percentageSignal}`)
  buyingSignalMeter.style.setProperty('--value', `${percentageSignal}`)
}


/**
 * Update weatheer based on input
 * @param {object} weather
 */
 function _updateWeather (weather) { 
  const weatherElement = document.querySelector('#weather-main')

  const parentDiv = createNode('div', {'style': 'flex-direction: column; display: flex'})

  const upperDiv = createNode('div', {'style': 'display: flex; flex-wrap: nowrap; align-items: center; justify-content: center;'})
  const weatherValue = createNode('div', {}, Math.trunc(weather['temperature']) + String.fromCharCode(176) + 'F')    
  const weatherImg = createNode('img', {'src': weather['icon_url'], 'style': 'background-color: #adc1e67d; border-radius: 50%; margin-left: 10px;'})
  upperDiv.appendChild(weatherValue)
  upperDiv.appendChild(weatherImg)

  const bottomDiv = createNode('div')
  const weatherLocation = createNode('div', {'style': 'margin-top: 4px; color: #423838;'}, weather['location_str'])
  bottomDiv.appendChild(weatherLocation)

  parentDiv.appendChild(upperDiv)
  parentDiv.appendChild(bottomDiv)

  weatherElement.innerHTML = '';
  weatherElement.appendChild(parentDiv)
}

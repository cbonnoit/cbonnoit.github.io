import { BEHAVIORAL_PROMPTS, BEHAVIORAL_PROMPTS_TO_IMAGE, PROMPT_TYPES } from '../../cfg/coach.js';
import { EXTENSION_ID, SUBSCRIBE_CLIENT_ENDPOINT, FINISH_CONVERSATION_ENDPOINT, STARRED_LABEL, STARRED_DISPOSITION } from "../../cfg/endpoints.js";
import { MESSAGE_TYPES } from "../../cfg/messages.js";
import { MIN_TO_SEC, SEC_TO_MS, MICRO_TO_MS } from "../../cfg/const.js"

import { logInfo, back, arrayCompareFunc } from "../../lib/core.js";
import { generateColor } from '../../lib/graphics.js'
import { createNode, deleteAllChildren } from "../../lib/user-agent.js";
import { durationToString } from "../../lib/time-fns.js"
import { submitNotes, updateDisplay } from '../../lib/app/services.js';
import { simpleFetchAndCheck } from '../../lib/network.js'

const _LOG_SCOPE = '[Trellus][External page]'

// extension information
let _extensionId = EXTENSION_ID
let _extensionVersion = "1.0.6.3".split().map(x => parseInt(x))
let _apiKey = null
let _forceServicesHostname = null

// keep track of the current live session and related information
let _session = null
let _sessionActive = false
let _socket = null
let _clientId = null
let _call_active = false
// track sessions that have been ended
let _sessionIdsEnded = new Set()

// keep track of the current shown prompts
let _activeBehavioralPrompt = null
let _activeBehavioralPromptStartDate = null
let _activeBehavioralIntervalId = null
let _activeTriggerPrompt = null
let _activeTriggerPromptStartDate = null
let _activeTriggerIntervalId = null
let _behavioralPromptPersistanceDuration = SEC_TO_MS * 5
let _triggerPromptPersistenceDuration = SEC_TO_MS * 10
let _partyCodeToColor = {}
let _transcripts = []
let partyToSummary = new Map()

let _transcript_starred = false 

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
    
    // TODO: remove at some point, need to do this for backwards compatibility since some extensions may still anticipate this message for now...
    chrome.runtime.sendMessage(_extensionId, {
      'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_REALTIME_ENABLED,
      'realtimeIsEnabled': ev.target.checked, 
    })

    chrome.runtime.sendMessage(_extensionId, {
      'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_NEXT_OR_CURRENT_CALL_IS_DISABLED,
      'nextOrCurrentCallIsEnabled': ev.target.checked
    })

    let updateText
    if (ev.target.checked)
      updateText = 'Coaching Enabled'
    else if (_call_active) 
      updateText = 'Current Call Disabled'
    else
      updateText = 'Next Call Disabled'
    document.querySelector('#realtimeEnabledText').textContent =  updateText

    // if disabling coaching, ensure that any active session is disabled
    if (!ev.target.checked && _session != null) 
      endSession(_session['session_id'])
    
  })

  // tell the content script that the app is loaded
  window.postMessage({type: MESSAGE_TYPES.EXTERNAL_TO_APP_IS_LOADED})

  document.querySelector('#copyButton').addEventListener("mouseover", () => {
    document.querySelector('#shareText').textContent = 'Click to copy'
  })

  document.querySelector("#copyButton").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.querySelector('#copyText').textContent);
    document.querySelector('#shareText').textContent = 'Copied!'
  })

  document.querySelector('#transcript-star').addEventListener("click", handleTranscriptStarred)

  // user actions on auto-summary
  document.querySelector('#auto-summary-copy-button').addEventListener("click", () => {
    const summary_text = document.querySelector('#auto-summary-container').textContent.trim()
    if (summary_text.length) {
      window.navigator.clipboard.writeText(summary_text)
        .then(() => toast('copied!', 2000, '#3a5', '#fff'))
        .catch(() => toast('could not copy summary to clipboard', 3000, '#c00', '#fff'))
    }
  })
  document.querySelector('#auto-summary-inject-button').addEventListener("click", () => {
    const summary_text = document.querySelector('#auto-summary-container').textContent.trim()
    if (summary_text.length) {
      const message_type = arrayCompareFunc(_extensionVersion, [1, 0, 6, 7]) >= 0 ? MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_CALL_FINALIZATION : MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_TEXT_SUMMARY
      chrome.runtime.sendMessage(_extensionId, {
        'type': message_type,
        'summary': summary_text,
      }, (success) => {
        if (success) {
          toast('copied!', 2000, '#3a5', '#fff')
        } else {
          toast('could not copy summary to dialer', 3000, '#c00', '#fff')
        }
      })
    }
  })
  document.querySelector('#auto-summary-reject-button').addEventListener("click", () => {
    toast('thanks!', 2000)
    resetUIVisibility()
  })

  // click to hide toast popup
  document.querySelector('#toast').addEventListener("click", hideToast)
}

function handleTranscriptStarred() {
  const dispositions = []
  if (_transcript_starred) {
    document.querySelector('#transcript-star').innerHTML = "&#9734"
    document.querySelector('#transcript-star').style.backgroundColor = "lightgrey"
  } else {
    dispositions.push({'value': STARRED_DISPOSITION, 'label': STARRED_LABEL})
    document.querySelector('#transcript-star').innerHTML = "&#9733"
    document.querySelector('#transcript-star').style.backgroundColor = "#5DD077"
  }

  _transcript_starred = !_transcript_starred
  // update dispositions
  submitNotes(_apiKey, _session['session_id'], dispositions)
}

function receiveMessage (event) {
  const message = event.data
  logInfo(`${_LOG_SCOPE} Receiving message type ${message['type']}`)
  switch (message['type']) {
    case MESSAGE_TYPES.APP_TO_EXTERNAL_CHECK_IS_LOADED:
      window.postMessage({type: MESSAGE_TYPES.EXTERNAL_TO_APP_IS_LOADED})
      break
    case MESSAGE_TYPES.APP_TO_EXTERNAL_START_CALL:
      _call_active = true
      if (!document.querySelector('#realtimeEnabled').checked)
        document.querySelector('#realtimeEnabledText').textContent =  'Current Call Disabled'
      break
    case MESSAGE_TYPES.APP_TO_EXTERNAL_END_CALL:
      if (message['sessionId'] != null) {
        // If we have explicit session ids and they don't match, don't stop anything yet.
        // This keeps us online if an old call's end comes after a new call starts.
        //
        // Since we don't have a session id at the time of START_CALL,
        // this could get us stuck (until the next call begins and ends) with
        // _call_active = true and the coaching toggle disabled if we get
        // the END_CALL before the START_COACHING (startSession).
        // But at least we guarantee that no session remains stuck open
        // as long as we ever receive its END_CALL:
        // 1. If END_CALL is received for a past session, it will already have
        //    been ended by startSession calling endSession;
        // 2. If END_CALL is received for a current session, call endSession
        //    when COACHING_END comes down the coaching websocket,
        //    and set a timeout in endCurrentConversation() as a backup.
        // 3. If END_CALL is received for a future session, record it in
        //    _sessionIdsEnded so we can reject its start when that comes.
        //
        // If there is no session id (old extension or coaching not enabled)
        // then we blindly assume messages arrive in order.
        _sessionIdsEnded.add(message['sessionId'])
        if (_session !== null && message['sessionId'] != _session['session_id']) break
      }
      // set call state
      _call_active = false
      // reset toggle
      document.querySelector('#realtimeEnabled').checked = true
      document.querySelector('#realtimeEnabledText').textContent =  'Coaching Enabled'
      // kick off cleanup
      endCurrentConversation()
      break
    case MESSAGE_TYPES.APP_TO_EXTERNAL_START_COACHING:
      // If END_CALL for the messaged session already came, don't start it.
      if (_sessionIdsEnded.has(message['session']['session_id'])) {
        logInfo(`${_LOG_SCOPE} Ignoring START_COACHING for already-ended session ${message['session']['session_id']}`)
      } else {
        startSession(message['session'])
      }
      break
    case MESSAGE_TYPES.APP_TO_EXTERNAL_SET_EXTENSION_INFO:
      _extensionId = message['extensionId']
      _apiKey = message['apiKey']
      _forceServicesHostname = message['forceServicesHostname']
      if (message['extensionVersion']) _extensionVersion = message['extensionVersion'].split('.').map(x => parseInt(x))
      logInfo(`${_LOG_SCOPE} Extension version is ${_extensionVersion}`)
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
function startSession (session) {
  logInfo(`${_LOG_SCOPE} Starting session ${session['session_id']}`)
  // Ensure cleanup gets triggered even if the END_CALL message got dropped.
  endCurrentConversation()  // do first because it needs _session
  endSession()  // end prev session immediately; don't wait for finalization
  resetUI()

  // set session
  _session = session
  _sessionActive = true

  // create websocket
  const queryString = new URLSearchParams({'session_id': session['session_id']}).toString()
  const socketUrl = `wss://${session['realtime_hostname']}/${SUBSCRIBE_CLIENT_ENDPOINT}?${queryString}`
  const socket = new WebSocket(socketUrl)
  _socket = socket
  
  // attach handlers
  socket.onopen = () => {
    logInfo(`${_LOG_SCOPE} Open client socket for ${session['session_id']}`)
  }
  socket.onmessage = (event) => {
    // get the data
    const data = JSON.parse(event['data'])

    // check the session is current
    if (session['session_id'] != _session['session_id']) {
      logInfo(`${_LOG_SCOPE} Skipping client data from stale session ${session['session_id']}`)
      return
    }

    // display it
    logInfo(`${_LOG_SCOPE} Receving data from client socket for ${session['session_id']}`, JSON.stringify(data))
    _clientId = data['client_id'] ?? _clientId
    if (data['transcript_data'] != null) 
      updateTranscript(data['transcript_data'])
    else if (data['coaching_data'] != null)
      updateCoachingData(data['coaching_data']['coaching'])
    else if (data['weather_data'] != null)
      updateWeather(data['weather_data']['weather']) // todo: weather by party...
    else if (data['previous_prospect_calls_data'] != null)
      updatePreviousProspectCallData(data['previous_prospect_calls_data'])
  }
  socket.onclose = () => {
    logInfo(`${_LOG_SCOPE} Closed client socket for ${session['session_id']}`)
    endSession(session['session_id'])
  }
}

/**
 * End the current or specified session
 * @param {String|null} sessionId 
 */
function endSession (sessionId) {
  // nothing to do if there is no active session
  if (!_sessionActive) return

  // if a sessionId is specified and it is inconsistent it is likely stale
  if (sessionId != null && _session['session_id'] !== sessionId) return

  // end the current session
  logInfo(`${_LOG_SCOPE} Ending session ${_session['session_id']}`)
  _sessionActive = false
  if (_socket != null) {
    _socket.close()
    _socket = null
  }

  // reset dynamic prompts
  if (isTextSummaryPending()) {
    updateTextSummaryUIMessageOnly("Sorry, server didn't respond 🥺")
  }
  resetBehavioralUI()
  resetTriggerUI()
  _clientId = null
}

/**
 * End the conversation of the current session
 */
function endCurrentConversation() {
  if (!_sessionActive) return

  // notify the realtime server
  const finish_endpoint = `https://${_session['realtime_hostname']}/${FINISH_CONVERSATION_ENDPOINT}`
  simpleFetchAndCheck(finish_endpoint, {conversation_id: _session['conversation_id']}, true)

  // in case the shutdown handshake broke, set a timeout to end the session
  const closing_session_id = _session['session_id']
  window.setTimeout(() => endSession(closing_session_id), 60000)
}

/**
 * Reset all display elements on the UI
 */
function resetUI () {
  resetUIVisibility()
  resetWeatherUI()
  resetRecallUI()
  updateBuyingIntentUI(0)
  resetBehavioralUI()
  resetTriggerUI()
  resetTranscriptAndSummaryUI()
}

/**
 * Reset which boxes are shown and which are hidden
 */
function resetUIVisibility () {
  const realtimePanels = [
    document.querySelector('#recall-main'),
    document.querySelector('#local-main'),
    document.querySelector('#behavioral-main'),
    document.querySelector('#objection-main'),
  ]
  for (const c of realtimePanels) {
    c.style.display = ''
  }
  document.querySelector('#auto-summary-main').style.display = 'none'
}

/**
 * Reset the weather UI elements
 */
function resetWeatherUI() {
  // clear weather & news
  //   <div class="weather" id="weather-main">
  //   <div class="placeholder-text" id="weather-placeholder-text" >Gathering weather data...</div>
  // </div>
  const weatherElement = document.querySelector('#weather-main')
  weatherElement.innerHTML = ''
  weatherElement.appendChild(createNode('div', {'class': 'placeholder-text', 'id': 'weather-placeholder-text'}, 'Gathering weather data...'))
}

function resetRecallUI() {
  const recallElement = document.querySelector('#recall-info-main')
  recallElement.innerHTML = ''
  recallElement.appendChild(createNode('div', {'class': 'placeholder-text', 'id': 'recall-placeholder-text'}, 'Gathering recall data...'))
}

/**
 * Reset the behavioral prompt UI elements
 */
function resetBehavioralUI() {
  // clear the ui
  const behavioralImg = document.querySelector('#behavioral-guidance-img')
  behavioralImg.style.opacity = '0'
  behavioralImg.src = '/images/great_work.png'
  behavioralImg.style.opacity = '100%'

  // if there is no prompt, exit early
  if (_activeBehavioralPrompt == null) return

  // log the prompt resetting
  if (_apiKey != null)
    updateDisplay(_apiKey, _clientId, _activeBehavioralPrompt['prompt_id'], _activeBehavioralPrompt['prompt_type'],
      _activeBehavioralPrompt['prompt_text'], _activeBehavioralPromptStartDate, new Date())
  
  // clear the prompt and interval
  _activeBehavioralPrompt = null
  _activeBehavioralPromptStartDate = null
  if (_activeBehavioralIntervalId != null) clearInterval(_activeBehavioralIntervalId)
  _activeBehavioralIntervalId = null
}

function resetTriggerUI() {
  // clear the ui
  document.querySelector('#objection-header').textContent = 'Suggestions'
  document.querySelector('#customize-link').style.display = "block"
  document.querySelector('#objection').innerHTML = '';
  document.querySelector('#objection').appendChild(createNode('div', {id: 'objection-placeholder-text', class: 'placeholder-text'}, "Listening for objections..."))
  document.querySelector('#objection').appendChild(createNode('div', {id: 'objection-container', class: 'flexColumn'}))

  // if there is no prompt, exit early
  if (_activeTriggerPrompt == null) return

  // log the prompt resetting
  if (_apiKey != null)
    updateDisplay(_apiKey, _clientId, _activeTriggerPrompt['prompt_id'], _activeTriggerPrompt['prompt_type'],
      _activeTriggerPrompt['prompt_text'], _activeTriggerPromptStartDate, new Date())

  // clear the prompt and interval
  _activeTriggerPrompt = null
  _activeTriggerPromptStartDate = null
  if (_activeTriggerIntervalId != null) clearInterval(_activeTriggerIntervalId)
  _activeTriggerIntervalId = null
}

/**
 * Reset the transcript and talk time summary panels
 */
function resetTranscriptAndSummaryUI() {
  _partyCodeToColor = {}
  _transcripts = []
  _transcript_starred = false 
  document.querySelector('#transcript-star').innerHTML = "&#9734"
  document.querySelector('#transcript-star').style.backgroundColor = "lightgrey"
  partyToSummary = new Map()
  document.querySelector('#transcriptRoot').innerHTML = ''
  document.querySelector('#trellus-summary').innerHTML = ''
}

/**
 * Add transript to display
 * @param {Object} transcript Transcript object to add
 */
function updateTranscript (transcript) {
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
    extendLastTranscript(text)
  else {
    // get the start time (relative to audio zero)
    const startTimeMs = transcript['start_time'] * SEC_TO_MS
    // create a new transcript
    addNewTranscript(text, partyCode, transcript['person_name'], startTimeMs)
  }

  // keep scroll at bottom. note: if this is done immediately, layout may not be complete
  if (isScrolledToBottom) setTimeout(() => root.scrollTop = root.scrollHeight, 0)
}

/**
 * Extend the last transcript with additional words
 * @param {String} text Text to extend transcript with
 */
function extendLastTranscript (text) {
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
function addNewTranscript (text, partyCode, partyName, startTime) {
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
 * @param {object} prompt
 */
function updateCoachingData (prompt) {
  // per-prompt rendering
  const promptType = prompt['prompt_type'].toUpperCase()
  if (promptType === PROMPT_TYPES.SUMMARY_V2) {
    updateSummary(prompt['value'])
  } else if (promptType === PROMPT_TYPES.TRIGGER) {
    updateTriggerUI(prompt)
  }else if (BEHAVIORAL_PROMPTS.includes(promptType)) {
    updateBehavioralSuggestionUI(prompt)
  } else if (promptType === PROMPT_TYPES.BUYING_INTENT) {
    updateBuyingIntentUI(prompt['value'])
  } else if (promptType === PROMPT_TYPES.TEXT_SUMMARY_PENDING) {
    if (prompt['value']) {
      showLoadingTextSummaryUI()
    }
  } else if (promptType === PROMPT_TYPES.TEXT_SUMMARY) {
    updateTextSummaryUI(prompt)
  } else if (promptType === PROMPT_TYPES.TEXT_SUMMARY_ERROR) {
    updateTextSummaryUIMessageOnly("Sorry, " + prompt["value"])
  } else if (promptType === PROMPT_TYPES.COACHING_END) {
    // caller (socket.onmessage) has already checked that _session['sessionId']
    // matches the sessionId that the socket was opened with.
    endSession(_session['sessionId'])
  } else {
    logInfo(`Unknown prompt ${promptType}`)
  }
}

/**
 * Updates objection data with new data
 * @param {object} prompt
 */
function updateTriggerUI (prompt) {
  // reset the ui
  resetTriggerUI()

  // set trigger text
  const placeholderText = document.querySelector('#objection-placeholder-text')
  if (placeholderText) placeholderText.remove()
  const triggerName = prompt['value']['trigger_name']
  const triggerResponse = prompt['value']['trigger_prompt']
  document.querySelector('#customize-link').style.display = "none"
  document.querySelector('#objection-header').textContent = `Objection: ${triggerName.toLowerCase()}`
  const objectionContainer = document.querySelector('#objection-container')
  deleteAllChildren(objectionContainer)
  const responses = Array.isArray(triggerResponse) ? triggerResponse : triggerResponse.split('\n')
  for (const response of responses)
    objectionContainer.appendChild(createCheckListElement(response, false))

  // store references to this as the active trigger
  _activeTriggerPrompt = prompt
  _activeTriggerPromptStartDate = new Date()
  _activeTriggerIntervalId = setTimeout(() => resetTriggerUI(), _triggerPromptPersistenceDuration)
 
  // post to the update-display endpoint
  updateDisplay(_apiKey, _clientId, prompt['prompt_id'], prompt['prompt_type'],
    prompt['prompt_text'], _activeTriggerPromptStartDate, null)
}

/**
 * Creates a checklist element
 * @param labelText text for checklist element
 * @param checked whether the element should already be checked
 * @returns {HTMLDivElement}
 */
function createCheckListElement(labelText, checked) {
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

/**
 * Updates the behavioral suggestion with a new prompt
 * @param {Objection} prompt
 */
function updateBehavioralSuggestionUI (prompt) {
  // handle case where there already is an active prompt
  const promptType = prompt['prompt_type']
  if (_activeBehavioralPrompt != null) {
    // if there is an active prompt and the new prompt is different, ignore the new prompt
    // the assumption here is that prompts will get refreshed as long as they are valid for
    // and the font end should avoid flickering between multiple simultaneously valid prompts
    if (_activeBehavioralPrompt['prompt_type'] !== promptType) return;

    // if the are the same, just extend the timeout interval
    // note: this also avoids spamming the update display endpoint
    clearInterval(_activeBehavioralIntervalId)
    _activeBehavioralIntervalId = setTimeout(() => resetBehavioralUI(), _behavioralPromptPersistanceDuration)
    return
  }

  // clear current ui
  resetBehavioralUI()

  // only show known images
  if (!BEHAVIORAL_PROMPTS_TO_IMAGE.hasOwnProperty(promptType)) {
    logInfo(`image not created for prompt: ${promptType}`)
    return
  }

  // set the image
  const behavioralImg = document.querySelector('#behavioral-guidance-img')
  behavioralImg.src = BEHAVIORAL_PROMPTS_TO_IMAGE[promptType]
  behavioralImg.style.opacity = '100%'

  // update active prompt
  _activeBehavioralPrompt = prompt;
  _activeBehavioralPromptStartDate = new Date()
  _activeBehavioralIntervalId = setTimeout(() => resetBehavioralUI(), _behavioralPromptPersistanceDuration)

  // post to the update-display endpoint
  updateDisplay(_apiKey, _clientId, prompt['prompt_id'], prompt['prompt_type'],
    prompt['prompt_text'], _activeBehavioralPromptStartDate, null)
}

/**
 * Update the summary
 * @param {Array.<Object>} data Summary data
 */
function updateSummary (data) {
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
    updateActiveIntervals(partyData['party_code'], partyData['party_name'], partyData['intervals'], totalTalkTime)
}

/**
 * Update intervals by party
 * @param {Number} partyCode Party identifier to update intervals for
 * @param {String} partyName Party name to display with intervals
 * @param {Array.<Object>} intervals intervals in the form {start, end}
 */
function updateActiveIntervals (partyCode, partyName, intervals, totalTalkTime) {
  // create the party summary
  if (!partyToSummary.has(partyCode))
    createPartySummary(partyCode, partyName)

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
function createPartySummary (partyCode, partyName) {
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

function updateBuyingIntentUI(data) {
  const buyingSignalMeter = document.querySelector('#buyingSignal')
  const percentageSignal = parseFloat(data)*100
  buyingSignalMeter.setAttribute('aria-valuenow', `${percentageSignal}`)
  buyingSignalMeter.style.setProperty('--value', `${percentageSignal}`)
}


/**
 * Render a short time string of current time with specified UTC offset
 * @param {number} offsetSeconds seconds east of UTC
 */
 function renderLocalTime (offsetSeconds) {
  const now = new Date()
  // Date.getTimezoneOffset returns minutes west of UTC
  // but I didn't read the docs carefully so this might go very badly near DST changes
  const offsetFromHere = offsetSeconds + now.getTimezoneOffset() * 60
  const offsetTime = new Date(now.getTime() + offsetFromHere * 1000)
  return offsetTime.toLocaleTimeString([], {timeStyle: "short"})
}

function timeSince(date) {
  console.log(date)

  var seconds = Math.floor((new Date() - date) / 1000);

  var interval = seconds / 31536000;

  if (interval > 1) {
    return Math.floor(interval) + " years ago";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + " months ago";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + " days ago";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + " hours ago";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + " minutes ago";
  }
  return Math.floor(seconds) + " seconds ago";
}

/**
 * Update previous prospect call data based on input
 * @param {object} data
 */
function updatePreviousProspectCallData (data) { 
  const previousCalls = data['session_count']
  const notes = data['notes']
  const dispositions = data['dispositions']
  const displays = data['displays']

  const recallElement = document.querySelector('#recall-info-main')
  const parentDiv = createNode('div', {'style': 'flex-direction: column; display: flex; width: 100%'})
  recallElement.innerHTML = '';
  recallElement.appendChild(parentDiv)

  
  const prevCountParentDiv = createNode('div', {'style': 'flex-direction: row; display: flex'})
  const prevCountTextDiv = createNode('div', {'style': 'min-width: 30%; max-width: 30%; width: 30%; margin-right: 5px; color: grey'})
  const prevCountValueDiv = createNode('div')
  prevCountTextDiv.innerText = "Dials (#):"; // super easy place to show how many prospect/gatkeeper/voicemails you hit
  prevCountValueDiv.innerText = previousCalls

  prevCountParentDiv.appendChild(prevCountTextDiv)
  prevCountParentDiv.appendChild(prevCountValueDiv)
  parentDiv.appendChild(prevCountParentDiv)

  if (previousCalls === 0) return


  const lineParentDiv = createNode('div', {'style': 'width: 100%; text-align: center; border-bottom: 1px solid grey; line-height: 0.1em; margin: 10px 0 20px;'})
  const spanTextDiv = createNode('span', {'style': 'background: #EEEEF0; padding: 0 10px; color: grey'})
  spanTextDiv.innerText = 'Last Dial'
  lineParentDiv.appendChild(spanTextDiv)

  parentDiv.appendChild(lineParentDiv)

  const lastCallTimeParentDiv = createNode('div', {'style': 'flex-direction: row; display: flex'})
  const lastCallTextDiv = createNode('div', {'style': 'min-width: 25%; max-width: 25%; width: 25%; margin-right: 5px; color: grey'})
  const lastCallValueDiv = createNode('div')
  lastCallTextDiv.innerText = "Last Call: "; 
  lastCallValueDiv.innerText = timeSince(new Date(data['last_call_time'] * MICRO_TO_MS))

  lastCallTimeParentDiv.append(lastCallTextDiv)
  lastCallTimeParentDiv.append(lastCallValueDiv)
  parentDiv.appendChild(lastCallTimeParentDiv)


  const audioDurationParentDiv = createNode('div', {'style': 'flex-direction: row; display: flex'})
  const audioDurationTextDiv = createNode('div', {'style': 'min-width: 25%; max-width: 25%; width: 25%; margin-right: 5px; color: grey'})
  const audioDurationValueDiv = createNode('div')
  audioDurationTextDiv.innerText = "Time: "; 
  audioDurationValueDiv.innerText = new Date(data['audio_duration'] * 1000).toISOString().substring(14, 19)

  audioDurationParentDiv.append(audioDurationTextDiv)
  audioDurationParentDiv.append(audioDurationValueDiv)
  parentDiv.appendChild(audioDurationParentDiv)

  if (dispositions.length !== 0) {
    const dispositionParentDiv = createNode('div', {'style': 'flex-direction: row; display: flex'})
    const prevDispositionTextDiv = createNode('div', {'style': 'min-width: 25%; max-width: 25%; width: 25%; margin-right: 5px; color: grey'})
    const prevDispositionValueDiv = createNode('div')
    prevDispositionTextDiv.innerText = "Dispo:"; 

    const dispositionTextValues = dispositions.map(disposition => disposition['disposition'])
    prevDispositionValueDiv.innerText = dispositionTextValues.join(', ')
  
    dispositionParentDiv.append(prevDispositionTextDiv)
    dispositionParentDiv.append(prevDispositionValueDiv)
  
    parentDiv.appendChild(dispositionParentDiv)
  }

  const filteredDisplays = displays.filter(display => display['prompt_type'] == 'TEXT_SUMMARY')
  if (notes.length == 0 && filteredDisplays.length == 0) return

  const noteParentDiv = createNode('div', {'style': 'flex-direction: row; display: flex; cursor: pointer;'})
  const prevNoteTextSpan = createNode('span', {'style': 'margin-right: 35px; color: grey'})
  const prevNoteValueDiv = createNode('div', {'class': 'text-truncate'})
  prevNoteTextSpan.innerText = "Note:"; 
  noteParentDiv.onclick = function () {
    prevNoteValueDiv.classList.toggle('text-truncate')
  }
  prevNoteValueDiv.appendChild(prevNoteTextSpan)

  let noteText
  if (notes.length !== 0) {
    const noteTextValues = notes.map(note => note['note'])
    noteText = noteTextValues.join(' | ')
  } else { 
    const noteTextValues = filteredDisplays.map(display => display['prompt_text'])
    noteText = noteTextValues.join(' | ')
  }

  prevNoteValueDiv.appendChild(document.createTextNode(noteText))
  noteParentDiv.append(prevNoteValueDiv)
  parentDiv.appendChild(noteParentDiv)
}


/**
 * Update weather based on input
 * @param {object} weather
 */
 function updateWeather (weather) { 
  const weatherElement = document.querySelector('#weather-main')

  const parentDiv = createNode('div', {'style': 'flex-direction: column; display: flex'})

  const upperDiv = createNode('div', {'style': 'display: flex; flex-wrap: nowrap; align-items: center; justify-content: center;'})
  const weatherValue = createNode('div', {}, Math.trunc(weather['temperature']) + String.fromCharCode(176) + 'F')    
  const weatherImg = createNode('img', {'src': weather['icon_url'], 'style': 'background-color: #adc1e67d; border-radius: 50%; margin-left: 10px;'})
  upperDiv.appendChild(weatherValue)
  upperDiv.appendChild(weatherImg)

  const bottomDiv = createNode('div', {'style': 'margin-top: 4px; color: #423838;'})
  const weatherLocation = createNode('span', {}, " in " + weather['location_str'])
  const prospectLocalTime = createNode('span', {}, renderLocalTime(weather['utcoffset']))
  bottomDiv.appendChild(prospectLocalTime)
  bottomDiv.appendChild(weatherLocation)
  setTimeout(function updateLocalTime() {
    if (weatherElement.contains(prospectLocalTime)) {
      prospectLocalTime.textContent = renderLocalTime(weather['utcoffset']);
      setTimeout(updateLocalTime, 60 - Math.min(59, (new Date()).getSeconds()))
    }
  }, 1)

  parentDiv.appendChild(upperDiv)
  parentDiv.appendChild(bottomDiv)

  weatherElement.innerHTML = '';
  weatherElement.appendChild(parentDiv)
}

function showLoadingTextSummaryUI() {
  const realtimePanels = [
    document.querySelector('#local-main'),
    document.querySelector('#behavioral-main'),
    document.querySelector('#objection-main'),
  ]
  for (const c of realtimePanels) {
    c.style.display = 'none'
  }
  document.querySelector('#auto-summary-placeholder-text').style.display = ''
  document.querySelector('#auto-summary-container').style.display = 'none'
  document.querySelector('#auto-summary-main').style.display = ''
  document.querySelector('#auto-summary-buttons').style.display = 'none'
  // display inject button iff we have an integration for it
  if (
    _session != null
    && _session['platform'] == 'SALESLOFT'
    && arrayCompareFunc(_extensionVersion, [1, 0, 6, 5]) >= 0
  ) {
    document.querySelector('#auto-summary-copy-button').style.display = 'none'
    document.querySelector('#auto-summary-inject-button').style.display = ''
  } else {
    document.querySelector('#auto-summary-copy-button').style.display = ''
    document.querySelector('#auto-summary-inject-button').style.display = 'none'
  }
}

function isTextSummaryPending() {
  return (
    document.querySelector('#auto-summary-placeholder-text').style.display == ''
    && document.querySelector('#auto-summary-container').style.display == 'none'
    && document.querySelector('#auto-summary-main').style.display == ''
  )
}

function updateTextSummaryUIMessageOnly(message) {
  const textContainer = document.querySelector('#auto-summary-container')
  textContainer.textContent = message
  // make sure we're visible
  showLoadingTextSummaryUI()
  document.querySelector('#auto-summary-placeholder-text').style.display = 'none'
  textContainer.style.display = ''
}

function updateTextSummaryUI(prompt) {
  updateTextSummaryUIMessageOnly(prompt['value'])
  // show action buttons
  document.querySelector('#auto-summary-buttons').style.display = ''
  // post to the update-display endpoint
  updateDisplay(_apiKey, _clientId, prompt['prompt_id'], prompt['prompt_type'],
    prompt['value'], new Date(), null)
}

// Display pop-up messages at the top of the window
let _toastHideTimer = null

function toast(message, timeout=5000, bg='lightgrey', fg='#000') {
  const toastContainer = document.querySelector('#toast-container')
  const toast = document.querySelector('#toast')
  toast.textContent = message
  toast.style.backgroundColor = bg
  toast.style.color = fg
  toastContainer.style.top = '25px'
  if (_toastHideTimer !== null) window.clearTimeout(_toastHideTimer)
  _toastHideTimer = window.setTimeout(hideToast, timeout)
}

function hideToast() {
  const toastContainer = document.querySelector('#toast-container')
  const toast = document.querySelector('#toast')
  toastContainer.style.top = `-${toast.offsetHeight + 30}px`
}

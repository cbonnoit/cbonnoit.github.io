import {
  BEHAVIORAL_PROMPTS, BEHAVIORAL_PROMPTS_TO_IMAGE,
  PROMPT_TYPES,
  PROMPTS_TO_ONLY_DEMO_MODE,
} from '../../cfg/coach.js';
import {CLOSED, DISABLED, MIN_TO_SEC, SEC_TO_MS} from '../../cfg/const.js';
import { SUBSCRIBE_CLIENT_ENDPOINT } from '../../cfg/endpoints.js';
import { generateColor } from '../graphics.js'
import { createLoggingWebsocketPromise } from '../network.js';
import {createNode, deleteAllChildren} from '../user-agent.js';
import { back } from '../core.js';
import { durationToString } from '../time-fns.js';


export class CoachingManager {
  constructor (sessionIdentifiers, demoMode=false) {
    // track requests from extension to use demo mode or force realtime hosts
    this._demoMode = demoMode

    // session websocket
    this._clientSocket = null;

    // keep track of the current shown behavioral prompt
    this._activePrompt = null;
    this._activePromptIntervalId = null;
    this._promptPersistanceDuration = SEC_TO_MS * 5;


    this._mainBoxHeight = 300
    this._localBoxHeight = 75
    this._suggestionBoxHeight = 150

    this._mainBoxWidth = 300
    this._transcriptBoxWidth = 425

    this._updateWidth = this._mainBoxWidth + this._transcriptBoxWidth
    this._updateHeight = this._mainBoxHeight + this._localBoxHeight + this._suggestionBoxHeight

    // keep track of transcripts
    this._transcripts = []
    this._partyCodeToColor = {}

    this._resize(this._updateWidth, this._updateHeight)

    this.createDOM()
    this.start(sessionIdentifiers)
  }

  /**
   * Create the coaching DOM attached to the specified shadow
   */
  async createDOM() {
    // mic menu should be responsive
    document.querySelector('#moveMenu').addEventListener('click', () => {
      window.parent.postMessage({"type": "drag"}, '*');
      document.querySelector('.trellus-transcript-box').classList.add(DISABLED)
      document.querySelectorAll('.main').forEach((element) => element.classList.add(DISABLED))
      const coverElement = createNode('div', {'class': 'text-cover'})
      coverElement.textContent = 'Drag to location and click to exit dragging mode.'
      document.querySelector('#coach-root').prepend(coverElement)
    })


    // local option should be responsive
    document.querySelector('#localMenu').addEventListener('click', () => {
      document.querySelector('#local-main').classList.toggle(CLOSED)
      if (document.querySelector('#local-main').classList.contains(CLOSED)) {
        this._resize(this._updateWidth, this._updateHeight - this._localBoxHeight)
      } else {
        this._resize(this._updateWidth, this._updateHeight + this._localBoxHeight)
      }
    })

    // local option should be responsive
    document.querySelector('#objectionMenu').addEventListener('click', () => {
      document.querySelector('#objection-main').classList.toggle(CLOSED)
      if (document.querySelector('#objection-main').classList.contains(CLOSED)) {
        this._resize(this._updateWidth, this._updateHeight - this._suggestionBoxHeight)
      } else {
        this._resize(this._updateWidth, this._updateHeight + this._suggestionBoxHeight) 
      }
    })


    // mic menu should be responsive
    document.querySelector('#micMenu').addEventListener('click', () => {
      document.querySelector('.trellus-transcript-box').classList.toggle(CLOSED)
      const root = document.querySelector('#transcriptRoot')
      setTimeout(() => root.scrollTop = root.scrollHeight, 0)
      if (document.querySelector('.trellus-transcript-box').classList.contains(CLOSED)) {
        this._resize(this._updateWidth - this._transcriptBoxWidth, this._updateHeight)
      } else {
        this._resize(this._updateWidth + this._transcriptBoxWidth, this._updateHeight)
      }
    })

    // the main close menu should be responsive
    document.querySelector('#main-close').addEventListener('click', () => {
      this.stop()
    })

    document.querySelector('#transcript-close').addEventListener('click', () => {
      document.querySelector('.trellus-transcript-box').classList.add(CLOSED)
    })

    document.querySelector('#local-close').addEventListener('click', () => {
      document.querySelector('#local-main').classList.add(CLOSED)
    })

    document.querySelector('#objection-close').addEventListener('click', () => {
      document.querySelector('#objection-main').classList.add(CLOSED)
    })

    document.querySelector('#coach-root').style.visibility = 'visible'
  }

  /**
   * Start a coaching session with specified parameters
   * @param {Object} session
   */
  async start(session) {
    console.log(`[Trellus][iframe] Starting session ${session.session_id}`)
    if (this._clientSocket)
      throw new Error(`Close existing connection before starting a new one`)

    this._clientSocket = await this._connectClientSocket(session)
    this._partyToSummary = new Map();
  }

  closeSockets() {
    console.log(`[Trellus][iFrame] Requesting client socket close`)
    if (this._clientSocket) this._clientSocket.close()
    this._clientSocket = null
    this._partyToSummary = null
  }

  /**
   * Stop the coaching session
   */
  stop() {
    this.closeSockets()
    window.parent.postMessage({"type": "close"}, '*');
  }

  _resize(updateWidth, updateHeight) {
    this._updateWidth = updateWidth
    this._updateHeight = updateHeight
    window.parent.postMessage({"type": "adjustSize", "width": this._updateWidth, "height": this._updateHeight}, '*');
  }

  /**
   * Add transript to display
   * @param {Object} transcript Transcript object to add
   */
  _updateTranscript (transcript) {
    console.log(`[Trellus][iframe] Transcript from ${transcript['person_name']} (${transcript['party_code']}). Text: "${transcript['text']}"`)
    // get party code and name
    const partyCode = transcript['party_code']

    // if new party ID - generate a color for that party
    if (!(partyCode in this._partyCodeToColor))
      this._partyCodeToColor[partyCode] = generateColor(Object.keys(this._partyCodeToColor).length)

    // get the text
    const text = transcript['text']

    // nothing to do if there is no text
    if (text === '') return

    const root = document.querySelector('#transcriptRoot')
    const isScrolledToBottom = Math.abs((root.scrollTop + root.offsetHeight) - root.scrollHeight) < 5

    // if this party is also the party of the last transcript, then append the text
    if ((back(this._transcripts) ?? {})['partyCode'] === partyCode)
      this._extendLastTranscript(text)
    else {
      // get the start time (relative to audio zero)
      const startTimeMs = transcript['start_time'] * SEC_TO_MS
      // create a new transcript
      this._addNewTranscript(text, partyCode, transcript['person_name'], startTimeMs)
    }

    // keep scroll at bottom. note: if this is done immediately, layout may not be complete
    if (isScrolledToBottom) setTimeout(() => root.scrollTop = root.scrollHeight, 0)
  }

  /**
   * Extend the last transcript with additional words
   * @param {String} text Text to extend transcript with
   */
  _extendLastTranscript (text) {
    const transcript = back(this._transcripts)
    transcript.contentNode.textContent += ' ' + text
  }

  /**
   * Create new dom nodes associated with a new transcript
   * @param {String} text
   * @param {Number} partyCode
   * @param {String} partyName
   * @param {Number} startTime Start time (in milliseconds)
   */
  _addNewTranscript (text, partyCode, partyName, startTime) {
    const root = document.querySelector('#transcriptRoot')
    // create nodes
    const transcriptRoot = root.appendChild(createNode('div', {'class': 'flexRowLeft transcript'}))
    transcriptRoot.appendChild(createNode('div', {'class': 'flexColumn transcriptTime'}, durationToString(startTime)))
    const nameContentNode = transcriptRoot.appendChild(createNode('div', {'class': 'transcriptNameContent'}))
    const nameAttributes = {'class': 'transcriptName', 'style': `color: ${this._partyCodeToColor[partyCode]};`}
    nameContentNode.appendChild(createNode('div', nameAttributes, partyName))
    const contentNode = nameContentNode.appendChild(createNode('div', {'class': 'transcriptContent'}, text))

    // store transcript information
    this._transcripts.push({'partyCode': partyCode, 'contentNode': contentNode})
    
  }

  /**
   * Create a WebSocket to receive coaching related data
   * @param {Object} session
   */
   async _connectClientSocket(session) {
    const queryString = new URLSearchParams({'session_id': session['session_id']}).toString()
    const socketUrl = `wss://${session['realtime_hostname']}/${SUBSCRIBE_CLIENT_ENDPOINT}?${queryString}`
    const callback = (dataString) => {
      const data = JSON.parse(dataString)
      console.log('Receving data from client socket', JSON.stringify(data))
      if (data['transcript_data'] != null) 
        this._updateTranscript(data['transcript_data'])
      else if (data['coaching_data'] != null)
        this._updateCoachingData(data['coaching_data'])
      else if (data['weather_data'] != null)
        this._updateWeather(data['weather_data'])
    }
    return await createLoggingWebsocketPromise('clientSocket', socketUrl, callback)
  }

  /**
   * Updates objection data with new data
   * @param {string} triggerName trigger name
   * @param {string} triggerPrompt trigger prompt
   */
  _updateTrigger (triggerName, triggerPrompt) {
    // cancel any existing objection callback
    if (this._dismissObjectionIntervalId != null)
      clearInterval(this._dismissObjectionIntervalId)

    // set objection text
    const placeholderText = document.querySelector('#objection-placeholder-text')
    if (placeholderText) placeholderText.remove()

    document.querySelector('#objection-header').textContent = `Objection: ${triggerName.toLowerCase()}`
    const objectionContainer = document.querySelector('#objection-container')
    deleteAllChildren(objectionContainer)
    const responses = Array.isArray(triggerPrompt) ? triggerPrompt : triggerPrompt.split('\n')
    for (const response of responses) {
      objectionContainer.appendChild(this._createCheckListElement(response, false))
    }

    // add a callback dismissing the objection
    this._dismissObjectionIntervalId = setTimeout(() => {
      objectionContainer.innerHTML = ''
      document.querySelector('#objection-header').textContent = 'Objections'
      document.querySelector('#objection').appendChild(createNode('div', {id: 'objection-placeholder-text', class: 'placeholder-text'}, "Listening for objections..."))
    }, this._promptPersistanceDuration * 2)
  }

  /**
   * Creates a checklist element
   * @param labelText text for checklist element
   * @param checked whether the element should already be checked
   * @returns {HTMLDivElement}
   */
  _createCheckListElement(labelText, checked) {
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
   * Update the checklist with new data
   * @param {Object} data Sequence data value
   */
  _updateChecklist (data) {
    const checklist = document.querySelector('#checklist')
    checklist.innerHTML = "";
    const checklistItems = data['steps']
    for (const item of checklistItems) {
      checklist.appendChild(this._createCheckListElement(item.label, item.checked))
    }

    //update the current stage and the next stage
    const percentCompleted = data['percent_completed']; // comes in as a float [0, 100].
    const currentStageText = data['current_stage'];
    const nextStageText = data['next_stage'];

    const progressBar = document.querySelector('#progress-bar');
    const currentStageDiv = document.querySelector('#current-stage');
    const nextStageDiv = document.querySelector('#next-stage');

    progressBar.style.width = percentCompleted.toFixed() + '%'; // need to convert to a string
    currentStageDiv.textContent = 'Current: ' + currentStageText;
    if (nextStageText !== '') {
      nextStageDiv.textContent = 'Up Next: ' + nextStageText;
    } else {
      nextStageDiv.textContent = ''; // ensures old data gets cleaned up
    }
  }

  /**
   * Updates the behavioral suggestion with a new prompt
   * @param {String} prompt
   */
  _updateBehavioralSuggestion (prompt) {
    // if there is an active prompt and the new prompt is different, ignore the new prompt
    // the assumption here is that prompts will get refreshed as long as they are valid for
    // and the font end should avoid flickering between multiple simultaneously valid prompts
    if (this._activePrompt != null && this._activePrompt !== prompt) return;

    // clear any pending interruptions
    if (this._activePromptIntervalId != null) {
      clearInterval(this._activePromptIntervalId);
    }

    if (!BEHAVIORAL_PROMPTS_TO_IMAGE.hasOwnProperty(prompt)) {
      console.log(`image not created for prompt: ${prompt}`)
      return
    }

    const behavioralImg = document.querySelector('#behavioral-guidance-img')
    behavioralImg.style.opacity = '0'
    behavioralImg.src = BEHAVIORAL_PROMPTS_TO_IMAGE[prompt]
    behavioralImg.style.opacity = '100%'

    this._activePrompt = prompt;

    // automatically hide the prompt
    this._activePromptIntervalId = setTimeout(() => {
      this._clearBehavioralSuggestion()
      this._activePrompt = null;
      this._activePromptIntervalId = null;
    }, this._promptPersistanceDuration)
  }

  /**
   * Update the summary
   * @param {Array.<Object>} data Summary data
   */
  _updateSummary (data) {
    if (this._partyToSummary.size === 0) {
      console.log('[Trellus][Iframe] Sending coaching loaded to coaching UI')
      window.parent.postMessage({"type": "coachingLoaded"}, '*'); // only load on receiving first summary
    }

    let totalTalkTime = 0
    data.forEach((partyData) => {
      partyData['intervals'].forEach(({start, end}) => {
        totalTalkTime += end - start
      })    
    })

    for (const partyData of data)
      this._updateActiveIntervals(partyData['party_code'], partyData['party_name'], partyData['intervals'], totalTalkTime)
  }

  /**
   * Update intervals by party
   * @param {Number} partyCode Party identifier to update intervals for
   * @param {String} partyName Party name to display with intervals
   * @param {Array.<Object>} intervals intervals in the form {start, end}
   */
  _updateActiveIntervals (partyCode, partyName, intervals, totalTalkTime) {
    // create the party summary
    if (!this._partyToSummary.has(partyCode))
      this._createPartySummary(partyCode, partyName)

    // update party names. note there can be a race condition in the coaching run loop between receipt of
    // audio data and party person data, so it is possible to get a transitive `Unknown` name
    this._partyToSummary.get(partyCode).parentElement.querySelector('.summaryName').textContent = partyName

    // remove all previous lines
    const container = this._partyToSummary.get(partyCode).querySelector('.summaryIntervalContainer')
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

    const partyTalkPercentage = parseInt((partyTalkTime / totalTalkTime) * 100)
    this._partyToSummary.get(partyCode).parentElement.querySelector('.summaryPercentage').textContent = partyTalkPercentage + '%'
  }

  /**
   * Create DOM elements for a party summary for `partyCode`
   * @param {Number} partyCode Party identifier to update intervals for
   * @param {String} partyName Party name to display with intervals
   */
  _createPartySummary (partyCode, partyName) {
    // create layout
    const root = document.querySelector('#trellus-summary')
    const summary = root.appendChild(createNode('div', {'class': 'flexRow full summary'}))
    summary.appendChild(createNode('div', {'class': 'flexRow full summaryName'}, partyName))
    const payloadContainer = summary.appendChild(createNode('div', {'class': 'flexRow full summaryRight', 'style': 'position: relative'}))
    payloadContainer.appendChild(createNode('div', {'class': 'flexRow full summaryTop summaryIntervalContainer'}))
    payloadContainer.appendChild(createNode('div', {'class': 'flexRow full summaryBottom summaryEventContainer'}))
    summary.appendChild(createNode('div', {'class': 'flexRow full summaryPercentage'}, partyName))

    // keep a reference to the payload container
    this._partyToSummary.set(partyCode, payloadContainer)
  }

  _updateBuyingIntent(data) {
    const buyingSignalMeter = document.querySelector('#buyingSignal')
    const percentageSignal = parseFloat(data)*100
    buyingSignalMeter.setAttribute('aria-valuenow', percentageSignal)
    buyingSignalMeter.style.setProperty('--value', percentageSignal)
  }

  _updateWeather({ weather }) {
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

  /**
   * Update coaching based on input
   * @param {object} coaching
   */
  _updateCoaching (coaching) {
    // starting with 9ce9a73b6d the backend started sending coaching data through the 'coaching' parameter
    if (coaching.hasOwnProperty('coaching'))
      coaching = coaching['coaching']
    
    // skip demo mode prompts
    const prompt = coaching['prompt'].toUpperCase()
    if (!this._demoMode && PROMPTS_TO_ONLY_DEMO_MODE[prompt]) {
      console.log(`[Trellus][iframe] Demo mode only prompt received ${prompt}`)
      return
    }

    // per-prompt rendering
    if (prompt === PROMPT_TYPES.SUMMARY_V2) {
      this._updateSummary(coaching['value'])
    } else if (prompt === PROMPT_TYPES.SEQUENCE) {
      this._updateChecklist(coaching['value'])
    } else if (prompt === PROMPT_TYPES.OBJECTION_RESPONSE) {
      this._updateTrigger(coaching['value']['objection'], coaching['value']['response'])
    } else if (prompt === PROMPT_TYPES.TRIGGER) {
      this._updateTrigger(coaching['value']['trigger_name'], coaching['value']['trigger_prompt'])
    }else if (BEHAVIORAL_PROMPTS.includes(prompt)) {
      this._updateBehavioralSuggestion(prompt)
    } else if (prompt === PROMPT_TYPES.BUYING_INTENT) {
      this._updateBuyingIntent(coaching['value'])
    } else {
      console.log(`[Trellus][iframe] Unknown prompt ${prompt}`)
    }
  }

  /**
   * Update real-time coaching based on `data` recieved over the websocket
   * @param {Object} data
   * @returns
   */
  _updateCoachingData(data) {
    // case 1: coaching data is sent as an array
    if (Array.isArray(data))
      return data.forEach((x) => this._updateCoaching(x))

    // case 2: individual coaching data is sent
    this._updateCoaching(data)
  }

  _clearBehavioralSuggestion() {
    // show the prompt
    const behavioralImg = document.querySelector('#behavioral-guidance-img')
    behavioralImg.style.opacity = '0'
    behavioralImg.src = '/images/great_work.png'
    behavioralImg.style.opacity = '100%'
  }

  callEnded () {
    console.log('[Trellus][Iframe] Call ended notification sent from parent page')  
    if (this._transcripts.length >= 3) {
      console.log('[Trellus][Iframe] Enough transcript information received for persistent transcript')  
      this.closeSockets()
      const guidanceSection = document.querySelector('.trellus-guidance')
      guidanceSection.innerHTML = ''
      const style = 'text-align: center; font-style: oblique'
      const endTextNode = createNode('div', {style: style}, 'Great call! The transcript will persist until you close the window.') 
      guidanceSection.appendChild(endTextNode)

      let updateHeightDelta = 0
      if (!document.querySelector('#local-main').classList.contains(CLOSED)) {
        document.querySelector('#local-main').classList.add(CLOSED)
        updateHeightDelta += this._localBoxHeight
      }

      if (!document.querySelector('#objection-main').classList.contains(CLOSED)) {
        document.querySelector('#objection-main').classList.add(CLOSED)
        updateHeightDelta += this._suggestionBoxHeight
      }
      this._resize(this._updateWidth, this._updateHeight - updateHeightDelta)
    } else {
      console.log('[Trellus][Iframe] Not Enough transcript information received for persistent transcript - sending close iframe message')  
      this.stop()
    }
  }
}


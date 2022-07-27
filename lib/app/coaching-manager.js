import {
  BEHAVIORAL_PROMPTS,
  PROMPT_TYPES,
  PROMPTS_TO_ONLY_DEMO_MODE, SETTING_TO_ONLY_DEMO_MODE,
  SETTING_TO_TARGET_ELEMENT_MAP,
  SETTINGS,
} from '../../cfg/coach.js';
import {CLOSED, DISABLED, MIN_TO_SEC, SEC_TO_MS} from '../../cfg/const.js';
import {
  SUBSCRIBE_COACHING_ENDPOINT,
  SUBSCRIBE_TRANSCRIPT_ENDPOINT,
} from '../../cfg/endpoints.js';
import { generateColor } from '../graphics.js'
import { createLoggingWebsocketPromise } from '../network.js';
import {createNode, deleteAllChildren} from '../user-agent.js';
import { back } from '../core.js';
import { durationToString } from '../time-fns.js';


export class CoachingManager {
  constructor(sessionIdentifiers, demoMode=false, forceRealtimeHostname=null) {
    // track requests from extension to use demo mode or force realtime hosts
    this._demoMode = demoMode
    this._forceRealtimeHostname = forceRealtimeHostname

    // track state per conversation: websocket for coaching, and dom elements per party
    this.coachingSocket = null;

    // keep track of the current shown behavioral prompt
    this._activePrompt = null;
    this._activePromptIntervalId = null;
    this._promptPersistanceDuration = SEC_TO_MS * 5;

    // keep track of transcripts
    this.transcriptSocket = null
    this._transcripts = []
    this._partyCodeToColor = {}

    console.log('[Trellus][iframe] coming from start')
    window.parent.postMessage({"type": "adjustSize", "width": '500', "height": '500'}, '*'); //set it big initiall to avoid issues with initial dom creation
    this.createDOM()
    this.start(sessionIdentifiers)
  }

  /**
   * Create the coaching DOM attached to the specified shadow
   */
  async createDOM() {
    // dynamically add the settings
    this._addSettingsMenu()
    // settings start closed and are responsive to the button
    const settingsMenuNode = document.querySelector('#settingsMenu')
    settingsMenuNode.classList.add(CLOSED)
    document.querySelector('#settingsMenuIcon').addEventListener('click', (event)=> {
      settingsMenuNode.classList.toggle(CLOSED)
      this._resize()
    })

    // mic menu should be responsive
    document.querySelector('#moveMenu').addEventListener('click', () => {
      window.parent.postMessage({"type": "drag"}, '*');
      document.querySelector('.trellus-transcript-box').classList.add(DISABLED)
      document.querySelector('.trellus-main').classList.add(DISABLED)
      const coverElement = createNode('div', {'class': 'text-cover'})
      coverElement.textContent = 'Drag to location and click to exit dragging mode.'
      document.querySelector('#coach-root').prepend(coverElement)
      this._resize()
    })


    // mic menu should be responsive
    document.querySelector('#micMenu').addEventListener('click', () => {
      document.querySelector('.trellus-transcript-box').classList.toggle(CLOSED)
      console.log('[Trellus][iframe] coming from transcript')
      this._resize()
    })

    // the close menu should be responsive
    document.querySelector('.trellus-recording-close').addEventListener('click', () => {
      this.stop()
    })

    document.querySelector('#coach-root').style.visibility = 'visible'
    console.log('[Trellus][iframe] coming from dom creation')
    this._resize()
  }

  /**
   * Add settings to the target container
   */
  _addSettingsMenu() {
    const settingsMenu = document.querySelector('#settingsMenu')
    for (const [id, text] of Object.entries(SETTINGS)) {
      if (!this._demoMode && SETTING_TO_ONLY_DEMO_MODE[SETTINGS[id]]) {
        const onlyDemoModeDOMElement = document.querySelector(SETTING_TO_TARGET_ELEMENT_MAP[SETTINGS[id]])
        onlyDemoModeDOMElement.classList.add(CLOSED)
      } else {
        const settingElement = this._createSettingsOption(id, text, true)
        settingsMenu.appendChild(settingElement)
      }
    }
  }

  _createSettingsOption(settingId, settingText, checked) {
    const settingOption = createNode('div', {'class': 'trellus-menu-option', 'id': settingId})
    const checkbox = createNode('div', {'class': 'menu-checkbox'})
    if (checked) { checkbox.classList.add('checked') }
    const checkboxText = createNode('div', {'class': 'menu-text'}, settingText)

    checkbox.addEventListener('click', ()=> {
      checkbox.classList.toggle('checked')
      this._updateUI(settingId)
    })

    settingOption.appendChild(checkbox)
    settingOption.appendChild(checkboxText)

    return settingOption
  }

  /**
   * Start a coaching session with specified parameters
   * @param {Object} session
   */
  async start(session) {
    console.log(`[Trellus][iframe] Starting session ${session.session_id}`)
    if (this.coachingSocket || this.transcriptSocket)
      throw new Error(`Close existing connection before starting a new one`)
    this.coachingSocket = await this.connectCoachingSocket(session)
    this.transcriptSocket = await this.connectTranscriptSocket(session)
    this._partyToSummary = new Map();
  }

  /**
   * Stop the coaching session
   */
  stop() {
    if (this.coachingSocket) this.coachingSocket.close()
    if (this.transcriptSocket) this.transcriptSocket.close()
    this.coachingSocket = null
    this.transcriptSocket = null
    this._partyToSummary = null
    window.parent.postMessage({"type": "close"}, '*');
  }

  _resize() {
    const element = document.querySelector('#coach-root')
    const boundingBox = element.getBoundingClientRect()

    var style = element.currentStyle || window.getComputedStyle(element),
        width = boundingBox.width, // or use style.width
        marginWidth = parseFloat(style.marginLeft) + parseFloat(style.marginRight),
        height = boundingBox.height,
        marginHeight = parseFloat(style.marginTop) + parseFloat(style.marginBottom);

    window.parent.postMessage({"type": "adjustSize", "width": width + marginWidth, "height": height + marginHeight}, '*');
  }

  /**
   * Add transript to display
   * @param {String} data Transcript object to add
   */
  _updateTranscript (data) {
    const transcript = JSON.parse(data)
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

    // if this party is also the party of the last transcript, then append the text
    if ((back(this._transcripts) ?? {})['partyCode'] === partyCode)
      this._extendLastTranscript(text)
    else {
      // get the start time (relative to audio zero)
      const startTimeMs = transcript['start_time'] * SEC_TO_MS
      // create a new transcript
      this._addNewTranscript(text, partyCode, transcript['person_name'], startTimeMs)
    }
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

  async connectTranscriptSocket(session) {
    const queryParams = { 'session_id': session['session_id'] }
    const queryString = new URLSearchParams(queryParams).toString()
    const hostname = this._forceRealtimeHostname ?? session['realtime_hostname']
    const socketUrl = `wss://${hostname}/${SUBSCRIBE_TRANSCRIPT_ENDPOINT}?${queryString}`
    return await createLoggingWebsocketPromise('transcriptSocket', socketUrl, this._updateTranscript.bind(this))
  }

  /**
   * Create a WebSocket to receive coaching feedback
   * @param {Object} session
   */
  async connectCoachingSocket(session) {
    const queryParams = { 'session_id': session['session_id']}
    const queryString = new URLSearchParams(queryParams).toString()
    const hostname = this._forceRealtimeHostname ?? session['realtime_hostname']
    const socketUrl = `wss://${hostname}/${SUBSCRIBE_COACHING_ENDPOINT}?${queryString}`
    return await createLoggingWebsocketPromise('coachingSocket', socketUrl, this._updateCoachingData.bind(this))
  }

  /**
   * Updates objection data with new data
   * @param {Object} data objection data value
   */
  _updateObjection(data) {
    // cancel any existing objection callback
    if (this._dismissObjectionIntervalId != null)
      clearInterval(this._dismissObjectionIntervalId)

    // set objection text
    const objectionRoot = document.querySelector('#objection')
    objectionRoot.querySelector('#objection-header').textContent = `Objection: ${data['objection'].toLowerCase()}`
    const objectionContainer = objectionRoot.querySelector('#objection-container')
    deleteAllChildren(objectionContainer)
    const responses = Array.isArray(data['response']) ? data['response'] : [data['response']]
    for (const response of responses) {
      const content = objectionContainer.appendChild(createNode('div', {'class': 'flexRow', 'style': 'align-items: center'}))
      content.appendChild(createNode('img', {
        'src': '/images/circle-right-arrow.png',
        'style': 'width: 15px; height: 15px; margin-right: 5px;'
      }))
      content.appendChild(createNode('div', {style: 'width: 250px;'}, response))
    }


    // show the objection and hide the checklist
    const checklistRoot = document.querySelector('#checklist')
    checklistRoot.classList.add('closed')
    objectionRoot.classList.remove('closed')

    // add a callback dismissing the objection
    this._dismissObjectionIntervalId = setInterval(() => {
      checklistRoot.classList.remove('closed')
      objectionRoot.classList.add('closed')
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

    // show the prompt
    const behavioralColor = document.querySelector('#behavioral-color');
    const behavioralText = document.querySelector('#behavioral-text');

    behavioralColor.style.backgroundColor = "yellow";
    behavioralText.textContent = prompt;
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
    for (const partyData of data)
      this._updateActiveIntervals(partyData['party_code'], partyData['party_name'], partyData['intervals'])

    this._resize()
  }

  /**
   * Update intervals by party
   * @param {Number} partyCode Party identifier to update intervals for
   * @param {String} partyName Party name to display with intervals
   * @param {Array.<Object>} intervals intervals in the form {start, end}
   */
  _updateActiveIntervals (partyCode, partyName, intervals) {
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

    // draw intervals
    intervals.forEach(({start, end}) => {
      const style = `left: ${start * scale}px; width: ${(end - start) * scale}px`
      container.appendChild(createNode('div', {'style': style}))
    })
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

    // keep a reference to the payload container
    this._partyToSummary.set(partyCode, payloadContainer)
  }

  /**
   * Update coaching based on input
   * @param {object} coaching
   */
  _updateCoaching(coaching) {
    const prompt = coaching['prompt'].toUpperCase()
    if (!this._demoMode && PROMPTS_TO_ONLY_DEMO_MODE[prompt]) {
      console.log(`[Trellus][iframe] Demo mode only prompt received ${prompt}`)
      return
    }

    if (prompt === PROMPT_TYPES.SUMMARY_V2) {
      this._updateSummary(coaching['value'])
    } else if (prompt === PROMPT_TYPES.SEQUENCE) {
      this._updateChecklist(coaching['value'])
    } else if (prompt === PROMPT_TYPES.OBJECTION_RESPONSE) {
      this._updateObjection(coaching['value'])
    } else if (BEHAVIORAL_PROMPTS.includes(prompt)) {
      this._updateBehavioralSuggestion(prompt)
    } else {
      console.log(`[Trellus][iframe] Unknown prompt ${prompt}`)
    }
  }

  /**
   * Update real-time coaching based on `string` recieved over the websocket
   * @param {String} string
   * @returns
   */
  _updateCoachingData(string) {
    const data = JSON.parse(string)

    // case 1: coaching data is sent as an array
    if (Array.isArray(data))
      return data.forEach((x) => this._updateCoaching(x))

    // case 2: individual coaching data is sent
    this._updateCoaching(data)
  }

  _clearBehavioralSuggestion() {
    // show the prompt
    const behavioralColor = document.querySelector('#behavioral-color');
    const behavioralText = document.querySelector('#behavioral-text');

    behavioralColor.style.backgroundColor = "rgb(19,173,45)";
    behavioralText.textContent = 'Good!';
  }

  _updateUI (settingId) {
    if (Object.keys(SETTINGS).includes(settingId)) {
      const targetElement = document.querySelector(SETTING_TO_TARGET_ELEMENT_MAP[SETTINGS[settingId]])
      targetElement.classList.toggle(CLOSED)
      console.log('[Trellus][iframe] coming from UI update')
      this._resize()
    }
  }

}


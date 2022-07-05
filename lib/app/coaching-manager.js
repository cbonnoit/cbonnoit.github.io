import { MIN_TO_SEC, SEC_TO_MS } from "../../cfg/const.js"
import { SUBSCRIBE_COACHING_ENDPOINT } from "../../cfg/server.js"
import { createNode, deleteAllChildren } from "../user-agent.js"
import { websocketWithDynamicButton } from './helpers.js'

export class CoachingManager {
    /**
   * Create a coaching manager session
   * @param {Namer} namer 
   */
  constructor (namer) {
    this._namer = namer

    // keep track of the current shown prompt
    this._activePrompt = null
    this._activePromptIntervalId = null
    this._prompt_persistance_duration = SEC_TO_MS * 5

    // keep track of party summaries
    this._partyToSummary = new Map()
  }

  /**
   * Start the coaching session
   * @param {Object} sessionIdentifiers Identifiers for which transcript should be gotten
   */
  startSession (sessionIdentifiers) {
    // open websocket
    const params = {
      'conversation_id': sessionIdentifiers.conversationId,
      'party_id': sessionIdentifiers.partyId,
      'goal': sessionIdentifiers.goal,
    }
    const queryString = new URLSearchParams(params).toString()
    const url = `wss://${sessionIdentifiers['host']}/${SUBSCRIBE_COACHING_ENDPOINT}?${queryString}`
    this._socket = websocketWithDynamicButton(url, '#coachingStatus')
    this._socket.addEventListener('message', (event) => {
      const coachings = JSON.parse(event.data)
      coachings.forEach((x) => this.receiveData(x))
    })

    // the coached person should always be the first summary
    this._createPartySummary(sessionIdentifiers.partyId)
  }

  /**
   * Recieve data to display
   * @param {Object} data Recieved data
   */
  receiveData (data) {
    const prompt = data['prompt'].toUpperCase()
    if (prompt === 'SUMMARY')
      this._updateSummary(data)
    else if (['MONOLOG', 'TOO_FAST', 'CADENCE_FAST', 'NEXT_STEPS'].includes(prompt))
      this._updateBehavioral(data)
    // skip sequence
  }

  /**
   * 
   * @param {Object} data Summary data
   */
  _updateSummary (data) {
    // update active intervals
    for (const [partyId, intervals] of Object.entries(data['party_to_intervals']))
      this._updateActiveIntervals(parseInt(partyId), intervals)
    
    // todo: update events
  }

  /**
   * Update intervals by party
   * @param {Number} partyId Party identifier to update intervals for
   * @param {Array.<Object>} intervals intervals in the form {start, end}
   */
  _updateActiveIntervals (partyId, intervals) {
    // create the party summary
    if (!this._partyToSummary.has(partyId)) this._createPartySummary(partyId)

    // remove all previous lines
    const container = this._partyToSummary.get(partyId).querySelector('.summaryIntervalContainer')
    deleteAllChildren(container)

    // get scale converting between time (in sec) and pixel
    // TODO: dynamically adjust x axis
    const width = container.getBoundingClientRect().width
    const maxTime = 30 * MIN_TO_SEC
    const scale = width / maxTime

    // draw intervals
    intervals.forEach(({start, end}) => {
      const style = `left: ${start * scale}px; width: ${(end - start) * scale}px`
      container.appendChild(createNode('div', {'style': style}))
    })
  }

  /**
   * Create DOM elements for a party summary for `partyId`
   * @param {Number} partyId 
   */
  _createPartySummary (partyId) {
    // create layout
    const root = document.querySelector('#summaryRoot')
    const summary = root.appendChild(createNode('div', {'class': 'flexRow full summary'}))
    const name = summary.appendChild(createNode('div', {'class': 'flexRow full summaryName'}))
    const payloadContainer = summary.appendChild(createNode('div', {'class': 'flexRow full summaryRight', 'style': 'position: relative'}))
    payloadContainer.appendChild(createNode('div', {'class': 'flexRow full summaryTop summaryIntervalContainer'}))
    payloadContainer.appendChild(createNode('div', {'class': 'flexRow full summaryBottom summaryEventContainer'}))

    // keep a reference to the payload container
    this._partyToSummary.set(partyId, payloadContainer)

    // fill name when availible
    this._namer.getName(partyId).then((x) => name.textContent = x)
  }

  /**
   * 
   * @param {Object} data Prompt data
   */
  _updateBehavioral (data) {
    // if there is an active prompt and the new prompt is different, ignore the new prompt
    // the assumption here is that prompts will get refreshed as long as they are valid for
    // and the font end should avoid flickering between multiple simultaneously valid prompts
    if (this._activePrompt != null && this._activePrompt != data.prompt) return
      
    // clear any pending interruptions
    if (this._activePromptIntervalId != null)
      clearInterval(this._activePromptIntervalId)
    
    // show the prompt
    // TODO: log the prompt as shown
    const node = document.querySelector('#coachingPrompt')
    node.textContent = data.prompt
    this._activePrompt = data.prompt

    // automatically hide the prompt 
    this._activePromptIntervalId = setTimeout(() => {
      node.textContent = ''
      this._activePrompt = null
      this._activePromptIntervalId = null
    }, this._prompt_persistance_duration)
  }
}


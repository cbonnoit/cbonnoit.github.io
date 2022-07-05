import { SUBSCRIBE_TRANSCRIPT_ENDPOINT } from '../../cfg/server.js'
import { Namer } from './namer.js';
import { websocketWithDynamicButton } from './helpers.js'
import { back } from '../core.js'
import { durationToString } from '../time-fns.js'
import { createNode } from '../user-agent.js'
import { SEC_TO_MS } from '../../cfg/const.js';


export class TranscriptManager {
  /**
   * Create a transcript manager session
   * @param {Namer} namer 
   */
  constructor (namer) {
    this._namer = namer
    this._transcripts = []
  }

  /**
   * Start the transcript session
   * @param {Object} sessionIdentifiers Identifiers for which transcript should be gotten
   */
  startSession (sessionIdentifiers) {
    const queryString = new URLSearchParams({'conversation_id': sessionIdentifiers.conversationId}).toString()
    const url = `wss://${sessionIdentifiers['host']}/${SUBSCRIBE_TRANSCRIPT_ENDPOINT}?${queryString}`
    this._socket = websocketWithDynamicButton(url, '#transcriptStatus')
    this._socket.addEventListener('message', (event) => this.receiveData(JSON.parse(event.data)))
  }

  /**
   * Add transript to display
   * @param {Object} transcript Transcript object to add
   */
   receiveData (transcript) {
    // get party id and name
    const partyId = transcript['party_id']
    
    // get the text
    const text = transcript['text']
    
    // nothing to do if there is no text
    if (text === '') return

    // if this party is also the party of the last transcript, then append the text
    if ((back(this._transcripts) ?? {})['partyId'] == partyId)
      this.extendLastTranscript(text)
    else {
      // get the start time (relative to audio zero)
      const startTimeMs = transcript['start_time'] * SEC_TO_MS

      // create a new transcript
      this.addNewTranscript(text, partyId, startTimeMs)
    }
  }

  /**
   * Extend the last transcript with additional words
   * @param {String} text Text to extend transcript with
   */
  extendLastTranscript (text) {
    const transcript = back(this._transcripts)
    transcript.contentNode.textContent += ' ' + text
  }

  /**
   * Create new dom nodes associated with a new transcript
   * @param {String} text 
   * @param {Number} partyId
   * @param {Number} startTime Start time (in milliseconds)
   */
  addNewTranscript (text, partyId, startTime) {
    // check if currently scrolled to the bottom
    const root = document.querySelector('#transcriptRoot')
    const isScrolledToBottom = Math.abs((root.scrollTop + root.offsetHeight) - root.scrollHeight) < 5

    // create nodes
    const transcriptRoot = root.appendChild(createNode('div', {'class': 'flexRow transcript'}))
    transcriptRoot.appendChild(createNode('div', {'class': 'flexColumn transcriptTime'}, durationToString(startTime)))
    const nameContentNode = transcriptRoot.appendChild(createNode('div', {'class': 'transcriptNameContent'}))
    const nameNode = nameContentNode.appendChild(createNode('div', {'class': 'transcriptName'}))
    const contentNode = nameContentNode.appendChild(createNode('div', {'class': 'transcriptContent'}, text))
    
    // fill name when availible
    this._namer.getName(partyId).then((x) => nameNode.textContent = x)

    // store transcript information
    this._transcripts.push({'partyId': partyId, 'contentNode': contentNode})

    // keep scroll at bottom. note: if this is done immediately, layout may not be complete
    if (isScrolledToBottom) setTimeout(() => root.scrollTop = root.scrollHeight, 0)
  }
}
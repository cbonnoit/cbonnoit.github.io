import { CoachingManager } from './coaching-manager.js'
import { Namer } from './namer.js'
import { TranscriptManager } from './transcript-manager.js'

export class SessionManager {
  constructor () {
    // get session identifiers
    const sessionIdentifiers = getSessionIdentifiers()

    // create a persistent map between party id and name
    this._namer = new Namer(sessionIdentifiers)
    
    // declare new managers
    this._transcriptManager = new TranscriptManager(this._namer)
    this._coachingManager = new CoachingManager(this._namer)

    // start sessions once identifiers are known
    // TODO: is there a more robust way of getting ids?
    this._namer.getId(sessionIdentifiers['partyName']).then((x) => {
      sessionIdentifiers['partyId'] = x
      this._transcriptManager.startSession(sessionIdentifiers)
      this._coachingManager.startSession(sessionIdentifiers)
    })

  //   // dummy data
  //   setTimeout(() => {
  //     const data = {
  //       'prompt': 'summary', 
  //       'party_to_intervals': {
  //         0: [[0, 3], [10, 200], [600, 900]],
  //         1: [[30, 100], [300, 500]]
  //       }
  //     }
  //     this._coachingManager.receiveData(data)
  //   }, 500)
    // setTimeout(() => {
    //   this._transcriptManager.receiveData({'party_id': 0, 'words': [{'start_time': 0, 'end_time': 3, 'text': 'blah blah blah'}]})
    // }, 700)
  //   setTimeout(() => {
  //     this._transcriptManager.receiveData({'party_id': 1, 'words': [{'start_time': 30, 'end_time': 100, 'text': 'buz buzz'}]})
  //   }, 700)
  }
}

/**
 * Get session identifiers for what is being coached on
 * @param {Namer} namer Party namer
 * @returns 
 */
function getSessionIdentifiers (namer) {
  // extract parameters from url
  const params = new URL(document.location).searchParams
  const partyName = params.get('party_name') ?? 'You'
  
  // return parameter object
  return {
    host: params.get('host'),
    conversationId: params.get('conversation_id'),
    partyName: partyName,
    goal: params.get('goal') ?? 'discovery'
  }
}
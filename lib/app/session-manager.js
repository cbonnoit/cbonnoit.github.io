import { CoachingManager } from './coaching-manager.js'
import { Namer } from './namer.js'
import { TranscriptManager } from './transcript-manager.js'

export class SessionManager {
  constructor () {
    // create a persistent map between party id and name
    this._namer = new Namer()
    
    // declare new managers
    this._transcriptManager = new TranscriptManager(this._namer)
    this._coachingManager = new CoachingManager(this._namer)

    // start sessions once identifiers are known
    getSessionIdentifiers(this._namer).then((x) => {
      this._transcriptManager.startSession(x)
      this._coachingManager.startSession(x)
    })

  //   // dummy data
  //   setTimeout(() => {
  //     const data = {
  //       'prompt': 'summary', 
  //       'party_to_active_intervals': {
  //         0: [[0, 3000], [10000, 20000], [600000, 900000]],
  //         1: [[30000, 100000], [300000, 500000]]
  //       }
  //     }
  //     this._coachingManager.receiveData(data)
  //   }, 500)
  //   setTimeout(() => {
  //     this._transcriptManager.receiveData({'party_id': 0, 'words': [{'start_time': 0, 'end_time': 3000, 'text': 'blah blah blah'}]})
  //   }, 700)
  //   setTimeout(() => {
  //     this._transcriptManager.receiveData({'party_id': 1, 'words': [{'start_time': 30000, 'end_time': 100000, 'text': 'buz buzz'}]})
  //   }, 700)
  // }
}

/**
 * Get session identifiers for what is being coached on
 * @param {Namer} namer Party namer
 * @returns 
 */
async function getSessionIdentifiers (namer) {
  // extract parameters from url
  const params = new URL(document.location).searchParams
  const partyName = params.get('party_name') ?? 'You'
  
  // get id from name
  // TODO: is there a more robust way of getting ids?
  const partyId = await namer.getId(partyName)  
  
  // return parameter object
  return {
    host: params.get('host'),
    conversationId: params.get('conversation_id'),
    partyName: partyName,
    partyId: partyId,
    goal: params.get('goal') ?? 'discovery'
  }
}
import { PARTY_INFO_ENDPOINT } from '../../cfg/server.js'

export class Namer {
  /**
   * Interface to get names for parties in a conversation
  * @param {Object} sessionIdentifiers Identifiers for session 
   */
  constructor (sessionIdentifiers) {
    this._host = sessionIdentifiers['host']
    this._conversationId = sessionIdentifiers['conversationId']
    this._idToName = new Map([[0, 'Prospect'], [1, 'You']])
    this._nameToId = new Map(Array.from(this._idToName.entries()).map((x) => [x[1], x[0]]))
  }

  /**
   * Return a promise resolving to `id`'s name
   * @param {Number} partyId Party identifier
   */
  async getName (partyId) {
    if (!this._idToName.has(partyId))
      await this.updateNames()
    return this._idToName.get(partyId) ?? 'Unknown'
  }

  /**
   * Return a promise resolving to `id`'s name
   * @param {String} partyName Party name
   */
  async getId (partyName) {
    if (!this._nameToId.has(partyName))
      await this.updateNames()
    return this._nameToId.get(partyName) ?? 0
  }

  /**
   * Return a promise resolving when names have been updated with latest availible 
   * information for the conversation
   */
  async updateNames () {
    const queryString = new URLSearchParams({conversation_id: this._conversationId}).toString()
    const url = `https://${this._host}/${PARTY_INFO_ENDPOINT}?${queryString}`
    const known = await fetch(url).then((x) => x.json())
    for (const row of known) {
      this._idToName.set(row['party_id'], row['party_name'])
      this._nameToId.set(row['party_name'], row['party_id'])
    }
  }
}
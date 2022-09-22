import { MS_TO_MICRO } from "../../cfg/const.js"
import { GET_SESSION_DATA_ENDPOINT, GET_USER_TRIGGERS_ENDPOINT, LIST_USER_SESSIONS_ENDPOINT, SAVE_USER_TRIGGERS_ENDPOINT, SERVICE_HOSTNAME, UPDATE_DISPLAY_ENDPOINT } from "../../cfg/endpoints.js"
import { simpleFetchAndCheck } from "../network.js"

/**
 * Return triggers and formulas for a user
 * @param {string} apiKey
 * @param {string} forceServiceHostname
 */
 export async function getUserTriggers (apiKey, forceServiceHostname=null) {
  // make the request
  const hostname = forceServiceHostname ?? SERVICE_HOSTNAME
  const url = `https://${hostname}/${GET_USER_TRIGGERS_ENDPOINT}`
  const result = await simpleFetchAndCheck(url, {'api_key': apiKey}, false)

  // store the response
  return [result['triggers'], result['trigger_formulas']]
}

export async function saveUserTriggers (triggers, formulas, apiKey, forceServiceHostname=null) {
  const hostname = forceServiceHostname ?? SERVICE_HOSTNAME
  const url = `https://${hostname}/${SAVE_USER_TRIGGERS_ENDPOINT}`
  const parameters = {'triggers': triggers, 'trigger_formulas': formulas, 'api_key': apiKey}
  return await simpleFetchAndCheck(url, parameters, true)
}

/**
 * Return conversations from the `list-conversations` endpoint
 * @param {String} apiKey 
 * @param {Number|null} maxStartMicroSec
 * @param {String|null} forceServiceHostname 
 */
export async function getListUserSessions (apiKey, maxStartMicroSec=null, forceServiceHostname=null) {
  const hostname = forceServiceHostname ?? SERVICE_HOSTNAME
  const url = `https://${hostname}/${LIST_USER_SESSIONS_ENDPOINT}`
  const parameters = {'api_key': apiKey}
  if (maxStartMicroSec != null) parameters['max_start'] = maxStartMicroSec
  return await simpleFetchAndCheck(url, parameters, false)
}

/**
 * Get session data for `sessionId`
 * @param {String} apiKey 
 * @param {String} sessionId 
 * @param {String|null} forceServiceHostname
 */
export async function getSessionData (apiKey, sessionId, forceServiceHostname=null) {
  const hostname = forceServiceHostname ?? SERVICE_HOSTNAME
  const url = `https://${hostname}/${GET_SESSION_DATA_ENDPOINT}`
  const parameters = {'api_key': apiKey, 'session_id': sessionId}
  return await simpleFetchAndCheck(url, parameters, false)
}

/**
 * 
 * @param {String} apiKey 
 * @param {String} clientId 
 * @param {Number} promptId 
 * @param {String} promptType 
 * @param {String|null} promptText 
 * @param {Date} start 
 * @param {Date|null} end 
 * @param {String|null} forceServiceHostname
 */
export async function updateDisplay(apiKey, clientId, promptId, promptType, promptText, start, end=null, forceServiceHostname=null) {
  const hostname = forceServiceHostname ?? SERVICE_HOSTNAME
  const url = `https://${hostname}/${UPDATE_DISPLAY_ENDPOINT}`
  const display = {'client_id': clientId, 'prompt_id': promptId, 'prompt_type': promptType,
    'prompt_text': promptText, 'start': start.getTime() * MS_TO_MICRO, 
    'end': end == null ? null : end.getTime() * MS_TO_MICRO}
  const parameters = {'api_key': apiKey, 'display': display}
  return await simpleFetchAndCheck(url, parameters, true)
}
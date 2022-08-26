import { GET_USER_TRIGGERS_ENDPOINT, SAVE_USER_TRIGGERS_ENDPOINT, SERVICE_HOSTNAME } from "../../cfg/endpoints.js"
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
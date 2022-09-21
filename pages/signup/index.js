import { SERVICE_HOSTNAME, SIGNUP_USER_ENDPOINT, EXTENSION_ID } from "../../cfg/endpoints.js";
import { MESSAGE_TYPES } from "../../cfg/messages.js";
import { logInfo } from "../../lib/core.js";
import { simpleFetchAndCheck } from "../../lib/network.js";

let _extensionId = EXTENSION_ID
let _forceServicesHostname = null
const _LOG_SCOPE = `[Trellus][External]`

// add envent listener for click
document.querySelector('#submit').addEventListener('click', () => signup())

// start listening for extension specific information
window.addEventListener("message", receiveMessage)
function receiveMessage (event) {
    const message = event.data
    logInfo(`${_LOG_SCOPE} Receiving message of type ${message['type']}`)
    switch (message['type']) {
      case MESSAGE_TYPES.APP_TO_EXTERNAL_SET_EXTENSION_INFO:
        _extensionId = message['extensionId']
        _forceServicesHostname = message['forceServicesHostname']
        break
      case MESSAGE_TYPES.APP_TO_EXTERNAL_CHECK_IS_LOADED:
        window.postMessage({'type': MESSAGE_TYPES.EXTERNAL_TO_APP_IS_LOADED})
        break
      default:
        logInfo(`${_LOG_SCOPE} Skipping message of type ${message['type']}`)
        break
    }
}
window.postMessage({'type': MESSAGE_TYPES.EXTERNAL_TO_APP_IS_LOADED})

/**
 * Read signup information from the form and send the associated request
 */
 async function signup () {
    // make the request
    const fields = Array.from(document.querySelectorAll('div[data-field]'))
    const bodyObject = Object.fromEntries(fields.map((x) => [x.getAttribute('data-field'), x.textContent]))
  
    const password = document.querySelector('#password').value
    // mark the request as submitting
    const status = document.querySelector('#status')
    status.textContent = 'Submitted...'
  
    // signup the user
    await signupUser(bodyObject['email'], bodyObject['name'], bodyObject['team'], password)
}
  
/**
 * Sign up the user and store the resulting api key in local storage
 * @param {string} email
 * @param {string} name
 * @param {string} team
 * @param {string|null} password
 */
export async function signupUser (email, name, team, password) {
    // make the request
    logInfo(`${_LOG_SCOPE} Forming signup user request`)
    const hostname = _forceServicesHostname ?? SERVICE_HOSTNAME
    const url = `https://${hostname}/${SIGNUP_USER_ENDPOINT}`
    const parameters = {'email': email, 'name': name, 'team': team, 'password': password}
    let result
    try {
      result = await simpleFetchAndCheck(url, parameters, true)
    } catch (e) {
      logInfo(`${_LOG_SCOPE} Invalid user signup response`)
      const status = document.querySelector('#status')
      status.textContent = 'Not authorized'
    }
  
    logInfo(`${_LOG_SCOPE} Got valid user signup response`)
    chrome.runtime.sendMessage(_extensionId, {
        'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_API_KEY, 
        'apiKey': result['api_key'], 
    }, {}, (result) => {
      // update the status. 
      // note: it would be cleaner to await this as a promise instead of using a callback
      //  but that seemed not to work for me
      const status = document.querySelector('#status')
      if (result == null)
        status.textContent = 'Service worker did not acknowledge'
      else if (result === true || result['success'] === true)
        status.textContent = 'Success! You can close this page.'
      else if (result['error'] != null)
        status.textContent = `Error: ${result['error']}`
      else if (result['success'] === false)
        status.textContent = 'Round trip failed'
      else
        status.textContent = 'Unknown error'
    });
}
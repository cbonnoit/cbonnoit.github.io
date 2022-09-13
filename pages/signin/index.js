import { SERVICE_HOSTNAME, SIGNIN_USER_ENDPOINT, EXTENSION_ID } from "../../cfg/endpoints.js";
import { MESSAGE_TYPES } from "../../cfg/messages.js";
import { logInfo } from "../../lib/core.js";
import { simpleFetchAndCheck } from "../../lib/network.js";

let _extensionId = EXTENSION_ID
let _forceServicesHostname = null
const _LOG_SCOPE = '[Trellus][External signin]'

// start listening for extension specific information
window.addEventListener("message", receiveMessage, false)

// add envent listener for click
document.querySelector('#submit').addEventListener('click', () => signin())
document.querySelector('#signup').addEventListener('click', () => window.location.pathname='pages/signup')

function receiveMessage (event) {
    const message = event.data
    const messageType = message['type']
    if (messageType === MESSAGE_TYPES.APP_TO_EXTERNAL_SET_EXTENSION_INFO) {
        _extensionId = message['extensionId']
        _forceServicesHostname = message['forceServicesHostname']
    } else {
      logInfo(`${_LOG_SCOPE} Unknown message type ${message['type']}`)
    }
}

/**
 * Read signup information from the form and send the associated request
 */
 async function signin () {
    // make the request
    const fields = Array.from(document.querySelectorAll('div[data-field]'))
    const bodyObject = Object.fromEntries(fields.map((x) => [x.getAttribute('data-field'), x.textContent]))
  
    const password = document.querySelector('#password').value
    // mark the request as submitting
    const status = document.querySelector('#status')
    status.textContent = 'Submitted...'
  
    // signup the user, then update the status
    await signInUser(bodyObject['email'], password).then((result) =>
      status.textContent = result ? 'Success!' : 'Redirecting to signup').catch((e) =>
      status.textContent = e)
}
  
/**
 * Sign up the user and store the resulting api key in local storage
 * @param {string} email
 * @param {string|null} password
 */
export async function signInUser (email, password) {
    // make the request
    console.log('Forming signup user request')
    const hostname = _forceServicesHostname ?? SERVICE_HOSTNAME
    const url = `https://${hostname}/${SIGNIN_USER_ENDPOINT}`
    const parameters = {'email': email, 'password': password}
    let result
    try {
      result = await simpleFetchAndCheck(url, parameters, true)
    } catch {
      // or redirect to signup if this fails
      debugger;
      window.location.pathname='pages/signup'
      return false
    }
  
    console.log('Got user signup response')
    chrome.runtime.sendMessage(_extensionId, {
        'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_API_KEY, 
        'apiKey': result['api_key'],
    }, console.log);
    return true
}
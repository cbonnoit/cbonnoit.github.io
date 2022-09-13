import { SERVICE_HOSTNAME, SIGNUP_USER_ENDPOINT, EXTENSION_ID } from "../../cfg/endpoints.js";
import { MESSAGE_TYPES } from "../../cfg/messages.js";
import { logInfo } from "../../lib/core.js";
import { simpleFetchAndCheck } from "../../lib/network.js";

let _extensionId = EXTENSION_ID
let _forceServicesHostname = null

// start listening for extension specific information
window.addEventListener("message", receiveMessage, false)

// add envent listener for click
document.querySelector('#submit').addEventListener('click', () => signup())

function receiveMessage (event) {
    const message = event.data
    const messageType = message['type']
    // todo: remove deprecated mesage type
    if (messageType === MESSAGE_TYPES.APP_TO_EXTERNAL_SET_EXTENSION_INFO) {
        _extensionId = message['extensionId']
        _forceServicesHostname = message['forceServicesHostname']
    } else {
      logInfo(`Unknown message type ${messageType}`)
    }
}

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
  
    // signup the user, then update the status
    await signupUser(bodyObject['email'], bodyObject['name'], bodyObject['team'], password).then(() =>
      status.textContent = 'Success!').catch((e) =>
      status.textContent = e)
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
    console.log('Forming signup user request')
    const hostname = _forceServicesHostname ?? SERVICE_HOSTNAME
    const url = `https://${hostname}/${SIGNUP_USER_ENDPOINT}`
    const parameters = {'email': email, 'name': name, 'team': team, 'password': password}
    const result = await simpleFetchAndCheck(url, parameters, true)
  
    console.log('Got user signup response')
    chrome.runtime.sendMessage(_extensionId, {
        'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_API_KEY, 
        'apiKey': result['api_key'],
    }, console.log);
}
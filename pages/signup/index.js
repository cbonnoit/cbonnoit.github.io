import {simpleFetchAndCheck} from "../../lib/network.js";
import {SERVICE_HOSTNAME, SIGNUP_USER_ENDPOINT, EXTENSION_ID} from "../../cfg/endpoints.js";

var _extension_id = EXTENSION_ID
var _forceServiceHostname = null

window.addEventListener("load", () => onPageLoad())

function onPageLoad () {
    window.addEventListener("message", receiveMessage, false);
}

function receiveMessage (event) {
    const data = event.data
    const dataType = data['type']
    if (dataType === 'TRELLUS_EXTENSION_ID') {
        _extension_id = data['detail']
        _forceServiceHostname = data['forceServiceHostname']
        const node = document.querySelector('#submit')
        node.addEventListener('click', () => signup())
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
    const hostname = _forceServiceHostname ?? SERVICE_HOSTNAME
    const url = `https://${hostname}/${SIGNUP_USER_ENDPOINT}`
    const parameters = {'email': email, 'name': name, 'team': team, 'password': password}
    const result = await simpleFetchAndCheck(url, parameters, true)
  
    chrome.runtime.sendMessage(_extension_id, {type: 'API_KEY_UPDATE', apiKey: result['api_key']},
    function(response) {
        if (!response.success) {
            console.log('Error in signup')
        }
    });
}
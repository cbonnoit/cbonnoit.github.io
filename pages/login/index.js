import { SERVICE_HOSTNAME, SIGNIN_USER_ENDPOINT, EXTENSION_ID } from "../../cfg/endpoints.js";
import { MESSAGE_TYPES } from "../../cfg/messages.js";
import { logInfo } from "../../lib/core.js";
import { simpleFetchAndCheck } from "../../lib/network.js";
// import jwt_decode from '../../lib/jwt-decode.js'

let _extensionId = EXTENSION_ID
let _forceServicesHostname = null
const _LOG_SCOPE = '[Trellus][External signin]'

let _is_signin_screen = true
add_sign_in_form()

// add envent listener for click
// document.querySelector('#submit').addEventListener('click', () => signin())
document.querySelector('#sign-in-type-button').addEventListener('click', () => updateLogin())

function updateLogin () {
  //clear current form
  document.querySelector('#form').innerHTML = ''
  if (_is_signin_screen) {
    // update to sign up screen
    add_sign_in_form()
    document.querySelector('#sign-in-type-text').textContent = 'Have an account?'
    document.querySelector('#sign-in-type-button').textContent = 'Sign in'
  } else {
    add_signup_form_up()
    document.querySelector('#sign-in-type-text').textContent = 'No account?'
    document.querySelector('#sign-in-type-button').textContent = 'Sign up'
  }

  _is_signin_screen = !_is_signin_screen
}
document.querySelector('#signup').addEventListener('click', () => window.location.pathname='pages/signup')

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
 async function signin () {
    // make the request
    const fields = Array.from(document.querySelectorAll('div[data-field]'))
    const bodyObject = Object.fromEntries(fields.map((x) => [x.getAttribute('data-field'), x.textContent]))
  
    const password = document.querySelector('#password').value
    // mark the request as submitting
    const status = document.querySelector('#status')
    status.textContent = 'Submitted...'
  
    // signup the user
    await signInUser(bodyObject['email'], password)
}
  
/**
 * Sign up the user and store the resulting api key in local storage
 * @param {string} email
 * @param {string|null} password
 */
export async function signInUser (email, password) {
    // make the request
    logInfo(`${_LOG_SCOPE} Forming signup user request`)
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
  
    logInfo(`${_LOG_SCOPE} Got user signup response`)
    chrome.runtime.sendMessage(_extensionId, {
        'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_API_KEY, 
        'apiKey': result['api_key'],
    }, {}, (result) => {
      logInfo(`${_LOG_SCOPE} Got service worker response ${result}`)
      const status = document.querySelector('#status')
      if (result == null)
        status.textContent = 'Service worker did not acknowledge'
      else if (result === true || result['success'] === true)
        window.location.href = '/pages/live/index.html'
      else if (result['success'] === false)
        status.textContent = 'Round trip failed'
      else
        status.textContent = 'Unknown error'
    });
}



window.handleGoogleCredentialResponse =  function handleGoogleCredentialResponse(response) {
  console.log('right here')
  // const responsePayload = jwt_decode(response.credential);
  // console.log('Full Name: ' + responsePayload.name);
  // console.log("Email: " + responsePayload.email);
}
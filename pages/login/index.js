import { SERVICE_HOSTNAME, SIGNIN_USER_ENDPOINT, EXTENSION_ID, GOOGLE_LOGIN, PASSWORD_LOGIN, SIGNUP_USER_ENDPOINT } from "../../cfg/endpoints.js";
import { MESSAGE_TYPES } from "../../cfg/messages.js";
import { createNode, getWidth } from "../../lib/user-agent.js";
import { logInfo } from "../../lib/core.js";
import { simpleFetchAndCheck } from "../../lib/network.js";

let _extensionId = EXTENSION_ID
let _forceServicesHostname = null
const _LOG_SCOPE = '[Trellus][External signin]'

let _is_signin_screen = true
add_signin_form()

// add envent listener for click
document.querySelector('#sign-in-type-button').addEventListener('click', () => updateLogin())

function add_signin_form() {

  const formDiv = document.querySelector('#form')
  formDiv.innerHTML = ''

  const emailInput = createNode("input", {"type": "email", "id": "email", "placeholder": "Email", "class": "inputField", "contenteditable": true, "data-field": "email"})
  const passwordInput = createNode("input", {"type": "password", "id": "password", "style": "margin-top: 10px;", "placeholder": "Password", "class": "inputField", "contenteditable": true, "data-field": "password"})

  const signinbutton = createNode("div", {"class": "button ctaPrimary", "style": "margin-top: 10px", "id": "sign-in-button"}, "Sign in")
  
  formDiv.appendChild(emailInput)
  formDiv.appendChild(passwordInput)
  formDiv.appendChild(signinbutton)

  signinbutton.addEventListener('click', () => signInUser())
}

function add_signup_form() {
  const formDiv = document.querySelector('#form')
  formDiv.innerHTML = ''

  const nameInput = createNode("input", {"type": "name", "id": "name", "placeholder": "Name", "class": "inputField", "contenteditable": true, "data-field": "name"})
  const emailInput = createNode("input", {"type": "email", "id": "email", "style": "margin-top: 10px;", "placeholder": "Email", "class": "inputField", "contenteditable": true, "data-field": "email"})
  const passwordInput = createNode("input", {"type": "password", "id": "password", "style": "margin-top: 10px;", "placeholder": "Password", "class": "inputField", "contenteditable": true, "data-field": "password"})


  const signupbutton = createNode("div", {"class": "button ctaPrimary", "style": "margin-top: 10px", "id": "sign-in-button"}, "Create account")
  
  formDiv.appendChild(nameInput)
  formDiv.appendChild(emailInput)
  formDiv.appendChild(passwordInput)
  formDiv.appendChild(signupbutton)

  signupbutton.addEventListener('click', () => signupUser())
}

function updateLogin () {
  //clear current form
  if (_is_signin_screen) {
    // update to sign up screen
    add_signup_form()
    document.querySelector('#sign-in-type-text').textContent = 'Have an account?'
    document.querySelector('#sign-in-type-button').textContent = 'Sign in'
  } else {
    add_signin_form()
    document.querySelector('#sign-in-type-text').textContent = 'No account?'
    document.querySelector('#sign-in-type-button').textContent = 'Sign up'
  }

  _is_signin_screen = !_is_signin_screen
}

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

function addBanner(bannerText, isError) {
  const bannerBox = document.querySelector('#banner-box')
  bannerBox.textContent = bannerText
  bannerBox.style.display = 'flex';
  bannerBox.style.backgroundColor = isError ? 'red' : 'green'
  setTimeout(() => bannerBox.style.display = 'none', 2000)
}


// TODO - this is a hacky fix so we don't have to update the extension 
// we should be passing a url in the parameters upon redirect to the login page so we know
// if you came from the extension widget or upon installing the extension 
function onSuccessRedirectBasedOfPageWidth() {
  const pageWidth = getWidth()
  if (pageWidth < 350) { 
    // leave some margin (we officially set the coaching width to 300 px)
    window.location.href = '/pages/live/index.html'
  } else {
    window.location.href = '/pages/start/index.html'
  }
}

function setApiKey(apiKey) {
  console.log(chrome)
  chrome.runtime.sendMessage(_extensionId, {
    'type': MESSAGE_TYPES.EXTERNAL_TO_BACKGROUND_SET_API_KEY, 
    'apiKey': apiKey, 
}, {}, (result) => {
  // update the status. 
  // note: it would be cleaner to await this as a promise instead of using a callback
  //  but that seemed not to work for me
  if (result == null)
    addBanner('Service worker did not acknowledge', true)
  else if (result === true || result['success'] === true)
    onSuccessRedirectBasedOfPageWidth()
  else if (result['error'] != null)
    addBanner(`Error: ${result['error']}`)
  else if (result['success'] === false)
    addBanner('Round trip failed', true)
  else
    addBanner('Unknown error', true)
});
}
  
/**
 * Sign up the user and store the resulting api key in local storage
 * @param {string} email
 * @param {string|null} password
 */
export async function signInUser () {
    // make the request
    const email = document.querySelector('#email').value
    const password = document.querySelector('#password').value
    // mark the request as submitting
    const status = document.querySelector('#status')
    addBanner('Signing in...', false)

    // make the request
    logInfo(`${_LOG_SCOPE} Forming signup user request`)
    const hostname = _forceServicesHostname ?? SERVICE_HOSTNAME
    const url = `https://${hostname}/${SIGNIN_USER_ENDPOINT}`
    const parameters = {'email': email, 'password': password}
    let result
    try {
      result = await simpleFetchAndCheck(url, parameters, true)
    } catch {
      logInfo(`${_LOG_SCOPE} Invalid user signin response`)
      addBanner('Not authorized', true)
      return false
    }
  
    logInfo(`${_LOG_SCOPE} Got user signin response from password sign in`)
    setApiKey(result["api_key"])
}


/**
* Sign up the user and store the resulting api key in local storage
* @param {string|null} password
*/
export async function signupUser () {
  // make the request
  const email = document.querySelector('#email').value
  const name = document.querySelector('#name').value
  const password = document.querySelector('#password').value
  // mark the request as submitting
  const status = document.querySelector('#status')
  addBanner('Signing up...', false)

  // make the request
  logInfo(`${_LOG_SCOPE} Forming signup user request`)
  const hostname = _forceServicesHostname ?? SERVICE_HOSTNAME
  const url = `https://${hostname}/${SIGNUP_USER_ENDPOINT}`
  const parameters = {'email': email, 'name': name, 'password': password, 'type': PASSWORD_LOGIN}
  let result
  try {
    result = await simpleFetchAndCheck(url, parameters, true)
  } catch (e) {
    logInfo(`${_LOG_SCOPE} Invalid user signup response`)
    addBanner('Not authorized', true)
    return false
  }

  logInfo(`${_LOG_SCOPE} Got valid user signup response from passoword signup`)
  setApiKey(result["api_key"])
}


window.handleGoogleCredentialResponse =  async function handleGoogleCredentialResponse(response) {
  // make the request
  logInfo(`${_LOG_SCOPE} Forming signup user request`)
  const hostname = _forceServicesHostname ?? SERVICE_HOSTNAME
  const url = `https://${hostname}/${SIGNUP_USER_ENDPOINT}`
  const parameters = {'type': GOOGLE_LOGIN, 'credential': response['credential']}
  let result
  try {
    result = await simpleFetchAndCheck(url, parameters, true)
  } catch (e) {
    logInfo(`${_LOG_SCOPE} Invalid user signup response`)
    addBanner('Not authorized', true)
    return false
  }

  logInfo(`${_LOG_SCOPE} Got valid user signup response from google oauth`)
  setApiKey(result["api_key"])
  }
// production services hostname
export const SERVICE_HOSTNAME = 'api.trellus.ai'

// realtime endpoints
export const SUBSCRIBE_CLIENT_ENDPOINT = 'subscribe-client';

// services endpoints
export const SIGNUP_USER_ENDPOINT = 'signup-user'
export const GET_USER_TRIGGERS_ENDPOINT = 'get-user-triggers'
export const SAVE_USER_TRIGGERS_ENDPOINT = 'save-user-triggers'

// extension ID
export const EXTENSION_ID = "enhpjjojmnlnaokmppkkifgaonfojigl"


// message types for communicating between application pages and extension
export const APPLICATION_PAGE_MESSAGE_TYPES = Object.freeze({
  // from extension to app page
  EXTENSION_ID: 'EXTENSION_ID',
  START_COACHING: 'START_COACHING',

  // from app page to extension
  SET_REALTIME_IS_ENABLED: 'SET_REALTIME_IS_ENABLED',
  API_KEY_UPDATE: 'API_KEY_UPDATE',
})
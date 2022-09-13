// naming convention: source_to_destination_...
// DIALER = src/ext/dialer-content
// INJECTED = src/ext/dialer-injected
// APP = src/ext/app-content
// BACKGROUND = src/ext/background
// EXTERNAL = external page app.trellus.ai
export const MESSAGE_TYPES = Object.freeze({
  // from app content script to(external) app page
  APP_TO_EXTERNAL_CHECK_IS_LOADED: 'APP_TO_EXTERNAL_CHECK_IS_LOADED',
  APP_TO_EXTERNAL_SET_EXTENSION_INFO: 'APP_TO_EXTERNAL_SET_EXTENSION_INFO',
  APP_TO_EXTERNAL_START_COACHING: 'APP_TO_EXTERNAL_START_COACHING',
  APP_TO_EXTERNAL_END_COACHING: 'APP_TO_EXTERNAL_END_COACHING',

  // from external app page to app content script
  EXTERNAL_TO_APP_IS_LOADED: 'EXTERNAL_TO_APP_IS_LOADED',

  // from (external) page to background
  EXTERNAL_TO_BACKGROUND_SET_REALTIME_ENABLED: 'EXTERNAL_TO_BACKGROUND_SET_REALTIME_ENABLED',
  EXTERNAL_TO_BACKGROUND_SET_API_KEY: 'EXTERNAL_TO_BACKGROUND_SET_API_KEY',
})
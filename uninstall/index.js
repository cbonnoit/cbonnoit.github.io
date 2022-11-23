import { SERVICE_HOSTNAME, SUBMIT_TRACKER } from "../../cfg/endpoints.js";
import { logInfo } from "../../lib/core.js";
import { simpleFetchAndCheck } from "../../lib/network.js";
import { UNINSTALL_FORM, TRACKER_TYPE } from "../cfg/sources.js";

let _forceServicesHostname = null
const _LOG_SCOPE = '[Trellus][External Uninstall]'

const urlParams = new URLSearchParams(window.location.search);
const apiKey = urlParams.get('apiKey')

if (apiKey !== null) {
    submitTrackerInformation(apiKey).then(() => redirectToUninstallForm())
} else {
    redirectToUninstallForm()
}

async function submitTrackerInformation(apiKey) {
    // make the request
    logInfo(`${_LOG_SCOPE} Submitting tracking information`)
    const hostname = _forceServicesHostname ?? SERVICE_HOSTNAME
    const url = `https://${hostname}/${SUBMIT_TRACKER}`
    const parameters = {'api_key': apiKey, 'tracker_type': TRACKER_TYPE.UNINSTALL, base_url: window.location.hostname}
    let result
    try {
      result = await simpleFetchAndCheck(url, parameters, true)
    } catch {
      logInfo(`${_LOG_SCOPE} Tracking information not properly submitted`)
    }
  }

function redirectToUninstallForm() {
    // similar behavior as an HTTP redirect
    window.location.replace(UNINSTALL_FORM);    
}


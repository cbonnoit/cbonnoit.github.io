import {CoachingManager} from "../../lib/app/coaching-manager.js";
import {DISABLED} from "../../cfg/const.js";

function onPageLoad () {
    window.addEventListener("message", receiveMessage, false);
    console.log('requesting session information')
    window.parent.postMessage({"type": "getSessionInformation"}, '*');
}

function receiveMessage (event) {
    const data = event.data
    const procedure = data['type']
    if (procedure === 'sessionInformation') {
        const session = data['session']
        window._coachingSession = new CoachingManager(session, data['demoMode'], data['consolidatedEndpoint'])
    } else if (procedure === 'stopDrag') {
        document.querySelector('.trellus-transcript-box').classList.remove(DISABLED)
        document.querySelector('.trellus-main').classList.remove(DISABLED)
        const textCover = document.querySelector('.text-cover')
        if (textCover) textCover.remove()
    } else if (procedure === 'callEnded') {
        window._coachingSession.callEnded()
    }
}

window.addEventListener("load", () => onPageLoad())


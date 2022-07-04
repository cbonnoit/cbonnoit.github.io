import { SessionManager } from "../../lib/app/session-manager.js"


function onPageLoad () {
    window._session = new SessionManager()
}


window.addEventListener("load", () => onPageLoad())

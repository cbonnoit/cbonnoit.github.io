import { REFERRER_URL_KEY, REFERRER_STORAGE_KEY } from "../cfg/sources.js";

const searchParams = new URLSearchParams(window.location.search)
if (searchParams.has(REFERRER_URL_KEY))
    window.localStorage.setItem(REFERRER_STORAGE_KEY, searchParams.get(REFERRER_URL_KEY))

// similar behavior as an HTTP redirect
window.location.replace("https://chrome.google.com/webstore/detail/trellus/enhpjjojmnlnaokmppkkifgaonfojigl");
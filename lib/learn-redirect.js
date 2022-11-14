import { ATTRIBUTION_CHANNEL_TO_LEARN_LINK_REGEX, ATTRIBUTION_CHANNEL_STORAGE_KEY, LEARN_LINK } from "../cfg/sources.js";

for (const [attributionChannel, regex] of Object.entries( ATTRIBUTION_CHANNEL_TO_LEARN_LINK_REGEX )) {
    if (regex.test(window.location)) {
        window.localStorage.setItem(ATTRIBUTION_CHANNEL_STORAGE_KEY, attributionChannel)
        break
    }
  }

// similar behavior as an HTTP redirect
window.location.replace(LEARN_LINK);
import {ATTRIBUTION_CHANNEL_STORAGE_KEY, ATTRIBUTION_CHANNEL, INSTALL_LINK } from "../cfg/sources.js";
window.localStorage.setItem(ATTRIBUTION_CHANNEL_STORAGE_KEY, ATTRIBUTION_CHANNEL.CALLBLITZ)
  
document.getElementById('addToChrome').addEventListener('click', () => {
    window.location.href = INSTALL_LINK;
})
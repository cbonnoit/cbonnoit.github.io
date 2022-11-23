export const ATTRIBUTION_CHANNEL = Object.freeze({
    COLD_EMAIL: 'COLD_EMAIL',
    LINKEDIN_DM: 'LINKEDIN_DM', 
    LINKEDIN_POST: 'LINKEDIN_POST', 
    TRELLUS_WEBSITE: 'TRELLUS_WEBSITE',
    MANUAL: 'MANUAL'
  });

export const TRACKER_TYPE = Object.freeze({
    INSTALL: 'INSTALL',
    CLICK: 'CLICK',
    UNINSTALL: 'UNINSTALL'
});

export const ATTRIBUTION_CHANNEL_TO_LEARN_LINK_REGEX = Object.freeze({
    [ATTRIBUTION_CHANNEL.COLD_EMAIL]: new RegExp('learn-now', 'i'),
    [ATTRIBUTION_CHANNEL.LINKEDIN_DM]: new RegExp('learn-more', 'i'),
    [ATTRIBUTION_CHANNEL.LINKEDIN_POST]: new RegExp('learn-about', 'i'),
});

export const ATTRIBUTION_CHANNEL_TO_INSTALL_LINK_REGEX = Object.freeze({
    [ATTRIBUTION_CHANNEL.COLD_EMAIL]: new RegExp('try-now', 'i'),
    [ATTRIBUTION_CHANNEL.LINKEDIN_DM]: new RegExp('get-trellus', 'i'),
    [ATTRIBUTION_CHANNEL.LINKEDIN_POST]: new RegExp('try-trellus', 'i'),
    [ATTRIBUTION_CHANNEL.TRELLUS_WEBSITE]: new RegExp('get-started', 'i'),
    [ATTRIBUTION_CHANNEL.MANUAL]: new RegExp('install-now', 'i')
  });


export const ATTRIBUTION_CHANNEL_STORAGE_KEY = 'attribution_channel' // used in local storage as well as the param to send to backend
export const REFERRER_STORAGE_KEY = 'referrer' // used in local storage as well as the param to send to backend
export const REFERRER_URL_KEY = 'ref' // used in the url header to store the referral e.g., ?ref='<X>'. 
export const LEARN_LINK = 'https://app.trellus.ai/learn'
export const INSTALL_LINK = 'https://app.trellus.ai/install'
export const UNINSTALL_FORM = 'https://6d142b93t9r.typeform.com/to/fCoRsTkq'
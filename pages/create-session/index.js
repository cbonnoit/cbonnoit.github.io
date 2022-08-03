export function enableCreateSession() {
    console.log("Attaching create session form")
    const node = document.querySelector('#submit')
    node.addEventListener('click', () => createSession())
  }
  
/**
 * Read session information from the create session form and send the associated request
 */
async function createSession () {
// get the fields
const url = document.querySelector('[data-field="url"]').textContent
const date = document.querySelector('[data-field="date"]').value
const hour = document.querySelector('[data-field="hour"] [selected="true"]').textContent
const minute = document.querySelector('[data-field="minute"] [selected="true"]').textContent
const ampm = document.querySelector('[data-field="ampm"] [selected="true"]').textContent
const timezone = document.querySelector('[data-field="timezone"] [selected="true"]').textContent
const duration = document.querySelector('[data-field="duration"] [selected="true"]').textContent

// validate the url
const status = document.querySelector('#status')
if (url === '') {
    status.textContent = 'URL is required'
    return
}

// validate the date
if (date === '') {
    status.textContent = 'Date is required'
    return
}

// make the scheduled start time (in seconds)
const timeZone = {'Eastern': 'America/New_York', 'Central': 'America/Chicago',
    'Mountain': 'America/Denver', 'Pacific': 'America/Los_Angeles'}[timezone]
const dateStringBase = `${date} ${hour}:${minute} ${ampm}`
const timeZoneName = back(new Date(Date.parse(dateStringBase)).toLocaleString('en-US', {
    'timeZone': timeZone,
    'timeZoneName': 'short',
}).split(' '))
const scheduledStartTime = new Date(`${dateStringBase} ${timeZoneName}`).valueOf() * MS_TO_SEC

// make the scheduled end time
const durationSec = parseInt(removeSuffix(duration, ' min')) * MIN_TO_SEC
const scheduledEndTime = scheduledStartTime + durationSec

// mark the request as submitting
status.textContent = 'Submitted...'

// signup the user, then update the status
await createRecallSession(url, scheduledStartTime, scheduledEndTime).then(() =>
    status.textContent = 'Success!').catch((e) =>
    status.textContent = e)
}
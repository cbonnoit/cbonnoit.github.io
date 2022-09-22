import { logInfo } from "./core.js"

const _LOG_SCOPE = `%c[Trellus][Network]`
const _LOG_CSS = `background-color: #F0FFFF`

/**
 * Make a simple CORS request to the specified url by text encoding the body object.
 * Raise exceptions if the status is not OK
 * @param {string} url
 * @param {object} parameters
 * @param {boolean} isPost
 * @returns {Promise.<object>} Json decoded result
 */
export async function simpleFetchAndCheck(url, parameters, isPost=false) {
  const init = {
      'method': isPost ? 'POST' : 'GET',
      'headers': { 'Content-Type': 'text/plain' },
  }

  // encode parameters in either body (for post) or query string (for get)
  if (isPost)
      init['body'] = JSON.stringify(parameters)
  else
      url = url + '?' + new URLSearchParams(parameters).toString()

  // get an id for the request
  const requestId = crypto.randomUUID()

  // log it
  const parametersSafe = {...parameters}
  if (parametersSafe['api_key'] != null) 
  parametersSafe['api_key'] = `<length=${parametersSafe['api_key'].length}>`
  logInfo(`${_LOG_SCOPE} ${requestId} ${init['method']} ${url}`, _LOG_CSS, parametersSafe)

  // make the request
  const response = await fetch(url, init);

  // log the status
  logInfo(`${_LOG_SCOPE} ${requestId} ${response.status}`, _LOG_CSS)

  // store the response
  if (response.status === 200)
    return await response.json();
  else
    throw new Error(await response.text());
}

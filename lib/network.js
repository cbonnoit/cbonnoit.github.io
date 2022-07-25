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

    // make the request
    const response = await fetch(url, init);

    // store the response
    if (response.status === 200)
        return await response.json();
    else
        throw new Error(await response.text());
}

export function createLoggingWebsocketPromise(socketName, socketUrl, callback) {
    return new Promise((resolve) => {
        let loggingSocket = new WebSocket(socketUrl);
        loggingSocket.onopen = (event) => {
            console.log(socketName, 'onopen', event);
            resolve(loggingSocket);
        };

        loggingSocket.onmessage = (event) => {
            console.log(socketName, 'onmessage', event);
            callback(event['data']);
        };

        loggingSocket.onerror = (error) => {
            loggingSocket.close();
            console.log(socketName, 'onerror', error);
        };

        loggingSocket.onclose = (event) => {
            loggingSocket = null;
            console.log(socketName, 'onclose', event);
        };
    });
}
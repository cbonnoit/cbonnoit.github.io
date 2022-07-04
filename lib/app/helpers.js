/**
 * Create a new socket which indicates status 
 * @param {String} url Socket url
 * @param {String} buttonQuery CSS query locating the status button
 */
export function websocketWithDynamicButton(url, buttonQuery) {
  const socket = new WebSocket(url)
  const node = document.querySelector(buttonQuery)
  socket.addEventListener('open', () => {
    console.log('Coaching socket opened')
    node.setAttribute('health', 'good')
  })
  socket.addEventListener('close', () => {
      console.log(`Closing socket at ${url}`)
      node.setAttribute('health', 'bad')
  })
  socket.addEventListener('error', console.log)
  return socket
}
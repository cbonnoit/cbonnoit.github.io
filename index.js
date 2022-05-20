import { xor } from './core.js'
import { createNode } from './user-agent.js'

/**
 * Function invoked on load to control coaching
 */
function onPageLoad () {
    // declare an application state (persistent shared memory)
    const state = {}

    // update parameters
    updateStateParameters(state)

    // start off by trying to connect
    connectSocket(state, {isCoaching: true})
    connectSocket(state, {isTranscript: true})

    // wire up button to change connection
    registerConnectivityCallbacks(state)
}

/**
 * 
 * @param {Object} state 
 */
function updateStateParameters (state) {
    // keep track of the toggle buttons
    state.toggleCoaching = document.querySelector('#toggleCoaching')
    state.toggleTranscript = document.querySelector('#toggleTranscript')

    // keep track of where to display coaching and transcripts
    state.coachingRoot = document.querySelector('#coachingRoot')
    state.transcriptRoot = document.querySelector('#transcriptRoot')

    // declare state for coaching and transcript
    state.coachingState = {}
    state.transcriptState = {}

    // use the url query params to extract host, conversation, and coaching identifiers
    const params = new URL(document.location).searchParams
    state.host = params.get('host')
    state.conversationId = params.get('conversationId')
    state.partyId = parseInt(params.get('partyId'))
    state.goal = params.get('goal')
}

/**
 * Set the coaching socket for use and update display elements
 * @param {WebSocket, null} socket 
 * @param {Object} state
 * @param {Object} isCoaching
 * @param {Object} isTranscript
 */
function setSocket (socket, state, {isCoaching=false, isTranscript=false}) {
    // check set references exactly one of coaching and transcript
    if (!xor(isCoaching, isTranscript)) 
        throw new Error('Set called without uniqely specifying coaching or transcript')

    // store the current active socket
    const socketState = isCoaching ? state.coachingState : state.transcriptState
    socketState.socket = socket

    // update connecting and connected status
    const connected = socket != null
    socketState.isConnecting = false
    socketState.isConnected = connected

    // update toggle
    const toggle = isCoaching ? state.toggleCoaching : state.toggleTranscript
    toggle.setAttribute('style', connected ? 'background-color: green' : 'background-color: red')
}

/**
 * Initiate a connection request for a coaching session with connection parameters specified by the url query string
 * @param {Object} state
 * @param {Object} isCoaching
 * @param {Object} isTranscript
 */
function connectSocket (state, {isCoaching=false, isTranscript=false}) {
    // check set references exactly one of coaching and transcript
    if (!xor(isCoaching, isTranscript)) 
        throw new Error('Set called without uniqely specifying coaching or transcript')

    // get the associated socket state
    const socketState = isCoaching ? state.coachingState : state.transcriptState

    // if there is already an active connection in progress, exit early
    if (socketState.isConnecting | socketState.isConnected) {
        console.log('Skipping connect - already connecting or connected')
        return
    }

    // define socket connetion url
    // note: ws: did not work (perhaps because ngrok is only mapping https?)
    const endpoint = isCoaching ? 'client' : 'subscribe-transcript'
    let queryParams
    if (isCoaching)
        queryParams = {conversationId: state.conversationId, partyId: state.partyId, goal: state.goal}
    else 
        queryParams = {conversationId: state.conversationId}
    const queryString = new URLSearchParams(queryParams).toString()
    const socketUrl = `wss://${state.host}/${endpoint}?${queryString}`
    
    // make connection
    console.log(`Creating websocket to ${socketUrl}`)
    let socket
    try {
        socketState.isConnecting = true
        socket = new WebSocket(socketUrl)
    } catch (e) {
        console.log(`Connection failed`)
    }

    // bind callbacks
    socket.addEventListener('open', () => {
        setSocket(socket, state, {isCoaching: isCoaching, isTranscript: isTranscript})
        console.log('Coaching socket opened')
    })
    socket.addEventListener('close', () => {
        setSocket(null, state, {isCoaching: isCoaching, isTranscript: isTranscript})
        console.log('Coaching socket closed')
    })
    socket.addEventListener('message', (event) => {
        if (isCoaching) displayCoaching(event.data, state)
        else displayTranscript(event.data, state)
    })
    socket.addEventListener('error', (event) => console.log('WebSocket error: ', event))
}

/**
 * Disconnect the current coaching socket
 * @param {Object} state
 * @param {bool} isCoaching
 * @param {bool} isTranscript
 */
function disconnectCoaching (state, {isCoaching=false, isTranscript=false}) {
    // check set references exactly one of coaching and transcript
    if (!xor(isCoaching, isTranscript)) 
        throw new Error('Set called without uniqely specifying coaching or transcript')

    // exit early if there is none
    const socketState = isCoaching ? state.coachingState : state.transcriptState
    if (socketState.socket == null) {
        console.log('Skipping disconnect - already disconnected')
        return
    }

    // disconnect
    socketState.socket.close()
}

/**
 * Bind click handlers to toggle connectivity
 * @param {Object} state
 */
function registerConnectivityCallbacks (state) {
    for (const isCoaching of [true, false]) {
        const toggle = isCoaching ? state.toggleCoaching : state.toggleTranscript
        toggle.addEventListener('click', () => {
            // ignore clicks while actively connecting
            const socketState = isCoaching ? state.coachingState : state.transcriptState
            if (socketState.isConnecting) return
    
            // toggle connectivity
            if (socketState.isConnected) disconnectCoaching(state, {isCoaching: isCoaching, isTranscript: !isCoaching})
            else connectSocket()
        })
    }
}

/**
 * Display `data` as coaching
 * @param {*} data
 * @param {Object} state
 */
function displayCoaching (data, state) {
    // create a root div
    const div = state.coachingRoot.appendChild(createNode('div'))
    
    // add time information
    const timeStr = new Date().toLocaleString(undefined, {hour: 'numeric', minute: 'numeric', second: 'numeric'})
    div.appendChild(createNode('div', {}, timeStr))

    // add coaching
    div.appendChild(createNode('div', {}, data))
}

/**
 * Display `data` as a transcript
 * @param {*} data
 * @param {Object} state
 */
function displayTranscript (data, state) {
    // create a root div
    const div = state.transcriptRoot.appendChild(createNode('div'))
    
    // add time information
    const timeStr = new Date().toLocaleString(undefined, {hour: 'numeric', minute: 'numeric', second: 'numeric'})
    div.appendChild(createNode('div', {}, timeStr))

    // add transcript
    div.appendChild(createNode('div', {}, data))
}

window.addEventListener("load", () => onPageLoad())

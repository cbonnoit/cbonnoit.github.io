import { transpose, xor } from './core.js'
import { createNode, createSVGElement, setHidden, svgPathOneDimensional } from './user-agent.js'

const _DISMISSED_ADVICE_SUPRESSED_FOR = 300000  // 5 min
const _AUTO_DISMISS_ADVICE_IN = 5000  // 5 sec

/**
 * Function invoked on load to control coaching
 * Note: the page url should look something like
 * http://127.0.0.1:5500/index.html?conversation_id=822bdd82-929a-495d-9ca7-ca327fe4153c&party_name=Craig%20Bonnoit&goal=discovery&host=4f0c-108-21-57-184.ngrok.io
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

    // wire up dom clicks
    registerDomClickCallbacks(state)
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
    state.coaching = {
        socket: {}, 
        active: {prompt: undefined, autoDismissIntervalId: undefined}, 
        last: {prompt: undefined, time: undefined}
    }
    state.transcript = {socket: {}}

    // keep track of maps between party ids and names
    state.partyIdToName = new Map()
    state.partyNameToId = new Map()

    // keep track of map between party id and activity information
    state.partyIdToActivityLine = new Map()

    // use the url query params to extract host, conversation, and coaching identifiers
    const params = new URL(document.location).searchParams
    state.host = params.get('host')
    state.conversationId = params.get('conversation_id')
    state.partyName = params.get('party_name')
    state.goal = params.get('goal')
}

/**
 * Update persistent maps between party ids and names
 * @param {Object} state 
 */
async function updatePartyNameMap (state) {
    const queryString = new URLSearchParams({conversation_id: state.conversationId}).toString()
    const url = `https://${state.host}/list-party?${queryString}`
    const known = await fetch(url).then((x) => x.json())
    for (const {party_id, party_name} of known) {
        state.partyIdToName.set(party_id, party_name)
        state.partyNameToId.set(party_name, party_id)
    }
}

/**
 * Get name associated with partyId
 * @param {Object} state 
 * @param {Number} partyId
 */
async function partyIdToName (state, partyId) {
    if (!state.partyIdToName.has(partyId))
        await updatePartyNameMap(state)
    return state.partyIdToName.get(partyId)
}

/**
 * Get id associated with partyName
 * @param {Object} state 
 * @param {String} partyName
 */
async function partyNameToId (state, partyName) {
    if (!state.partyNameToId.has(partyName))
        await updatePartyNameMap(state)
    return state.partyNameToId.get(partyName)
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
    const socketState = isCoaching ? state.coaching.socket : state.transcript.socket
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
async function connectSocket (state, {isCoaching=false, isTranscript=false}) {
    // check set references exactly one of coaching and transcript
    if (!xor(isCoaching, isTranscript)) 
        throw new Error('Set called without uniqely specifying coaching or transcript')

    // get the associated socket state
    const socketState = isCoaching ? state.coaching.socket : state.transcript.socket

    // if there is already an active connection in progress, exit early
    if (socketState.isConnecting | socketState.isConnected) {
        console.log('Skipping connect - already connecting or connected')
        return
    }

    // define socket connetion url
    // note: ws: did not work (perhaps because ngrok is only mapping https?)
    const endpoint = isCoaching ? 'subscribe-coaching' : 'subscribe-transcript'
    let queryParams
    if (isCoaching) {
        const partyId = await partyNameToId(state, state.partyName)
        queryParams = {conversation_id: state.conversationId, party_id: partyId, goal: state.goal}
    } else 
        queryParams = {conversation_id: state.conversationId}
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
        const message = JSON.parse(event.data)
        if (isCoaching) handleCoachingMessage(message, state)
        else displayTranscript(message, state)
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
    const socketState = isCoaching ? state.coaching.socket : state.transcript.socket
    if (socketState.socket == null) {
        console.log('Skipping disconnect - already disconnected')
        return
    }

    // disconnect
    socketState.socket.close()
}

/**
 * Handle receipt of a coaching message
 * @param {Object} message
 * @param {Object} state
 */
function handleCoachingMessage (message, state) {
    // case 0: this is interval data
    // todo: is this how we want interval data to come through?
    if (message.prompt == 'intervals')
        return updateActiveIntervals(message, state)

    // case 1: this coaching was recently dismissed
    if (state.coaching.last.prompt == message.prompt 
        && Math.abs(state.coaching.last.time - new Date().getTime()) < _DISMISSED_ADVICE_SUPRESSED_FOR)
        return

    // case 2: there is no active coaching => display this coaching
    if (state.coaching.active.promt == null)
        return displayCoaching(message, state)
        
    
    // case 3: there is active coaching and this is consistent => extend the coaching interval
    if (state.coaching.active.prompt == message.prompt)
        return updateAutoDismissCoaching(state)

    // case 4: there is active coaching and this prompt is inconsistent => ignore
    // todo: is this the right choice?
}

async function updateActiveIntervals (message, state, width=600, height=400, zeroX=200) {
    // find the root element of the activity chart
    const root = document.querySelector('#activityChart')

    for (const [partyIdStr, intervals] of Object.entries(message.party_to_intervals)) {
        // skip empty intervals
        if (intervals.length === 0) continue

        // ensure there is a node for the activity line
        const partyId = parseInt(partyIdStr)
        if (!state.partyIdToActivityLine.has(partyId)) {
            // check there is a valid party name
            const partyName = await partyIdToName(state, partyId)
            if (partyName == null) continue
            
            // add the row
            const row = root.appendChild(createSVGElement('svg', {width: width, height: height, viewBox: `0 0 ${width} ${height}`}))
            row.appendChild(createSVGElement('text', {x: zeroX, y: height / 2, 'dominant-baseline': 'middle', 'text-anchor': 'end'}, partyName))
            const pathNode = row.appendChild(createSVGElement('path', {stroke: 'black', 'stroke-width': 1}))
            state.partyIdToActivityLine.set(partyId, pathNode)
        }

        // update the line
        const pathNode = state.partyIdToActivityLine.get(partyId)
        const starts = intervals.map((x) => x[0] / (30 * 60) * (width - zeroX) + zeroX)
        const ends = intervals.map((x) => x[1] / (30 * 60) * (width - zeroX) + zeroX)
        const pathD = svgPathOneDimensional(starts, ends, height / 2)
        pathNode.setAttribute('d', pathD)
    }
}

function updateAutoDismissCoaching (state) {
    // cancel any pending auto-dismiss
    const currentId = state.coaching.active.autoDismissIntervalId
    if (currentId != null) clearInterval(currentId)

    // set a new auto-dismiss
    state.coaching.active.autoDismissIntervalId = setTimeout(() => dismissCoaching(state), _AUTO_DISMISS_ADVICE_IN)
}

/**
 * Display `data` as coaching
 * @param {Object} data
 * @param {Object} state
 */
function displayCoaching (data, state) {
    // show coaching node with the prompted text
    const coachingNode = document.querySelector('#coachingPrompt')
    coachingNode.textContent = data.prompt
    setHidden(coachingNode, false)

    // update active coaching info
    state.coaching.active.prompt = data.prompt
    
    // set the dismissal callback
    updateAutoDismissCoaching(state)
}

function dismissCoaching (state) {
    // clear auto-dismiss
    const currentId = state.coaching.active.autoDismissIntervalId
    if (currentId != null) clearInterval(currentId)
    state.coaching.active.autoDismissIntervalId = null
    
    // hide coaching node
    setHidden(document.querySelector('#coachingPrompt'), false)

    // update state information
    state.coaching.last.prompt = state.coaching.active.prompt
    state.coaching.active.prompt = null
    state.coaching.last.time = new Date().getTime()
}

/**
 * Display `data` as a transcript
 * @param {Object} data
 * @param {Object} state
 */
function displayTranscript (data, state) {
    // create a root div
    const div = state.transcriptRoot.appendChild(createNode('div'))

    // add time information
    const timeStr = new Date().toLocaleString(undefined, {hour: 'numeric', minute: 'numeric', second: 'numeric'})
    div.appendChild(createNode('div', {}, `${timeStr} - ${data['party_name']}:`))

    // add transcript
    const text = data['words'].map((x) => x['text']).join(' ')
    div.appendChild(createNode('div', {}, text))
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
            const socketState = isCoaching ? state.coaching.socket : state.transcript.socket
            if (socketState.isConnecting) return
    
            // toggle connectivity
            if (socketState.isConnected) disconnectCoaching(state, {isCoaching: isCoaching, isTranscript: !isCoaching})
            else connectSocket()
        })
    }
}

function registerDomClickCallbacks (state) {
    // click to dismiss advice
    document.querySelector('#coachingPrompt').addEventListener('click', () => dismissCoaching(state))
}

window.addEventListener("load", () => onPageLoad())

/**
 * Main entry point to binding interactive elements
 */
function onPageLoad () {
    bindValueProp()
    bindCTA()
}

/**
 * Make the value prop panel interactive
 */
function bindValueProp () {
    // get corresponding property boxes and screenshot nodes
    const boxNodes = [...document.querySelectorAll('.value-box')]
    const propList = boxNodes.map((x) => x.getAttribute('data-prop'))

    // create a function to go to a specific property
    const goToProp = (prop) => {
        // disable current items
        document.querySelector('.value-box[data-value-box-selected]').removeAttribute('data-value-box-selected')
        document.querySelector('.value-screenshot[data-value-box-selected]').removeAttribute('data-value-box-selected')

        // enable target items
        document.querySelector(`.value-box[data-prop=${prop}]`).setAttribute('data-value-box-selected', 'true')
        const screenshotNode = document.querySelector(`.value-screenshot[data-prop=${prop}]`)
        screenshotNode.setAttribute('data-value-box-selected', 'true')

        // ensure the screenshot is in view by scrolling the document as needed
        const screenshotRect = screenshotNode.getBoundingClientRect()
        const scrollY = screenshotRect.bottom + screenshotRect.height * .05 - window.innerHeight
        if (scrollY > 0) window.scrollBy(0, scrollY)
    }

    // create a function to apply an inter shift to the prop
    const shiftProp = (shift) => {
        // get the current prop
        const currentProp = document.querySelector('.value-box[data-value-box-selected]').getAttribute('data-prop')
        const targetIdx = (((propList.indexOf(currentProp) + shift) % propList.length) + propList.length) % propList.length
        goToProp(propList[targetIdx])
    }

    // add callback to arrows
    document.querySelector('#value-arrow-left').addEventListener('click', () => shiftProp(-1))
    document.querySelector('#value-arrow-right').addEventListener('click', () => shiftProp(1))

    // add callback to value boxes
    document.querySelector('#value-box-container').addEventListener('click', (ev) => {
        // get the target prop.  note if the click is on a text element, we have to look up to the parent to get the data-prop
        let targetProp = ev.target.getAttribute('data-prop')
        if (targetProp == null) targetProp = ev.target.parentElement.getAttribute('data-prop')
        if (targetProp != null) goToProp(targetProp)
    })
}

/**
 * Bind the call to action buttons to reveal a hidden form
 */
function bindCTA () {
    const ctaBackground = document.querySelector('#cta-background')
    const ctaFrame = document.querySelector('#cta-frame')
    const ctaHeader = document.querySelector('#cta-header')
    const ctaFieldContainer = document.querySelector('#cta-field-container')
    const ctaSubmit = document.querySelector('#cta-submit')

    // define callback to enable form
    const ctaClick = (isDemo) => {
        // reveal form
        ctaFrame.removeAttribute('style')

        // ensure the submit button is not hidden
        ctaSubmit.removeAttribute('style')

        // set header
        const textDemo = `Please enter your contact information below and we'll be in touch shortly!`
        const textMailing = `Please enter your email below and we'll keep you posted!`
        ctaHeader.textContent = isDemo ? textDemo : textMailing

        // clear any existing cta fields
        for (const child of [...ctaFieldContainer.childNodes])
            ctaFieldContainer.removeChild(child)

        // add necessary fields
        const fieldsDemo = [
            {field: 'name', label: 'Your name'},
            {field: 'address', label: 'Your email address'},
        ]
        const fieldsMailing = [
            {field: 'address', label: 'Your email address'},
        ]
        const fields = isDemo ? fieldsDemo : fieldsMailing
        for (const row of fields) {
            // create label
            const label = ctaFieldContainer.appendChild(document.createElement('div'))
            label.setAttribute('class', 'cta-label')
            label.textContent = row.label

            // create field
            row.node = ctaFieldContainer.appendChild(document.createElement('div'))
            row.node.setAttribute('class', 'cta-field')
            row.node.setAttribute('contenteditable', 'true')
            row.node.setAttribute('data-field', row.field)
        }
        ctaSubmit.setAttribute('data-is-demo', isDemo)
    }

    // bind callbacks to showing form
    document.querySelector('#cta-start').addEventListener('click', () => ctaClick(true))
    document.querySelector('#cta-join').addEventListener('click', () => ctaClick(false))

    // bind callbacks to hide form if if the user ever clicks away from it
    ctaBackground.addEventListener('click', () =>
        ctaFrame.setAttribute('style', 'display: none')
    )

    // bind callbacks on submit
    ctaSubmit.addEventListener('click', () => {
        // get all data
        const nodes = [...ctaFieldContainer.querySelectorAll('.cta-field')]
        const fieldToValue = new Map(nodes.map((x) => [x.getAttribute('data-field'), x.textContent]))

        // validate there is a well formed address
        const address = fieldToValue.get('address') ?? ''
        if (!address.includes('@') || !address.includes('.')) {
            ctaHeader.textContent = 'Please enter a valid email address'
            return
        }

        // otherwise do the submission
        const urlString = `https://updatewebsitecontact.${'azurewebsites'}.net/api/httptrigger`
        const isDemo = ctaSubmit.getAttribute('data-is-demo') === 'true'
        const regexBadChar = /[^a-z0-9-_.@ \n\t]gi/
        const body = {
            time: new Date().getTime() / 1000,
            name: (fieldToValue.get('name') ?? '').replace(regexBadChar, ''),
            email: address.replace(regexBadChar, ''),
            message: isDemo ? 'demo' : 'mailing list'
        }

        // make the url
        const params = new URLSearchParams(new URL(urlString).search)
        for (const [name, value] of Object.entries(body))
            params.set(name, value)
        const url = `${urlString}?${params.toString()}`

        fetch(url, {method: 'get', mode: 'no-cors'}).then((response) => {
            // todo: get a response here and show an error message if it fails
            console.log(response)
        })

        // and close the window
        ctaHeader.textContent = 'Thanks!'
        for (const child of [...ctaFieldContainer.childNodes])
            ctaFieldContainer.removeChild(child)
        ctaSubmit.setAttribute('style', 'display: none')
        setTimeout(() => ctaFrame.setAttribute('style', 'display: none'), 1000)
    })
}

window.addEventListener("load", () => onPageLoad())

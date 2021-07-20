/**
 * Main entry point to binding interactive elements
 */
function onPageLoad () {
    bindValueProp()
}

/**
 * Make the value prop panel interactive
 */
function bindValueProp () {
    // get corresponding property boxes and screenshot nodes
    const boxNodes = [...document.querySelectorAll('.value-box')]
    const screenshotNodes = [...document.querySelectorAll('.value-screenshot')]
    const propList = boxNodes.map((x) => x.getAttribute('data-prop'))

    // create a function to go to a specific property
    const goToProp = (prop) => {
        // disable current items
        document.querySelector('.value-box[data-value-box-selected]').removeAttribute('data-value-box-selected')
        document.querySelector('.value-screenshot[data-value-box-selected]').removeAttribute('data-value-box-selected')

        // enable target items
        document.querySelector(`.value-box[data-prop=${prop}]`).setAttribute('data-value-box-selected', 'true')
        document.querySelector(`.value-screenshot[data-prop=${prop}]`).setAttribute('data-value-box-selected', 'true')
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

window.addEventListener("load", () => onPageLoad())

console.log('running')

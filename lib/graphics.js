const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Namespace-aware wrappers to create elements and set attributes
 */
export function createSVGElement (tagname, attributes = null, textContent = null) {
    // make the node in the right namespace
    const node = document.createElementNS(SVG_NAMESPACE, tagname);

    // set attributes
    if (attributes != null)
        for (const [key, value] of Object.entries(attributes))
            node.setAttribute(key, value);

    // set text
    if (textContent != null)
        node.textContent = textContent;

    if (tagname === 'svg')
        node.setAttribute('xlmns', 'http://www.w3.org/2000/svg');

    return node;
}

/**
 * Create a one dimensional path by unioning segments
 * @param {Array.<Number>} starts
 * @param {Array.<Number>} ends
 * @param {Number} y
 */
export function svgPathOneDimensional(starts, ends, y = 0) {
    if (starts.length !== ends.length) throw new RangeError('Starts and ends do not align');
    if (starts.length === 0) return '';
    return starts.map((s, i) => `M ${s} ${y} L${ends[i]} ${y}`).join(' ');
}

/**
 * @param step: The step number, means the order of the color
 */
export function generateColor(step) {
    // This function generates vibrant, "evenly spaced" colours (i.e. no clustering). This is ideal for creating easily distinguishable vibrant markers in Google Maps and other apps.
    // Adam Cole, 2011-Sept-14
    // HSV to RBG adapted from: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
    var r, g, b;
    var h = step / 6;
    var i = ~~(h * 6);
    var f = h * 6 - i;
    var q = 1 - f;
    switch(i % 6){
        case 0: r = f; g = 0; b = 1; break;
        case 1: r = 1; g = 0; b = q; break;
        case 2: r = 1; g = f; b = 0; break;
        case 3: r = q; g = 1; b = 0; break;
        case 4: r = 0; g = 1; b = f; break;
        case 5: r = 0; g = q; b = 1; break;
    }
    var c = "#" + ("00" + (~ ~(r * 255)).toString(16)).slice(-2) + ("00" + (~ ~(g * 255)).toString(16)).slice(-2) + ("00" + (~ ~(b * 255)).toString(16)).slice(-2);
    return (c);
}

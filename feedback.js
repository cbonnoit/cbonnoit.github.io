// do it
window.addEventListener('load', () => makeFeedbackPage())

function makeFeedbackPage() {
  const page = document.body.appendChild(createNode('div'))
  page.appendChild(createNode('h2', ))
  const questions = createQuestionNodes(page)
  createSubmitNodes(page, questions)
}

/**
 * Create and return a node with specified attributes and text value
 * @param tag {String} Node tag
 * @param attributes {Object} Key-value association of objects
 * @param textValue {String} (optional) text value to include
 */
function createNode(tag, attributes=null, textValue=null) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attributes ?? {}))
    node.setAttribute(key, value)
  if (textValue != null)
    node.textContent = textValue
  return node
}

/**
 * Create editable nodes containing questions and response nodes
 * @param page {HTMLElement} Page to create question nodes in
 */
function createQuestionNodes (page) {
  // define question set
  const feedbackQuestions = [
    {
      question: 'How would you feel if you could no longer use Trellus?',
      answers: ['Very disappointed', 'Somewhat disappointed', 'Not disappointed'],
    },
    {question: 'What type of people do you think would benefit most from Trellus?'},
    {question: 'What is the main benefit you receive from Trellus?'},
    {question: 'How can we improve Trellus for you?'},
    {question: 'What is your professional role?', isShort: true},
    {question: 'Can we contact you to follow up? Please enter your email if so.', isShort: true},
  ]

  for (const question of feedbackQuestions) {
    const questionNode = page.appendChild(createNode('div', {style: 'margin: 16px 8px 16px 8px'}))
    questionNode.appendChild(createNode('h3', {style: 'margin: 0 0 0 0'}, question.question))

    // make a containing frame
    let style = `border-radius: 4px; border: 2px solid #A1CA43; width: 600px;`
    const frame = questionNode.appendChild(createNode('div', {style}))
    question.responseFrame = frame

    // case 1: free form answer
    if (question.answers == null) {
      const height = question.isShort ? 18 : 68
      question.node = frame.appendChild(createNode('div', {contenteditable: true, style: `height: ${height}px`}))
    } else {
      // case 2: radio buttons
      question.nodes = []
      for (const answer of question.answers) {
        const input = frame.appendChild(createNode('input', {type: 'radio', id: answer, value: answer}))
        frame.appendChild(createNode('label', {for: answer}, answer))
        question.nodes.push(input)
      }
    }
  }

  return feedbackQuestions
}

/**
 * Submit feedback from
 * @param page
 * @param questions
 */
function createSubmitNodes (page, questions) {
  // create submit node
  const submitGroup = page.appendChild(createNode('div', {class: 'flexRow', style: 'justify-content: flex-start'}))
  const submit = submitGroup.appendChild(createNode('div', {class: 'button primary-cta'}, 'Submit response'))

  // add callback to actually do submission
  submit.addEventListener('click', () => {
    // get responses
    const feedback = []
    for (const question of questions) {
      // extract the answer
      let answer
      if (question.node != null) answer = question.node.innerText
      else answer = [...question.nodes.filter((x) => x.checked).map((x) => x.getAttribute('value')), ''][0]

      // append questions that were answered to feedback
      if (answer !== '')
        feedback.push({question: question.question, answer})
    }

    // send the survey data
    const url = 'https://trellus-write-product-feedback.azurewebsites.net/api/WriteTrigger'
    const body = {time: new Date().getTime() / 1000, feedback}
    // noinspection JSIgnoredPromiseFromCall
    fetch(url, {method: 'POST', mode: 'no-cors', body: JSON.stringify(body)}).then(() => {
      // note: since this is sent with no cors, we can not get a response to confirm receipt. acknowledge the click either way
      window.location.replace('https://www.trell.us')
    })
  })
}

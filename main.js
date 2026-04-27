let questions = [];
let properties = [];

let askedQuestions = [];
let tagState = {};
let boostedQuestionId = null;  // New: Tracks the question ID to boost next
let askedClusters = new Set();  // New: Tracks asked clusters for coverage

let mode = "manual"; // "random" oder "manual"

// --------------------
// LOAD + NORMALIZE
// --------------------
async function loadData() {
  questions = await (await fetch("questions.json")).json();
  properties = await (await fetch("properties.json")).json();

  normalizeData(questions, properties);

  nextQuestion();
}
//random simulation run
function runRandomSimulation() {
  resetSimulation();

  console.log("🚀 Starte 7er Durchlauf...\n");

  for (let i = 0; i < 7; i++) {

    let missingTags = checkProperties(properties, tagState);

    let scored = questions.map(q => ({
      q,
      weight: getWeight(q, missingTags, askedQuestions, boostedQuestionId, askedClusters)
    }));

    let question = pickQuestion(scored);

    let answer = question.answers[Math.floor(Math.random() * question.answers.length)];

    console.log(`👉 Frage ${i + 1}:`, question.text);
    console.log(`Antwort:`, answer.text);

    applyTags(answer.tags, tagState);

    askedQuestions.push(question.id);
  }

  console.log("\n📊 Finale Tags:", tagState);

  showFinalResults();
}

// Shared helper functions are now defined in helpers.js.

// --------------------

// --------------------
// NEXT QUESTION
// --------------------
function nextQuestion() {
  if (askedQuestions.length >= 8) {
    showFinalResults();
    return;
  }

  let missingTags = checkProperties(properties, tagState);

  let scored = questions.map(q => ({
    q,
    weight: getWeight(q, missingTags, askedQuestions, boostedQuestionId, askedClusters)
  }));

  let question = pickQuestion(scored);

  console.log("\n👉 Frage:", question.text);
  console.log("Gewichte:", scored);

  if (mode === "random") {
    randomAnswer(question);
  } else {
    showQuestionUI(question);
  }
}

// --------------------
// ANSWER HANDLER
// --------------------
function handleAnswer(q, answer) {
  applyTags(answer.tags, tagState);
  boostedQuestionId = answer.boostedQuestionId;  // New: Set boosted question for next
  askedClusters.add(q.cluster);  // New: Add cluster to asked clusters

  askedQuestions.push(q.id);

  console.log("Aktuelle Tags:", tagState);

  nextQuestion();
}

// --------------------
// RANDOM MODE
// --------------------
function randomAnswer(q) {
  let answer = q.answers[Math.floor(Math.random() * q.answers.length)];

  console.log("Antwort:", answer.text);

  handleAnswer(q, answer);
}

// --------------------
// MANUAL MODE UI
// --------------------
function showQuestionUI(q) {
  const container = document.getElementById("app");

  container.innerHTML = `<h2>${q.text}</h2>`;

  q.answers.forEach(ans => {
    let btn = document.createElement("button");
    btn.innerText = ans.text;

    btn.onclick = () => handleAnswer(q, ans);

    container.appendChild(btn);
  });
}

// --------------------
// MODE SWITCH
// --------------------
function toggleMode() {

  if (mode === "manual") {
    mode = "random";
    runRandomSimulation();
  } else {
    mode = "manual";
    resetSimulation();
    nextQuestion();
  }

  console.log("Mode:", mode);
}

// --------------------
// FINAL RESULTS
// --------------------
function showFinalResults() {
  const container = document.getElementById("app");

  container.innerHTML = "<h2>Ergebnis</h2>";

  // TAGS (FIXED)
  let tagHTML = "<h3>Tags</h3><ul>";

  Object.entries(tagState)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, value]) => {
      tagHTML += `<li>${tag}: ${value}</li>`;
    });

  tagHTML += "</ul>";

  // PROPERTIES 
  let achieved = getAchievedProperties(properties, tagState);
  let almost = getAlmostProperties(properties, tagState);

  let propHTML = "<h3>Eigenschaften</h3>";

  propHTML += "<b>✅ Erreicht:</b><ul>";
  achieved.forEach(p => propHTML += `<li>${p}</li>`);
  propHTML += "</ul>";

  if (almost.length > 0) {
    propHTML += "<b>⚠️ Fast erreicht:</b><ul>";
    almost.forEach(p => propHTML += `<li>${p}</li>`);
    propHTML += "</ul>";
  }

  container.innerHTML += tagHTML + propHTML;
}

function resetSimulation() {
  askedQuestions = [];
  tagState = {};
  boostedQuestionId = null;  
  askedClusters.clear(); 
}

// --------------------
// START
// --------------------
loadData();

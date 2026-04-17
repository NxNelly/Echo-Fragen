let questions = [];
let properties = [];

let askedQuestions = [];
let tagState = {};
let lastFollowUpCluster = null;

let mode = "manual"; // "random" oder "manual"

// --------------------
// LOAD
// --------------------
async function loadData() {
  questions = await (await fetch("questions.json")).json();
  properties = await (await fetch("properties.json")).json();

  nextQuestion();
}

// --------------------
// TAGS
// --------------------
function applyTags(tags) {
  for (let key in tags) {
    if (!tagState[key]) tagState[key] = 0;
    tagState[key] += tags[key];
  }
}

// --------------------
// PROPERTY CHECK
// --------------------
function checkProperties() {
  let missingTags = [];

  for (let prop of properties) {
    let match = prop.tags.filter(t => tagState[t]).length;

    if (match >= prop.required) {
      console.log("✅ ERREICHT:", prop.name);
    } 
    else if (match === prop.required - 1) {
      let missing = prop.tags.find(t => !tagState[t]);
      if (missing) {
        missingTags.push(missing);
        console.log("⚠️ FAST:", prop.name, "fehlt:", missing);
      }
    }
  }

  return missingTags;
}

// --------------------
// WEIGHT SYSTEM
// --------------------
function getWeight(q, missingTags) {
  if (askedQuestions.includes(q.id)) return 0;

  let weight = 1;
  //Core Boost
  if (q.cluster === "core") {
    weight += 12;
  }
  // FollowUp Boost
  if (q.cluster === lastFollowUpCluster) {
    weight += 5;
  }

  // Missing Tag Boost
  for (let ans of q.answers) {
    for (let tag in ans.tags) {
      if (missingTags.includes(tag)) {
        weight += 8;
      }
    }
  }

  /* Neuer Cluster Boost
  let clusterUsed = askedQuestions
    .map(id => questions.find(q => q.id === id)?.cluster);

  if (!clusterUsed.includes(q.cluster)) {
    weight += ;
  }
*/
  return weight;
}

// --------------------
// WEIGHTED RANDOM
// --------------------
function pickQuestion(scored) {
  let total = scored.reduce((sum, s) => sum + s.weight, 0);

  let rand = Math.random() * total;

  let acc = 0;

  for (let s of scored) {
    acc += s.weight;
    if (rand <= acc) return s.q;
  }

  return scored[0].q;
}

// --------------------
// NEXT QUESTION
// --------------------
function nextQuestion() {
  if (askedQuestions.length >= 10) {
    showFinalResults();
    return;
  }

  let missingTags = checkProperties();

  let scored = questions.map(q => ({
    q,
    weight: getWeight(q, missingTags)
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
// RANDOM MODE
// --------------------
function randomAnswer(q) {
  let answer = q.answers[Math.floor(Math.random() * q.answers.length)];

  console.log("Antwort:", answer.text);

  applyTags(answer.tags);
  lastFollowUpCluster = answer.followUpCluster || null;

  askedQuestions.push(q.id);

  setTimeout(nextQuestion, 1000);
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

    btn.onclick = () => {
      applyTags(ans.tags);
      lastFollowUpCluster = ans.followUpCluster || null;

      askedQuestions.push(q.id);
      console.log("Aktuelle Tags:", tagState);
      nextQuestion();
    };

    container.appendChild(btn);
  });
}

// --------------------
// MODE SWITCH
// --------------------
function toggleMode() {
  mode = mode === "random" ? "manual" : "random";
  console.log("Mode:", mode);
}

function showFinalResults() {
  console.log("🎯 FINAL TAGS:", tagState);

  const container = document.getElementById("app");
  container.innerHTML = "<h2>Ergebnis</h2>";

  // --------------------
  // TAGS anzeigen
  // --------------------
  let tagHTML = "<h3>Tags</h3><ul>";

  Object.entries(tagState)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, value]) => {
      tagHTML += `<li>${tag}: ${value}</li>`;
    });

  tagHTML += "</ul>";

  // --------------------
  // PROPERTIES anzeigen
  // --------------------
  let achieved = [];
  let almost = [];

  for (let prop of properties) {
    let match = prop.tags.filter(t => tagState[t]).length;

    if (match >= prop.required) {
      achieved.push(prop.name);
    } else if (match === prop.required - 1) {
      almost.push(prop.name);
    }
  }

  let propHTML = "<h3>Eigenschaften</h3>";

  propHTML += "<b>✅ Erreicht:</b><ul>";
  achieved.forEach(p => propHTML += `<li>${p}</li>`);
  propHTML += "</ul>";

  // --------------------
  // AUSGABE
  // --------------------
  container.innerHTML += tagHTML + propHTML;
}

// --------------------
// START
// --------------------
loadData();
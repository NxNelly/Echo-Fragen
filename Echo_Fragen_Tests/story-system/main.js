let questions = [];
let properties = [];

let askedQuestions = [];
let tagState = {};
let lastFollowUpCluster = null;

// Daten laden
async function loadData() {
  questions = await (await fetch("questions.json")).json();
  properties = await (await fetch("properties.json")).json();

  nextQuestion();
}

// Tags anwenden
function applyTags(tags) {
  for (let key in tags) {
    if (!tagState[key]) tagState[key] = 0;
    tagState[key] += tags[key];
  }
}

// Check Eigenschaften
function checkProperties() {
  let results = [];

  for (let prop of properties) {
    let matchCount = prop.tags.filter(tag => tagState[tag]).length;

    if (matchCount === prop.tags.length) {
      console.log("✅ ERREICHT:", prop.name);
    } else if (matchCount === prop.tags.length - 1) {
      let missing = prop.tags.find(tag => !tagState[tag]);
      results.push(missing);
      console.log("⚠️ FAST:", prop.name, "fehlt:", missing);
    }
  }

  return results; // fehlende tags
}

// Score berechnen
function scoreQuestion(q, missingTags) {
  let score = 0;

  // Core zuerst
  if (q.cluster === "core") score += 4;

  // Noch nicht gefragt
  if (!askedQuestions.includes(q.id)) score += 2;
  else return -100;

  // FollowUp Boost
  if (q.cluster === lastFollowUpCluster) {
    score += 3;
  }

  // Fehlende Tags Boost
  for (let ans of q.answers) {
    for (let tag in ans.tags) {
      if (missingTags.includes(tag)) {
        score += 3;
      }
    }
  }

  return score;
}

// Nächste Frage wählen
function nextQuestion() {
  if (askedQuestions.length >= 10) {
    console.log("🎯 Finale Tags:", tagState);
    return;
  }

  let missingTags = checkProperties();

  let scored = questions.map(q => ({
    q,
    score: scoreQuestion(q, missingTags)
  }));

  scored.sort((a, b) => b.score - a.score);

  let best = scored[0].q;

  console.log("\n👉 Frage:", best.text);
  console.log("Score:", scored[0].score);

  // Random Antwort simulieren
  let answer = best.answers[Math.floor(Math.random() * best.answers.length)];

  console.log("Antwort:", answer.text);

  applyTags(answer.tags);

  lastFollowUpCluster = answer.followUpCluster || null;

  askedQuestions.push(best.id);

  console.log("Tags:", tagState);
  console.log("------------");

  setTimeout(nextQuestion, 1000);
}

// Start
loadData();
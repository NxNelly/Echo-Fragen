let questions = [];
let properties = [];
let avatars = [];
let stories = [];
let tagRequirements = null;

let mode = "manual"; // "random" oder "manual"

const runtime = {
  askedQuestions: [],
  tagState: {
    properties: {},
    avatar: {},
    story: {}
  },
  boostedQuestionId: null,
  askedClusters: new Set()
};

const appContainer = document.getElementById("app");

async function loadData() {
  questions = await (await fetch("questions.json")).json();
  properties = await (await fetch("properties.json")).json();
  avatars = await (await fetch("avatar.json")).json();
  stories = await (await fetch("story.json")).json();
  tagRequirements = await (await fetch("tagRequirements.json")).json();

  normalizeData(questions, properties, avatars, stories);
  resetRuntime();
  nextQuestion();
}

function getTotalQuestions() {
  return tagRequirements?.totalQuestions ?? 10;
}

function resetRuntime() {
  runtime.askedQuestions = [];
  runtime.tagState = {
    properties: {},
    avatar: {},
    story: {}
  };
  runtime.boostedQuestionId = null;
  runtime.askedClusters = new Set();
}

function isFinished() {
  return runtime.askedQuestions.length >= getTotalQuestions();
}

function nextQuestion() {
  if (isFinished()) {
    renderFinalResults();
    return;
  }

  const requiredTypes = getRequiredTagTypes(tagRequirements, runtime.tagState, runtime.askedQuestions.length);
  const missingTags = collectMissingTags(properties, avatars, stories, runtime.tagState);

  const scored = questions.map(q => ({
    q,
    weight: getWeight(q, missingTags, runtime.askedQuestions, runtime.boostedQuestionId, runtime.askedClusters, requiredTypes)
  }));

  const question = pickQuestion(scored);
  if (!question) {
    renderFinalResults();
    return;
  }

  if (mode === "random") {
    randomAnswer(question);
  } else {
    renderQuestion(question);
  }
}

function handleAnswer(question, answer) {
  applyTags(answer, runtime.tagState);
  runtime.boostedQuestionId = answer.boostedQuestionId;
  runtime.askedClusters.add(question.cluster);
  runtime.askedQuestions.push(question.id);

  console.log("Antwort verarbeitet. Aktuelle Tags:", runtime.tagState);

  if (isFinished()) {
    renderFinalResults();
  } else {
    nextQuestion();
  }
}

function randomAnswer(question) {
  const answer = question.answers[Math.floor(Math.random() * question.answers.length)];
  console.log("Antwort:", answer.text);
  handleAnswer(question, answer);
}

function renderQuestion(question) {
  if (!appContainer) return;

  appContainer.innerHTML = `<h2>${question.text}</h2><audio src="audio/${question.id}.mp3" autoplay></audio>`;
  question.answers.forEach(answer => {
    const button = document.createElement("button");
    button.innerText = answer.text;
    button.onclick = () => handleAnswer(question, answer);
    appContainer.appendChild(button);
  });
}

function toggleMode() {
  if (mode === "manual") {
    mode = "random";
    runRandomSimulation();
  } else {
    mode = "manual";
    resetRuntime();
    nextQuestion();
  }

  console.log("Mode:", mode);
}

function runRandomSimulation() {
  resetRuntime();
  console.log(`🚀 Starte ${getTotalQuestions()}er Durchlauf...\n`);

  for (let i = 0; i < getTotalQuestions(); i++) {
    const requiredTypes = getRequiredTagTypes(tagRequirements, runtime.tagState, runtime.askedQuestions.length);
    const missingTags = collectMissingTags(properties, avatars, stories, runtime.tagState);

    const scored = questions.map(q => ({
      q,
      weight: getWeight(q, missingTags, runtime.askedQuestions, runtime.boostedQuestionId, runtime.askedClusters, requiredTypes)
    }));

    const question = pickQuestion(scored);
    if (!question) break;

    const answer = question.answers[Math.floor(Math.random() * question.answers.length)];
    console.log(`👉 Frage ${i + 1}:`, question.text);
    console.log(`Antwort:`, answer.text);

    applyTags(answer, runtime.tagState);
    runtime.boostedQuestionId = answer.boostedQuestionId;
    runtime.askedClusters.add(question.cluster);
    runtime.askedQuestions.push(question.id);
  }

  renderFinalResults();
}

function renderFinalResults() {
  if (!appContainer) return;

  const achievedProperties = getAchievedItems(properties, runtime.tagState.properties);
  const achievedAvatars = getAchievedItems(avatars, runtime.tagState.avatar);
  const achievedStories = getAchievedItems(stories, runtime.tagState.story);

  const resultState = {
    tags: {
      properties: runtime.tagState.properties,
      avatar: runtime.tagState.avatar,
      story: runtime.tagState.story
    },
    properties: achievedProperties,
    avatar: achievedAvatars,
    story: achievedStories
  };
  console.log("Finales Ergebnis:", resultState);

  let html = "<h2>Ergebnis</h2>";
  html += buildTagSummary();
  html += buildResultSection("Setting-Eigenschaften", properties, runtime.tagState.properties, "properties");
  html += buildResultSection("Avatar-Eigenschaften", avatars, runtime.tagState.avatar, "avatar");
  html += buildResultSection("Storypunkte", stories, runtime.tagState.story, "story");

  appContainer.innerHTML = html;
}

function buildTagSummary() {
  const groups = [
    { title: "Setting-Tags", stateKey: "properties" },
    { title: "Avatar-Tags", stateKey: "avatar" },
    { title: "Story-Tags", stateKey: "story" }
  ];

  let html = "<h3>Tags</h3>";
  groups.forEach(group => {
    html += `<h4>${group.title}</h4><ul>`;
    const entries = Object.entries(runtime.tagState[group.stateKey] || {}).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      html += "<li>Keine Tags</li>";
    } else {
      entries.forEach(([tag, value]) => {
        html += `<li>${tag}: ${value}</li>`;
      });
    }
    html += "</ul>";
  });

  return html;
}

function getActForNumber(number) {
  if (number <= 8) return 1;
  if (number <= 15) return 2;
  return 3;
}

function buildResultSection(title, items, state, category = "properties") {
  const achieved = getAchievedItems(items, state, category);
  let html = `<h3>${title}</h3>`;
  html += "<b>✅ Erreicht:</b>";
  if (achieved.length === 0) {
    html += "<ul><li>Keine</li></ul>";
  } else {
    if (category === "story") {
      // Stories nach Nummer sortieren und nach Akten organisieren
      const achievedWithNumbers = achieved
        .map(itemName => items.find(i => i.id === itemName || i.name === itemName))
        .filter(item => item)
        .sort((a, b) => (a.number || 0) - (b.number || 0));

      // Nach Akten gruppieren
      const byAct = { 1: [], 2: [], 3: [] };
      achievedWithNumbers.forEach(item => {
        const act = getActForNumber(item.number);
        byAct[act].push(item);
      });

      html += "<div style='margin-left: 20px;'>";
      [1, 2, 3].forEach(act => {
        if (byAct[act].length > 0) {
          html += `<h4>Akt ${act}</h4><ul style='list-style-type: none; padding-left: 0;'>`;
          byAct[act].forEach(item => {
            html += `<li style='margin-bottom: 10px;'><strong>${item.number}. ${item.name}</strong>: ${item.text}</li>`;
          });
          html += "</ul>";
        }
      });
      html += "</div>";
    } else {
      html += "<ul>";
      achieved.forEach(itemName => {
        html += `<li>${itemName}</li>`;
      });
      html += "</ul>";
    }
  }
  return html;
}

loadData();

// --------------------
// SIMULATION ENTRY
// --------------------
async function runSimulation() {
  console.log("🚀 Starte Simulation...");

  let runs = 10000;

  let stats = {
    questions: {},
    tags: {},
    properties: {}
  };

  for (let i = 0; i < runs; i++) {
    let result = simulateOneRun();

    // Fragen zählen
    result.questions.forEach(q => {
      stats.questions[q] = (stats.questions[q] || 0) + 1;
    });

    // Tags zählen
    Object.entries(result.tags).forEach(([tag, val]) => {
      stats.tags[tag] = (stats.tags[tag] || 0) + val;
    });

    // Properties zählen
    if (result.properties.length === 0) {
      stats.properties.Null = (stats.properties.Null || 0) + 1;
    } else {
      result.properties.forEach(p => {
        stats.properties[p] = (stats.properties[p] || 0) + 1;
      });
    }
  }

  console.log("📊 Simulation fertig:", stats);

  let percentages = calculatePercentages(stats, runs);

  renderStats(stats, percentages);
}

// --------------------
// EIN RUN (7 FRAGEN)
// --------------------
function simulateOneRun() {
  let localAsked = [];
  let localTags = {};
  let localFollowUp = null;
  let localBoostedQuestionId = null;
  let localAskedClusters = new Set();

  for (let step = 0; step < 7; step++) {
    let missingTags = checkProperties(properties, localTags);

    let scored = questions.map(q => ({
      q,
      weight: getWeight(q, missingTags, localAsked, localBoostedQuestionId, localAskedClusters)
    }));

    let q = pickQuestion(scored);

    let answer = q.answers[Math.floor(Math.random() * q.answers.length)];

    applyTags(answer.tags, localTags);

    localBoostedQuestionId = answer.boostedQuestionId || null;
    localAskedClusters.add(q.cluster);
    localAsked.push(q.id);
  }

  let achievedProps = getAchievedProperties(properties, localTags);

  return {
    questions: localAsked,
    tags: localTags,
    properties: achievedProps
  };
}

// Shared helper functions are now defined in helpers.js.

// --------------------
// UI RENDER
// --------------------
function renderStats(stats, percentages) {

  const container = document.getElementById("app");

  function createList(title, obj, percentObj) {
    let html = `<h3>${title}</h3><ul>`;

    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .forEach(([key, val]) => {

        let percent = percentObj[key]?.toFixed(2) || 0;

        html += `<li>${key}: ${percent}%</li>`;
      });

    html += "</ul>";
    return html;
  }

  container.innerHTML = `
    <h2>Simulation Ergebnis</h2>
    ${createList("Fragen", stats.questions, percentages.questions)}
    ${createList("Tags", stats.tags, percentages.tags)}
    ${createList("Properties", stats.properties, percentages.properties)}
  `;
}
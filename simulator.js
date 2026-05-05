// --------------------
// SIMULATION ENTRY
// --------------------
async function runSimulation() {
  console.log("🚀 Starte Simulation...");

  let runs = 1000;

  let stats = {
    questions: {},
    tags: {},
    properties: {},
    avatars: {}
  };

  for (let i = 0; i < runs; i++) {
    let result = simulateOneRun();

    // Fragen zählen
    result.questions.forEach(q => {
      stats.questions[q] = (stats.questions[q] || 0) + 1;
    });

    // Tags zählen
    Object.entries(result.tags).forEach(([category, tagsObj]) => {
      if (!stats.tags[category]) stats.tags[category] = {};
      Object.entries(tagsObj).forEach(([tag, val]) => {
        stats.tags[category][tag] = (stats.tags[category][tag] || 0) + val;
      });
    });

    // Properties zählen
    if (result.properties.length === 0) {
      stats.properties.Null = (stats.properties.Null || 0) + 1;
    } else {
      result.properties.forEach(p => {
        stats.properties[p] = (stats.properties[p] || 0) + 1;
      });
    }

    // Avatars zählen
    if (result.avatars.length === 0) {
      stats.avatars.Null = (stats.avatars.Null || 0) + 1;
    } else {
      result.avatars.forEach(a => {
        stats.avatars[a] = (stats.avatars[a] || 0) + 1;
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
  let localTags = {
    properties: {},
    avatar: {},
    story: {}
  };
  let localBoostedQuestionId = null;
  let localAskedClusters = new Set();

  for (let step = 0; step < (tagRequirements?.totalQuestions || 10); step++) {
    let requiredTypes = getRequiredTagTypes(tagRequirements, localTags, localAsked.length);
    let missingTags = collectMissingTags(properties, avatars, stories, localTags);

    let scored = questions.map(q => ({
      q,
      weight: getWeight(q, missingTags, localAsked, localBoostedQuestionId, localAskedClusters, requiredTypes)
    }));

    let q = pickQuestion(scored);
    if (!q) break;

    let answer = q.answers[Math.floor(Math.random() * q.answers.length)];

    applyTags(answer, localTags);

    localBoostedQuestionId = answer.boostedQuestionId || null;
    localAskedClusters.add(q.cluster);
    localAsked.push(q.id);
  }

  let achievedProps = getAchievedItems(properties, localTags.properties);
  let achievedAvatars = getAchievedItems(avatars, localTags.avatar);
  let achievedStories = getAchievedItems(stories, localTags.story);

  return {
    questions: localAsked,
    tags: localTags,
    properties: achievedProps,
    avatars: achievedAvatars,
    stories: achievedStories
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
      .forEach(([key]) => {

        let percent = percentObj[key]?.toFixed(2) || 0;

        html += `<li>${key}: ${percent}%</li>`;
      });

    html += "</ul>";
    return html;
  }

  function createTagsHtml(statsTags, percentagesTags) {
    let html = '';
    Object.entries(statsTags).forEach(([category, tagsObj]) => {
      html += `<h3>${category.charAt(0).toUpperCase() + category.slice(1)} tags</h3><ul>`;
      Object.entries(tagsObj)
        .sort((a, b) => b[1] - a[1])
        .forEach(([tag, count]) => {
          let percent = percentagesTags[category][tag]?.toFixed(2) || '0.00';
          html += `<li>${tag}: ${percent}%</li>`;
        });
      html += '</ul>';
    });
    return html;
  }

  container.innerHTML = `
    <h2>Simulation Ergebnis</h2>
    ${createList("Fragen", stats.questions, percentages.questions)}
    ${createTagsHtml(stats.tags, percentages.tags)}
    ${createList("Properties", stats.properties, percentages.properties)}
    ${createList("Avatars", stats.avatars, percentages.avatars)}
  `;
}
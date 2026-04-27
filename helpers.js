// Shared utility functions for story simulation and questionnaire flow.

function normalizeData(questions, properties) {
  questions.forEach(q => {
    q.answers.forEach(ans => {
      ans.tags = ans.tags || {};
      ans.boostedQuestionId = ans.boostedQuestionId || null;
    });
  });

  properties.forEach(p => {
    if (p.tags) {
      p.allTags = p.tags;
    } else {
      p.allTags = [
        ...(p.requiredTags || []),
        ...(p.optionalTags || [])
      ];
    }
  });
}

function applyTags(tags, state) {
  for (let key in tags) {
    state[key] = (state[key] || 0) + tags[key];
  }
}

function checkProperties(properties, tagState) {
  let missingTags = [];

  for (let prop of properties) {
    let missing = [];

    if (prop.requiredTags) {
      for (let tag of prop.requiredTags) {
        if (!tagState[tag]) {
          missing.push(tag);
        }
      }
    }

    let optionalCount = prop.optionalTags
      ? prop.optionalTags.filter(tag => tagState[tag]).length
      : 0;

    let optionalNeeded = prop.optionalRequired || 0;

    if (missing.length === 0 && optionalCount >= optionalNeeded) {
      console.log("✅ ERREICHT:", prop.name);
    } else {
      if (optionalCount < optionalNeeded) {
        let stillNeeded = optionalNeeded - optionalCount;
        let missingOptional = prop.optionalTags
          ? prop.optionalTags.filter(tag => !tagState[tag])
          : [];

        missing.push(...missingOptional.slice(0, stillNeeded));
      }

      if (missing.length === 1) {
        console.log("⚠️ FAST:", prop.name, "fehlt:", missing[0]);
        missingTags.push(missing[0]);
      }
    }
  }

  return missingTags;
}

function getWeight(q, missingTags, askedQuestions, boostedQuestionId, askedClusters) {
  if (askedQuestions.includes(q.id)) return 0;

  let weight = 1;
  let priority = q.priority || 0;
  weight += priority;

  if (q.id === boostedQuestionId) weight += 10;
  if (!askedClusters.has(q.cluster)) weight += 5;

  for (let ans of q.answers) {
    for (let tag in ans.tags) {
      if (missingTags.includes(tag)) {
        weight += 20;
      }
    }
  }

  return weight;
}

function pickQuestion(scored) {
  let total = scored.reduce((sum, s) => sum + s.weight, 0);
  let rand = Math.random() * total;
  let acc = 0;

  for (let s of scored) {
    acc += s.weight;
    if (rand <= acc) return s.q;
  }

  return scored[0]?.q;
}

function getAchievedProperties(properties, tagState) {
  let achieved = [];

  for (let prop of properties) {
    let missing = [];

    if (prop.requiredTags) {
      for (let tag of prop.requiredTags) {
        if (!tagState[tag]) missing.push(tag);
      }
    }

    let optionalCount = prop.optionalTags
      ? prop.optionalTags.filter(tag => tagState[tag]).length
      : 0;

    let optionalNeeded = prop.optionalRequired || 0;

    if (missing.length === 0 && optionalCount >= optionalNeeded) {
      achieved.push(prop.name);
    }
  }

  return achieved;
}

function getAlmostProperties(properties, tagState) {
  let almost = [];

  for (let prop of properties) {
    let missing = [];

    if (prop.requiredTags) {
      for (let tag of prop.requiredTags) {
        if (!tagState[tag]) missing.push(tag);
      }
    }

    let optionalCount = prop.optionalTags
      ? prop.optionalTags.filter(tag => tagState[tag]).length
      : 0;

    let optionalNeeded = prop.optionalRequired || 0;

    if (missing.length + (optionalNeeded - optionalCount) === 1) {
      almost.push(prop.name);
    }
  }

  return almost;
}

function calculatePercentages(stats, runs) {
  let totals = {
    questions: runs * 7,
    tags: Object.values(stats.tags).reduce((a, b) => a + b, 0),
    properties: Object.values(stats.properties).reduce((a, b) => a + b, 0)
  };

  let percentages = {
    questions: {},
    tags: {},
    properties: {}
  };

  Object.entries(stats.questions).forEach(([key, val]) => {
    percentages.questions[key] = (val / totals.questions) * 100;
  });

  Object.entries(stats.tags).forEach(([key, val]) => {
    percentages.tags[key] = (val / totals.tags) * 100;
  });

  Object.entries(stats.properties).forEach(([key, val]) => {
    percentages.properties[key] = (val / totals.properties) * 100;
  });

  return percentages;
}

// Shared utility functions for story simulation and questionnaire flow.

const TAG_GROUPS = {
  propertyTags: "properties",
  avatarTags: "avatar",
  storyTags: "story",
  tags: "properties"
};

function normalizeData(questions, properties, avatars, stories) {
  questions.forEach(q => {
    q.questionType = q.questionType || "properties";

    q.answers.forEach(ans => {
      if (ans.tags) {
        ans.propertyTags = ans.propertyTags || ans.tags;
        delete ans.tags;
      }

      ans.propertyTags = ans.propertyTags || {};
      ans.avatarTags = ans.avatarTags || {};
      ans.storyTags = ans.storyTags || {};
      ans.boostedQuestionId = ans.boostedQuestionId || null;
    });
  });

  [properties, avatars, stories].forEach(list => {
    list.forEach(item => {
      if (item.tags) {
        item.allTags = item.tags;
      } else {
        item.allTags = [
          ...(item.requiredTags || []),
          ...(item.optionalTags || [])
        ];
      }

      if (!item.id) {
        if (item.requiredTags?.length === 1) {
          item.id = item.requiredTags[0];
        } else if (item.name) {
          item.id = item.name.trim();
        }
      }

      if (typeof item.id === "string") {
        item.id = item.id.trim();
      }
    });
  });
}

function applyTags(answer, state) {
  if (!answer) return;

  Object.entries(TAG_GROUPS).forEach(([rawType, group]) => {
    const tagGroup = answer[rawType];
    if (!tagGroup || typeof tagGroup !== "object") return;

    const bucket = state[group] || (state[group] = {});
    Object.entries(tagGroup).forEach(([tag, value]) => {
      bucket[tag] = (bucket[tag] || 0) + value;
    });
  });
}

function getTagTotal(state, group) {
  const bucket = state[group] || {};
  return Object.values(bucket).reduce((sum, val) => sum + val, 0);
}

function getRequiredTagTypes(requirements, tagState, questionCount) {
  if (!requirements || questionCount < requirements.checkAfter) return [];

  return Object.entries(requirements.minimums || {})
    .filter(([type, min]) => getTagTotal(tagState, type) < min)
    .map(([type]) => type);
}

function hasAnswerType(q, requiredTypes) {
  if (!requiredTypes?.length) return true;

  const qTypes = Array.isArray(q.questionType) ? q.questionType : [q.questionType];
  if (qTypes.some(type => requiredTypes.includes(type))) return true;

  return q.answers.some(ans =>
    requiredTypes.some(type =>
      type === "properties" ? Object.keys(ans.propertyTags || {}).length > 0
        : type === "avatar" ? Object.keys(ans.avatarTags || {}).length > 0
          : type === "story" ? Object.keys(ans.storyTags || {}).length > 0
            : false
    )
  );
}

function getMissingTagsForItem(item, state, category) {
  if (category === "story" && item.id) {
    return state[item.id] ? [] : [item.id];
  }

  const missing = [];

  if (item.requiredTags) {
    item.requiredTags.forEach(tag => {
      if (!state[tag]) missing.push(tag);
    });
  }

  const optionalCount = item.optionalTags
    ? item.optionalTags.filter(tag => state[tag]).length
    : 0;
  const optionalNeeded = item.optionalRequired || 0;

  if (missing.length > 0) {
    return missing;
  }

  if (optionalCount < optionalNeeded && item.optionalTags) {
    const missingOptional = item.optionalTags.filter(tag => !state[tag]);
    missing.push(...missingOptional.slice(0, optionalNeeded - optionalCount));
  }

  return missing;
}

function collectMissingTags(properties, avatars, stories, tagState) {
  return [...new Set([
    ...properties.flatMap(item => getMissingTagsForItem(item, tagState.properties, "properties")),
    ...avatars.flatMap(item => getMissingTagsForItem(item, tagState.avatar, "avatar"))
  ])];
}

function getWeight(q, missingTags, askedQuestions, boostedQuestionId, askedClusters, requiredTypes) {
  if (askedQuestions.includes(q.id)) return 0;
  if (requiredTypes.length && !hasAnswerType(q, requiredTypes)) return 0;

  let weight = 1 + (q.priority || 0);
  if (q.id === boostedQuestionId) weight += 10;
  if (!askedClusters.has(q.cluster)) weight += 5;

  q.answers.forEach(ans => {
    const allTags = {
      ...ans.propertyTags,
      ...ans.avatarTags,
      ...ans.storyTags
    };
    Object.keys(allTags).forEach(tag => {
      if (missingTags.includes(tag)) weight += 25;
    });
  });

  return weight;
}

function pickQuestion(scored) {
  const total = scored.reduce((sum, s) => sum + s.weight, 0);
  if (total <= 0) return scored[0]?.q;

  let rand = Math.random() * total;
  let acc = 0;

  for (const s of scored) {
    acc += s.weight;
    if (rand <= acc) return s.q;
  }

  return scored[0]?.q;
}

function getAchievedItems(items, state, category = "properties") {
  return items
    .filter(item => getMissingTagsForItem(item, state, category).length === 0)
    .map(item => item.name);
}

function getAlmostItems(items, state, category = "properties") {
  return items
    .filter(item => getMissingTagsForItem(item, state, category).length === 1)
    .map(item => item.name);
}

function calculatePercentages(stats, runs) {
  let totals = {
    questions: runs * (tagRequirements?.totalQuestions || 7),
    tags: 0,
    properties: Object.values(stats.properties).reduce((a, b) => a + b, 0),
    avatars: Object.values(stats.avatars).reduce((a, b) => a + b, 0)
  };

  Object.values(stats.tags).forEach(categoryObj => {
    totals.tags += Object.values(categoryObj).reduce((a, b) => a + b, 0);
  });

  let percentages = {
    questions: {},
    tags: {},
    properties: {},
    avatars: {}
  };

  Object.entries(stats.questions).forEach(([key, val]) => {
    percentages.questions[key] = (val / totals.questions) * 100;
  });

  Object.entries(stats.tags).forEach(([category, tagsObj]) => {
    percentages.tags[category] = {};
    Object.entries(tagsObj).forEach(([tag, val]) => {
      percentages.tags[category][tag] = (val / totals.tags) * 100;
    });
  });

  Object.entries(stats.properties).forEach(([key, val]) => {
    percentages.properties[key] = (val / totals.properties) * 100;
  });

  Object.entries(stats.avatars).forEach(([key, val]) => {
    percentages.avatars[key] = (val / totals.avatars) * 100;
  });

  return percentages;
}

function exportResults(resultState) {
  const exportData = {
    tags: resultState.tags,
    properties: resultState.properties,
    avatar: resultState.avatar,
    story: resultState.story
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const exportFileDefaultName = 'results.json';

  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}
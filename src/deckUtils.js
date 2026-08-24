export const FORMAT_VERSION = 1;

export const CHOICE_MODES = {
  ALL: "all",
  RANDOM: "random",
  FIXED: "fixed"
};

export const PRONUNCIATION_SIDES = {
  FRONT: "front"
};

export const DEFAULT_PRONUNCIATION_SETTINGS = {
  enabled: false,
  language: "",
  side: PRONUNCIATION_SIDES.FRONT,
  autoPlay: false
};

export const DEFAULT_STUDY_SETTINGS = {
  choiceMode: CHOICE_MODES.ALL,
  choiceCount: 4,
  choices: [],
  shuffleChoices: true,
  pronunciation: DEFAULT_PRONUNCIATION_SETTINGS
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);

const isPlausibleLanguageTag = (value) =>
  /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value);

const cleanText = (value, label) => {
  if (!["string", "number", "boolean"].includes(typeof value)) {
    throw new Error(label + " must be text.");
  }

  const cleaned = String(value).trim();
  if (!cleaned) {
    throw new Error(label + " cannot be empty.");
  }

  return cleaned;
};

export const uniqueStrings = (values) => {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    if (!["string", "number", "boolean"].includes(typeof value)) return;
    const cleaned = String(value).trim();
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    result.push(cleaned);
  });

  return result;
};

const OPTIONAL_DECK_TEXT_FIELDS = [
  "description",
  "attribution",
  "license",
  "licenseUrl"
];

export const getDeckMetadata = (value) => {
  if (!isRecord(value)) return {};

  const metadata = {};

  OPTIONAL_DECK_TEXT_FIELDS.forEach((field) => {
    if (typeof value[field] !== "string") return;
    const cleaned = value[field].trim();
    if (cleaned) metadata[field] = cleaned;
  });

  if (typeof value.source === "string" && value.source.trim()) {
    metadata.source = value.source.trim();
  }

  if (Array.isArray(value.sources)) {
    const sources = uniqueStrings(value.sources);
    if (sources.length > 0) metadata.sources = sources;
  }

  return metadata;
};

export const normalizeCards = (rawCards) => {
  let cards;

  if (Array.isArray(rawCards)) {
    cards = rawCards.map((card, index) => {
      if (Array.isArray(card) && card.length >= 2) {
        return {
          front: cleanText(card[0], "Card " + (index + 1) + " front"),
          back: cleanText(card[1], "Card " + (index + 1) + " back")
        };
      }

      if (!isRecord(card)) {
        throw new Error("Card " + (index + 1) + " must be an object.");
      }

      const front = hasOwn(card, "front") ? card.front : card.key;
      const back = hasOwn(card, "back") ? card.back : card.value;

      return {
        front: cleanText(front, "Card " + (index + 1) + " front"),
        back: cleanText(back, "Card " + (index + 1) + " back")
      };
    });
  } else if (isRecord(rawCards)) {
    cards = Object.entries(rawCards).map(([front, back], index) => ({
      front: cleanText(front, "Card " + (index + 1) + " front"),
      back: cleanText(back, "Card " + (index + 1) + " back")
    }));
  } else {
    throw new Error("Cards must be a front-to-back object or an array.");
  }

  if (cards.length === 0) {
    throw new Error("A deck must contain at least one card.");
  }

  return cards;
};

export const normalizeStudySettings = (rawStudy = {}) => {
  const candidate = isRecord(rawStudy) ? rawStudy : {};
  const validModes = Object.values(CHOICE_MODES);
  const choiceMode = validModes.includes(candidate.choiceMode)
    ? candidate.choiceMode
    : DEFAULT_STUDY_SETTINGS.choiceMode;
  const parsedCount = Number(candidate.choiceCount);
  const choiceCount =
    Number.isInteger(parsedCount) && parsedCount >= 2
      ? parsedCount
      : DEFAULT_STUDY_SETTINGS.choiceCount;
  const rawChoices = Array.isArray(candidate.choices)
    ? candidate.choices
    : Array.isArray(candidate.fixedChoices)
      ? candidate.fixedChoices
      : [];
  const pronunciationCandidate = isRecord(candidate.pronunciation)
    ? candidate.pronunciation
    : {};
  const pronunciation = {
    enabled:
      typeof pronunciationCandidate.enabled === "boolean"
        ? pronunciationCandidate.enabled
        : DEFAULT_PRONUNCIATION_SETTINGS.enabled,
    language:
      typeof pronunciationCandidate.language === "string"
        ? pronunciationCandidate.language.trim()
        : DEFAULT_PRONUNCIATION_SETTINGS.language,
    side: Object.values(PRONUNCIATION_SIDES).includes(
      pronunciationCandidate.side
    )
      ? pronunciationCandidate.side
      : DEFAULT_PRONUNCIATION_SETTINGS.side,
    autoPlay:
      typeof pronunciationCandidate.autoPlay === "boolean"
        ? pronunciationCandidate.autoPlay
        : DEFAULT_PRONUNCIATION_SETTINGS.autoPlay
  };

  return {
    choiceMode,
    choiceCount,
    choices: uniqueStrings(rawChoices),
    shuffleChoices:
      typeof candidate.shuffleChoices === "boolean"
        ? candidate.shuffleChoices
        : DEFAULT_STUDY_SETTINGS.shuffleChoices,
    pronunciation
  };
};

export const isDeckEnvelope = (value) =>
  isRecord(value) &&
  hasOwn(value, "cards") &&
  (Array.isArray(value.cards) || isRecord(value.cards));

export const normalizeDeck = (rawDeck, fallback = {}) => {
  const envelope = isDeckEnvelope(rawDeck);
  const declaredVersion = envelope
    ? rawDeck.formatVersion ?? rawDeck.version
    : undefined;

  if (declaredVersion !== undefined) {
    const parsedVersion = Number(declaredVersion);
    if (!Number.isInteger(parsedVersion) || parsedVersion < 1) {
      throw new Error("Deck format version must be a positive whole number.");
    }
    if (parsedVersion > FORMAT_VERSION) {
      throw new Error(
        "This deck uses unsupported format version " + parsedVersion + "."
      );
    }
  }

  const cards = normalizeCards(envelope ? rawDeck.cards : rawDeck);
  const rawTitle =
    envelope && typeof rawDeck.title === "string"
      ? rawDeck.title.trim()
      : "";
  const fallbackTitle =
    typeof fallback.title === "string" ? fallback.title.trim() : "";
  const explicitStudy = envelope
    ? rawDeck.study ?? rawDeck.settings
    : undefined;

  if (explicitStudy !== undefined && !isRecord(explicitStudy)) {
    throw new Error("Deck study settings must be an object.");
  }

  const studySource = explicitStudy ?? fallback.study;
  const study = normalizeStudySettings(studySource);

  if (explicitStudy !== undefined) {
    const studyError = validateStudySettings(cards, explicitStudy);
    if (studyError) throw new Error(studyError);
  }

  return {
    formatVersion: FORMAT_VERSION,
    title: rawTitle || fallbackTitle,
    cards,
    study,
    ...getDeckMetadata(envelope ? rawDeck : {})
  };
};

export const validateStudySettings = (cards, rawStudy = {}) => {
  if (!Array.isArray(cards) || cards.length === 0) {
    return "Add at least one card.";
  }

  if (!isRecord(rawStudy)) {
    return "Answer-choice settings must be an object.";
  }

  const requestedMode = rawStudy && rawStudy.choiceMode;
  if (
    requestedMode !== undefined &&
    !Object.values(CHOICE_MODES).includes(requestedMode)
  ) {
    return "Choose a valid answer-choice mode.";
  }

  if (hasOwn(rawStudy, "choiceCount")) {
    const requestedCount = Number(rawStudy.choiceCount);
    if (!Number.isInteger(requestedCount) || requestedCount < 2) {
      return "Choices per card must be a whole number of at least 2.";
    }
  }

  if (hasOwn(rawStudy, "choices") && !Array.isArray(rawStudy.choices)) {
    return "Fixed choices must be a list.";
  }

  if (
    hasOwn(rawStudy, "shuffleChoices") &&
    typeof rawStudy.shuffleChoices !== "boolean"
  ) {
    return "Shuffle choices must be true or false.";
  }

  if (
    hasOwn(rawStudy, "pronunciation") &&
    !isRecord(rawStudy.pronunciation)
  ) {
    return "Pronunciation settings must be an object.";
  }

  if (isRecord(rawStudy.pronunciation)) {
    const pronunciation = rawStudy.pronunciation;

    if (
      hasOwn(pronunciation, "enabled") &&
      typeof pronunciation.enabled !== "boolean"
    ) {
      return "Pronunciation enabled must be true or false.";
    }

    if (
      hasOwn(pronunciation, "language") &&
      typeof pronunciation.language !== "string"
    ) {
      return "Pronunciation language must be text.";
    }

    if (
      hasOwn(pronunciation, "side") &&
      !Object.values(PRONUNCIATION_SIDES).includes(pronunciation.side)
    ) {
      return "Pronunciation side must be front.";
    }

    if (
      hasOwn(pronunciation, "autoPlay") &&
      typeof pronunciation.autoPlay !== "boolean"
    ) {
      return "Pronunciation autoplay must be true or false.";
    }

    if (pronunciation.enabled === true) {
      const language =
        typeof pronunciation.language === "string"
          ? pronunciation.language.trim()
          : "";

      if (!language || !isPlausibleLanguageTag(language)) {
        return "Enabled pronunciation needs a valid language tag, such as pt-BR.";
      }

      const side = pronunciation.side ?? DEFAULT_PRONUNCIATION_SETTINGS.side;
      if (!Object.values(PRONUNCIATION_SIDES).includes(side)) {
        return "Pronunciation side must be front.";
      }
    }
  }

  const study = normalizeStudySettings(rawStudy);
  if (study.choiceMode !== CHOICE_MODES.FIXED) return null;

  if (study.choices.length < 2) {
    return "Add at least two unique fixed choices.";
  }

  let normalizedCards;
  try {
    normalizedCards = normalizeCards(cards);
  } catch (error) {
    return error.message;
  }

  const missingAnswers = uniqueStrings(
    normalizedCards
      .map((card) => card.back)
      .filter((answer) => !study.choices.includes(answer))
  );

  if (missingAnswers.length > 0) {
    return (
      "Fixed choices are missing these answers: " +
      missingAnswers.join(", ")
    );
  }

  return null;
};

export const shuffleArray = (items, random = Math.random) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = random();
    const boundedValue = Number.isFinite(randomValue)
      ? Math.min(Math.max(randomValue, 0), 0.999999999999)
      : 0;
    const swapIndex = Math.floor(boundedValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index]
    ];
  }

  return shuffled;
};

export const buildStudyOptions = (
  cards,
  currentCard,
  rawStudy,
  random = Math.random
) => {
  if (!currentCard) return [];

  const normalizedCards = normalizeCards(cards);
  const correctAnswer = cleanText(
    hasOwn(currentCard, "back") ? currentCard.back : currentCard.value,
    "Correct answer"
  );
  const allAnswers = uniqueStrings(
    normalizedCards.map((card) => card.back)
  );
  const study = normalizeStudySettings(rawStudy);
  let options;

  if (study.choiceMode === CHOICE_MODES.FIXED) {
    options = [...study.choices];
  } else if (study.choiceMode === CHOICE_MODES.RANDOM) {
    const distractors = allAnswers.filter(
      (answer) => answer !== correctAnswer
    );
    const selectedDistractors = shuffleArray(distractors, random).slice(
      0,
      Math.max(0, study.choiceCount - 1)
    );
    const selected = new Set([correctAnswer, ...selectedDistractors]);
    options = allAnswers.filter((answer) => selected.has(answer));

    if (!options.includes(correctAnswer)) {
      options.push(correctAnswer);
    }
  } else {
    options = allAnswers;
  }

  return study.shuffleChoices ? shuffleArray(options, random) : options;
};

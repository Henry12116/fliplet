import {
  buildStudyOptions,
  CHOICE_MODES,
  DEFAULT_PRONUNCIATION_SETTINGS,
  FORMAT_VERSION,
  normalizeDeck,
  normalizeCards,
  PRONUNCIATION_SIDES,
  validateStudySettings
} from "./deckUtils";

const cards = [
  { front: "one", back: "Hit" },
  { front: "two", back: "Stand" },
  { front: "three", back: "Stand" },
  { front: "four", back: "Double" },
  { front: "five", back: "Split" }
];

test("normalizes compact object maps and legacy key/value cards", () => {
  expect(normalizeCards({ casa: "house", perro: "dog" })).toEqual([
    { front: "casa", back: "house" },
    { front: "perro", back: "dog" }
  ]);

  expect(normalizeCards([{ key: "front", value: "back" }])).toEqual([
    { front: "front", back: "back" }
  ]);
});

test("legacy decks default to all unique answers", () => {
  const deck = normalizeDeck({
    title: "Legacy",
    cards: [{ key: "question", value: "answer" }]
  });

  expect(deck.study.choiceMode).toBe(CHOICE_MODES.ALL);
  expect(deck.study.pronunciation).toEqual(
    DEFAULT_PRONUNCIATION_SETTINGS
  );
  expect(deck.cards[0]).toEqual({ front: "question", back: "answer" });
});

test("normalizes explicit pronunciation settings", () => {
  const deck = normalizeDeck({
    formatVersion: FORMAT_VERSION,
    cards: { casa: "house" },
    study: {
      pronunciation: {
        enabled: true,
        language: " pt-BR ",
        side: PRONUNCIATION_SIDES.FRONT,
        autoPlay: true,
        offlineOnly: false
      }
    }
  });

  expect(deck.formatVersion).toBe(1);
  expect(deck.study.pronunciation).toEqual({
    enabled: true,
    language: "pt-BR",
    side: "front",
    autoPlay: true,
    offlineOnly: false
  });
});

test("preserves supported description, source, and license metadata", () => {
  const deck = normalizeDeck({
    formatVersion: 1,
    title: "Licensed deck",
    description: " A useful deck. ",
    attribution: " Example Author ",
    source: " https://example.com/source ",
    sources: ["https://example.com/one", "https://example.com/one", ""],
    license: " CC BY-SA 4.0 ",
    licenseUrl: " https://creativecommons.org/licenses/by-sa/4.0/ ",
    cards: { Question: "Answer" }
  });

  expect(deck).toMatchObject({
    description: "A useful deck.",
    attribution: "Example Author",
    source: "https://example.com/source",
    sources: ["https://example.com/one"],
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/"
  });
});

test("validates explicit pronunciation fields strictly", () => {
  const makeDeck = (pronunciation) => ({
    formatVersion: 1,
    cards: { casa: "house" },
    study: { pronunciation }
  });

  expect(() => normalizeDeck(makeDeck(true))).toThrow(
    /pronunciation settings must be an object/i
  );
  expect(() =>
    normalizeDeck(makeDeck({ enabled: "true" }))
  ).toThrow(/enabled must be true or false/i);
  expect(() =>
    normalizeDeck(makeDeck({ language: 123 }))
  ).toThrow(/language must be text/i);
  expect(() =>
    normalizeDeck(makeDeck({ side: "back" }))
  ).toThrow(/side must be front/i);
  expect(() =>
    normalizeDeck(makeDeck({ autoPlay: "yes" }))
  ).toThrow(/autoplay must be true or false/i);
  expect(() =>
    normalizeDeck(makeDeck({ offlineOnly: 1 }))
  ).toThrow(/offline-only pronunciation must be true or false/i);
});

test("enabled pronunciation requires a plausible language tag", () => {
  const makeDeck = (language) => ({
    formatVersion: 1,
    cards: { casa: "house" },
    study: {
      pronunciation: { enabled: true, language }
    }
  });

  expect(() => normalizeDeck(makeDeck(""))).toThrow(
    /valid language tag/i
  );
  expect(() => normalizeDeck(makeDeck("portuguese"))).toThrow(
    /valid language tag/i
  );
  expect(normalizeDeck(makeDeck("pt-BR")).study.pronunciation).toMatchObject({
    enabled: true,
    language: "pt-BR",
    side: PRONUNCIATION_SIDES.FRONT
  });
});

test("recognizes cards-only envelopes without stealing scalar compact keys", () => {
  expect(
    normalizeDeck(
      { cards: { Question: "Answer" } },
      { title: "Fallback" }
    )
  ).toMatchObject({
    title: "Fallback",
    cards: [{ front: "Question", back: "Answer" }]
  });

  expect(
    normalizeDeck({ cards: "tarjetas", title: "título" }).cards
  ).toEqual([
    { front: "cards", back: "tarjetas" },
    { front: "title", back: "título" }
  ]);
});

test("preserves fallback study settings when an envelope omits them", () => {
  const deck = normalizeDeck(
    { title: "Imported", cards: { Question: "Answer" } },
    {
      study: {
        choiceMode: CHOICE_MODES.RANDOM,
        choiceCount: 3,
        shuffleChoices: false
      }
    }
  );

  expect(deck.study).toMatchObject({
    choiceMode: CHOICE_MODES.RANDOM,
    choiceCount: 3,
    shuffleChoices: false
  });
});

test("rejects unsupported versions and invalid explicit study settings", () => {
  expect(() =>
    normalizeDeck({
      formatVersion: 2,
      cards: { Question: "Answer" }
    })
  ).toThrow(/unsupported format version 2/i);

  expect(() =>
    normalizeDeck({
      formatVersion: 1,
      cards: { One: "A", Two: "B" },
      study: { choiceMode: "randmo", choiceCount: 1 }
    })
  ).toThrow(/valid answer-choice mode/i);

  expect(() =>
    normalizeDeck({
      formatVersion: 1,
      cards: { One: "A", Two: "B" },
      study: []
    })
  ).toThrow(/settings must be an object/i);

  expect(() =>
    normalizeDeck({
      formatVersion: 1,
      cards: { One: "A", Two: "B" },
      study: { choiceMode: "all", shuffleChoices: "false" }
    })
  ).toThrow(/must be true or false/i);
});

test("random mode always returns unique choices containing the answer", () => {
  const options = buildStudyOptions(
    cards,
    cards[1],
    {
      choiceMode: CHOICE_MODES.RANDOM,
      choiceCount: 3,
      shuffleChoices: false
    },
    () => 0
  );

  expect(options).toHaveLength(3);
  expect(new Set(options).size).toBe(3);
  expect(options).toContain("Stand");
});

test("random mode clamps to the number of unique deck answers", () => {
  const options = buildStudyOptions(
    cards,
    cards[0],
    {
      choiceMode: CHOICE_MODES.RANDOM,
      choiceCount: 20,
      shuffleChoices: false
    },
    () => 0
  );

  expect(options).toEqual(["Hit", "Stand", "Double", "Split"]);
});

test("fixed mode requires every correct answer to be available", () => {
  expect(
    validateStudySettings(cards, {
      choiceMode: CHOICE_MODES.FIXED,
      choices: ["Hit", "Stand"],
      shuffleChoices: false
    })
  ).toMatch(/Double, Split/);

  expect(
    validateStudySettings(cards, {
      choiceMode: CHOICE_MODES.FIXED,
      choices: ["Hit", "Stand", "Double", "Split"],
      shuffleChoices: false
    })
  ).toBeNull();
});

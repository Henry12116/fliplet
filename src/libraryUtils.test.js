import {
  BUNDLED_DECK_ID,
  buildSetLibrary,
  bundledDecks,
  getPersonalSets,
  getUniqueDeckAdditions,
  isBundledDeck,
  PERSONAL_DECK_FLAG
} from "./libraryUtils";

test("loads every repository deck as a normalized built-in", () => {
  const ids = bundledDecks.map((deck) => deck[BUNDLED_DECK_ID]);

  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual([...ids].sort());
  expect(bundledDecks.every(isBundledDeck)).toBe(true);
  expect(
    bundledDecks.every(
      (deck) => deck.title && Array.isArray(deck.cards) && deck.cards.length > 0
    )
  ).toBe(true);

  const portuguese = bundledDecks.find(
    (deck) => deck.study.pronunciation.language === "pt-BR"
  );
  expect(portuguese.study.pronunciation).toMatchObject({
    enabled: true,
    language: "pt-BR",
    offlineOnly: true
  });
  expect(portuguese).toMatchObject({
    license: "CC BY-SA 4.0",
    attribution: expect.any(String)
  });
});

test("adds personal sets without duplicating a legacy imported built-in", () => {
  const legacyBuiltInCopy = {
    formatVersion: bundledDecks[0].formatVersion,
    title: bundledDecks[0].title,
    cards: bundledDecks[0].cards,
    study: bundledDecks[0].study
  };
  const personal = {
    title: "My deck",
    cards: { Question: "Answer" }
  };

  const library = buildSetLibrary([legacyBuiltInCopy, personal]);

  expect(library).toHaveLength(bundledDecks.length + 1);
  expect(library.filter((deck) => deck.title === bundledDecks[0].title)).toHaveLength(1);
  expect(library[library.length - 1].title).toBe("My deck");
});

test("preserves intentionally duplicated personal sets", () => {
  const personal = { title: "Copy", cards: { Front: "Back" } };
  const library = buildSetLibrary([personal, personal]);

  expect(library.filter((deck) => deck.title === "Copy")).toHaveLength(2);
});

test("preserves a same-content personal deck with customized metadata", () => {
  const customized = JSON.parse(JSON.stringify(bundledDecks[0]));
  delete customized[BUNDLED_DECK_ID];
  customized.description = "My personal notes";

  const library = buildSetLibrary([customized]);

  expect(
    library.filter((deck) => deck.title === bundledDecks[0].title)
  ).toHaveLength(2);
  expect(library[library.length - 1].description).toBe("My personal notes");
});

test("persists personal decks only", () => {
  const personalLibrary = buildSetLibrary([
    { title: "Mine", cards: { Front: "Back" } }
  ]);
  const personal = personalLibrary[personalLibrary.length - 1];

  expect(getPersonalSets([...bundledDecks, personal])).toEqual([personal]);
});

test("filters duplicates while keeping distinct uploaded decks", () => {
  const existing = buildSetLibrary([]);
  const duplicate = { ...bundledDecks[0] };
  delete duplicate[BUNDLED_DECK_ID];
  const additionLibrary = buildSetLibrary([
    { title: "Uploaded", cards: { Front: "Back" } }
  ]);
  const addition = additionLibrary[additionLibrary.length - 1];

  expect(getUniqueDeckAdditions(existing, [duplicate, addition])).toEqual([
    addition
  ]);
});

test("keeps a newly uploaded metadata-less built-in copy after reload", () => {
  const builtIn = bundledDecks[0];
  const uploadedCopy = {
    formatVersion: builtIn.formatVersion,
    title: builtIn.title,
    cards: builtIn.cards,
    study: builtIn.study
  };
  const additions = getUniqueDeckAdditions(bundledDecks, [uploadedCopy]);
  const savedSets = getPersonalSets([...bundledDecks, ...additions]);
  const reloaded = buildSetLibrary(savedSets);

  expect(additions).toHaveLength(1);
  expect(savedSets[0][PERSONAL_DECK_FLAG]).toBe(true);
  expect(
    reloaded.filter((deck) => deck.title === builtIn.title)
  ).toHaveLength(2);
});

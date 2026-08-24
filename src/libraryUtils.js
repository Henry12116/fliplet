import generatedBundledDecks from "./generated/bundledDecks.json";
import { getDeckMetadata, normalizeDeck } from "./deckUtils";

export const BUNDLED_DECK_ID = "bundledDeckId";
export const PERSONAL_DECK_FLAG = "personalDeck";

const fallbackTitleFromId = (id) => {
  const filename = String(id || "deck")
    .split("/")
    .pop()
    .replace(/\.json$/i, "");

  return filename
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const normalizeBundledDecks = (entries = generatedBundledDecks) =>
  entries.map((entry) => ({
    ...normalizeDeck(entry.deck, {
      title: fallbackTitleFromId(entry.id)
    }),
    [BUNDLED_DECK_ID]: entry.id
  }));

export const bundledDecks = normalizeBundledDecks();

export const isBundledDeck = (deck) =>
  Boolean(
    deck &&
      typeof deck[BUNDLED_DECK_ID] === "string" &&
      deck[BUNDLED_DECK_ID]
  );

const deckCoreFingerprint = (deck) =>
  JSON.stringify({
    title: deck.title,
    cards: deck.cards,
    study: deck.study
  });

export const deckFingerprint = (deck) =>
  JSON.stringify({
    core: deckCoreFingerprint(deck),
    metadata: getDeckMetadata(deck)
  });

export const buildSetLibrary = (
  savedSets = [],
  bundledEntries = generatedBundledDecks
) => {
  const builtIns = normalizeBundledDecks(bundledEntries);
  const builtInFingerprints = new Set(builtIns.map(deckFingerprint));
  const builtInCoreFingerprints = new Set(
    builtIns.map(deckCoreFingerprint)
  );
  const personalSets = savedSets
    .map((set, index) => ({
      deck: normalizeDeck(set, { title: "Set " + (index + 1) }),
      explicitlyPersonal: set?.[PERSONAL_DECK_FLAG] === true
    }))
    .filter(({ deck, explicitlyPersonal }) => {
      if (explicitlyPersonal) return true;
      if (builtInFingerprints.has(deckFingerprint(deck))) return false;

      const hasMetadata = Object.keys(getDeckMetadata(deck)).length > 0;
      return hasMetadata || !builtInCoreFingerprints.has(deckCoreFingerprint(deck));
    })
    .map(({ deck }) => ({ ...deck, [PERSONAL_DECK_FLAG]: true }));

  return [...builtIns, ...personalSets];
};

export const getPersonalSets = (sets) =>
  sets
    .filter((set) => !isBundledDeck(set))
    .map((set) => ({ ...set, [PERSONAL_DECK_FLAG]: true }));

export const getUniqueDeckAdditions = (sets, additions) => {
  const fingerprints = new Set(sets.map(deckFingerprint));

  return additions.filter((deck) => {
    const fingerprint = deckFingerprint(deck);
    if (fingerprints.has(fingerprint)) return false;
    fingerprints.add(fingerprint);
    return true;
  });
};

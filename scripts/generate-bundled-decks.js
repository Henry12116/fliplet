const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "..");
const decksDirectory = path.join(repositoryRoot, "decks");
const outputFile = path.join(
  repositoryRoot,
  "src",
  "generated",
  "bundledDecks.json"
);

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function findJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return findJsonFiles(entryPath);
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".json") {
      return [entryPath];
    }

    return [];
  });
}

function validateDeck(deck, id) {
  if (!isRecord(deck)) {
    throw new Error("Deck must be a JSON object.");
  }

  if (typeof deck.title !== "string" || !deck.title.trim()) {
    throw new Error("Deck title must be non-empty text.");
  }

  if (deck.formatVersion !== undefined) {
    const version = Number(deck.formatVersion);

    if (!Number.isInteger(version) || version < 1) {
      throw new Error("Deck formatVersion must be a positive whole number.");
    }

    if (version > 1) {
      throw new Error(`Deck formatVersion ${version} is not supported.`);
    }
  }

  const cardsAreArray = Array.isArray(deck.cards);
  const cardsAreObject = isRecord(deck.cards);

  if (!cardsAreArray && !cardsAreObject) {
    throw new Error("Deck cards must be an array or front-to-back object.");
  }

  const cardCount = cardsAreArray
    ? deck.cards.length
    : Object.keys(deck.cards).length;

  if (cardCount === 0) {
    throw new Error("Deck must contain at least one card.");
  }

  if (deck.study !== undefined && !isRecord(deck.study)) {
    throw new Error("Deck study settings must be an object when provided.");
  }

  return {
    id,
    deck
  };
}

function generateBundledDecks() {
  const jsonFiles = findJsonFiles(decksDirectory)
    .map((filePath) => ({
      filePath,
      id: path.relative(decksDirectory, filePath).split(path.sep).join("/")
    }))
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    );

  if (jsonFiles.length === 0) {
    throw new Error(
      `No JSON deck files were found under ${decksDirectory}.`
    );
  }

  const bundledDecks = jsonFiles.map(({ filePath, id }) => {
    let deck;

    try {
      const contents = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
      deck = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Could not parse decks/${id}: ${error.message}`);
    }

    try {
      return validateDeck(deck, id);
    } catch (error) {
      throw new Error(`Invalid deck decks/${id}: ${error.message}`);
    }
  });

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(bundledDecks, null, 2)}\n`,
    "utf8"
  );

  console.log(
    `Generated ${path.relative(repositoryRoot, outputFile)} with ${bundledDecks.length} decks.`
  );
}

try {
  generateBundledDecks();
} catch (error) {
  console.error(`Deck generation failed: ${error.message}`);
  process.exitCode = 1;
}

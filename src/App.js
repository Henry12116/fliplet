import React, { useCallback, useState, useEffect } from "react";
import {
  buildStudyOptions,
  CHOICE_MODES,
  DEFAULT_PRONUNCIATION_SETTINGS,
  DEFAULT_STUDY_SETTINGS,
  getDeckMetadata,
  isDeckEnvelope,
  normalizeDeck,
  normalizeStudySettings,
  shuffleArray,
  validateStudySettings
} from "./deckUtils";
import {
  buildSetLibrary,
  getPersonalSets,
  isBundledDeck
} from "./libraryUtils";
import { findPronunciationVoice, prepareSpeechText } from "./speechUtils";

const createDefaultStudySettings = () => ({
  ...DEFAULT_STUDY_SETTINGS,
  choiceMode: CHOICE_MODES.RANDOM,
  choices: [],
  pronunciation: { ...DEFAULT_PRONUNCIATION_SETTINGS }
});

const hasDeckDetails = (deck) =>
  Boolean(
    deck.description ||
      deck.attribution ||
      deck.source ||
      deck.sources?.length ||
      deck.license ||
      deck.licenseUrl
  );

const formatDeckDetails = (deck) => {
  const details = [deck.title];

  if (deck.description) details.push(deck.description);
  if (deck.attribution) details.push("Attribution: " + deck.attribution);
  if (deck.source) details.push("Source: " + deck.source);
  if (deck.sources?.length) {
    details.push("Sources:\n" + deck.sources.join("\n"));
  }
  if (deck.license || deck.licenseUrl) {
    const licenseDetails = [];
    if (deck.license) licenseDetails.push("License: " + deck.license);
    if (deck.licenseUrl) licenseDetails.push(deck.licenseUrl);
    details.push(licenseDetails.join("\n"));
  }

  return details.join("\n\n");
};

function App() {
  const [sets, setSets] = useState(() => buildSetLibrary([]));
  const [initialized, setInitialized] = useState(false);
  const [currentSet, setCurrentSet] = useState(null);
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [studyMode, setStudyMode] = useState(false);
  const [queue, setQueue] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [studyOptions, setStudyOptions] = useState([]);
  const [modalMessage, setModalMessage] = useState("");
  const [editingSetIndex, setEditingSetIndex] = useState(null);
  const [editingMetadata, setEditingMetadata] = useState({});
  const [studySettings, setStudySettings] = useState(
    createDefaultStudySettings
  );
  const [speechVoices, setSpeechVoices] = useState([]);
  const [speechVoicesLoaded, setSpeechVoicesLoaded] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState(() =>
    typeof window !== "undefined" && window.__flipletOfflineStatus
      ? window.__flipletOfflineStatus
      : { status: "preparing", message: "" }
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.speechSynthesis ||
      typeof window.speechSynthesis.getVoices !== "function"
    ) {
      return undefined;
    }

    const speechSynthesis = window.speechSynthesis;
    const updateVoices = () => {
      setSpeechVoices(Array.from(speechSynthesis.getVoices() || []));
      setSpeechVoicesLoaded(true);
    };

    updateVoices();
    if (typeof speechSynthesis.addEventListener === "function") {
      speechSynthesis.addEventListener("voiceschanged", updateVoices);
      return () =>
        speechSynthesis.removeEventListener("voiceschanged", updateVoices);
    }

    const previousHandler = speechSynthesis.onvoiceschanged;
    speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      speechSynthesis.onvoiceschanged = previousHandler;
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || typeof window === "undefined") {
      return undefined;
    }

    const updateOfflineStatus = (event) => setOfflineStatus(event.detail);
    if (window.__flipletOfflineStatus) {
      setOfflineStatus(window.__flipletOfflineStatus);
    }
    window.addEventListener("fliplet-offline-status", updateOfflineStatus);

    return () =>
      window.removeEventListener("fliplet-offline-status", updateOfflineStatus);
  }, []);

  // Load sets from localStorage once
  useEffect(() => {
    const savedSets = localStorage.getItem("flashcardSets");
    if (savedSets) {
      try {
        const parsedSets = JSON.parse(savedSets);
        if (!Array.isArray(parsedSets)) {
          throw new Error("Saved flashcard data must be a list of sets.");
        }

        setSets(buildSetLibrary(parsedSets));
      } catch (error) {
        setModalMessage({
          text:
            "Fliplet could not load the saved sets: " + error.message +
            "\n\nBack up the unreadable data and reset saved sets?",
          confirmLabel: "Back up and reset",
          cancelLabel: "Keep data",
          onConfirm: () => {
            try {
              localStorage.setItem("flashcardSetsBackup", savedSets);
              localStorage.removeItem("flashcardSets");
              setSets(buildSetLibrary([]));
              setInitialized(true);
              setModalMessage(
                "The unreadable data was preserved as flashcardSetsBackup. " +
                  "You can create and save sets again."
              );
            } catch (storageError) {
              setModalMessage(
                "The saved data could not be backed up or reset: " +
                  storageError.message
              );
            }
          }
        });
        return;
      }
    } else {
      setSets(buildSetLibrary([]));
    }
    setInitialized(true);
  }, []);

  // Save sets whenever updated
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(
        "flashcardSets",
        JSON.stringify(getPersonalSets(sets))
      );
    }
  }, [sets, initialized]);

  const resetEditor = () => {
    setTitle("");
    setCards([]);
    setNewKey("");
    setNewValue("");
    setEditingSetIndex(null);
    setEditingMetadata({});
    setStudySettings(createDefaultStudySettings());
  };

  const openCreateSet = () => {
    resetEditor();
    setCurrentSet("new");
  };

  const closeEditor = () => {
    resetEditor();
    setCurrentSet(null);
    setStudyMode(false);
  };

  const createSet = () => {
    if (!initialized) {
      setModalMessage(
        "Saving is disabled while unreadable saved data is being preserved. " +
          "Reload Fliplet and choose “Back up and reset” to continue."
      );
      return;
    }

    if (!title.trim() || cards.length === 0) {
      setModalMessage("Please add a title and at least one card before saving.");
      return;
    }

    const settingsError = validateStudySettings(cards, studySettings);
    if (settingsError) {
      setModalMessage(settingsError);
      return;
    }

    const savedSet = {
      ...editingMetadata,
      formatVersion: 1,
      title: title.trim(),
      cards: [...cards],
      study: normalizeStudySettings(studySettings)
    };
    const wasEditing = editingSetIndex !== null;

    setSets((prev) =>
      wasEditing
        ? prev.map((set, index) =>
            index === editingSetIndex ? savedSet : set
          )
        : [...prev, savedSet]
    );
    resetEditor();
    setCurrentSet(null);
    setModalMessage(
      wasEditing ? "Set updated successfully!" : "Set saved successfully!"
    );
  };

  const addCard = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setCards((prev) => [
      ...prev,
      { front: newKey.trim(), back: newValue.trim() }
    ]);
    setNewKey("");
    setNewValue("");
  };

  // Import JSON from file
  const importFromFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedCards = JSON.parse(e.target.result);
        const importedDeck = normalizeDeck(importedCards, {
          title,
          study: studySettings
        });

        setCards(importedDeck.cards);
        if (isDeckEnvelope(importedCards)) {
          if (importedDeck.title) setTitle(importedDeck.title);
          setStudySettings(importedDeck.study);
          setEditingMetadata(getDeckMetadata(importedDeck));
        }
        setModalMessage(
          "Imported " + importedDeck.cards.length + " cards successfully."
        );
      } catch (err) {
        setModalMessage("Could not import JSON: " + err.message);
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const startStudy = (setIndex) => {
    const set = sets[setIndex];
    const settingsError = validateStudySettings(set.cards, set.study);
    if (settingsError) {
      setModalMessage(settingsError);
      return;
    }

    setCurrentSet(set);
    const shuffled = shuffleArray(set.cards);
    setQueue(shuffled);
    setCurrentCard(shuffled[0]);
    setStudyMode(true);
    setCorrect(0);
    setWrong(0);
    setSelectedAnswer(null);

    setStudyOptions(
      buildStudyOptions(set.cards, shuffled[0], set.study)
    );
  };

  const editSet = (setIndex) => {
    const set = sets[setIndex];
    if (isBundledDeck(set)) {
      setModalMessage(
        "Built-in decks come from the repository and cannot be edited here."
      );
      return;
    }
    setCurrentSet("new");
    setTitle(set.title);
    setCards([...set.cards]);
    setStudySettings(normalizeStudySettings(set.study));
    setEditingMetadata(getDeckMetadata(set));
    setEditingSetIndex(setIndex);
  };

  const deleteSet = (setIndex) => {
    if (isBundledDeck(sets[setIndex])) {
      setModalMessage(
        "Built-in decks always stay available and cannot be deleted here."
      );
      return;
    }
    setModalMessage({
      text: "Are you sure you want to delete this set?",
      onConfirm: () => {
        const updatedSets = sets.filter((_, i) => i !== setIndex);
        setSets(updatedSets);
        setModalMessage("");
      }
    });
  };

  const submitAnswer = () => {
    if (selectedAnswer === null) return;
    if (selectedAnswer === currentCard.back) {
      setCorrect((c) => c + 1);
      nextCard(queue.slice(1));
    } else {
      setWrong((w) => w + 1);
      const rest = queue.slice(1);
      const insertIndex = Math.floor(Math.random() * (rest.length + 1));
      const newQueue = [...rest];
      newQueue.splice(insertIndex, 0, currentCard);
      nextCard(newQueue);

      setModalMessage("Wrong\nCorrect answer: " + currentCard.back);
    }
    setSelectedAnswer(null);
  };

  const nextCard = (newQueue) => {
    const next = newQueue[0] || null;
    setQueue(newQueue);
    setCurrentCard(next);
    setStudyOptions(
      next && currentSet
        ? buildStudyOptions(currentSet.cards, next, currentSet.study)
        : []
    );
  };

  const updatePronunciationSetting = (field, value) => {
    setStudySettings((current) => ({
      ...current,
      pronunciation: {
        ...DEFAULT_PRONUNCIATION_SETTINGS,
        ...(current.pronunciation || {}),
        [field]: value
      }
    }));
  };

  const speakCard = useCallback(
    (card, notifyOnFailure = true) => {
      if (!card || !currentSet || currentSet === "new") return false;

      const pronunciation = normalizeStudySettings(
        currentSet.study
      ).pronunciation;
      if (!pronunciation.enabled) return false;

      if (
        typeof window === "undefined" ||
        !window.speechSynthesis ||
        typeof window.SpeechSynthesisUtterance !== "function"
      ) {
        if (notifyOnFailure) {
          setModalMessage(
            "Text-to-speech is not supported by this browser."
          );
        }
        return false;
      }

      const voice = findPronunciationVoice(
        speechVoices,
        pronunciation.language,
        pronunciation.offlineOnly
      );
      if (!voice && pronunciation.offlineOnly) {
        if (notifyOnFailure) {
          setModalMessage(
            "No offline " + pronunciation.language +
              " voice is installed on this device. Install one in your " +
              "device's language or accessibility settings before traveling."
          );
        }
        return false;
      }

      const text = prepareSpeechText(card.front);
      if (!text) return false;

      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = pronunciation.language;
      if (voice) utterance.voice = voice;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    },
    [currentSet, speechVoices]
  );

  useEffect(() => {
    if (
      !studyMode ||
      !currentCard ||
      !currentSet ||
      currentSet === "new" ||
      modalMessage
    ) {
      return undefined;
    }

    const pronunciation = normalizeStudySettings(
      currentSet.study
    ).pronunciation;
    if (!pronunciation.enabled || !pronunciation.autoPlay) return undefined;

    speakCard(currentCard, false);
    return undefined;
  }, [currentCard, currentSet, modalMessage, speakCard, studyMode]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    [currentCard, modalMessage, studyMode]
  );

  // Simple modal
  const Modal = ({ message, onClose }) => {
    if (!message) return null;
    const text = typeof message === "string" ? message : message.text;
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <div
          style={{
            backgroundColor: "#1e1e1e",
            padding: "20px",
            borderRadius: "8px",
            maxWidth: "400px",
            textAlign: "center",
            color: "#f5f5f5"
          }}
        >
          <p style={{ whiteSpace: "pre-line" }}>{text}</p>
          {typeof message === "string" ? (
            <button
              onClick={onClose}
              style={{
                marginTop: "10px",
                padding: "6px 12px",
                backgroundColor: "#4caf50",
                color: "#fff",
                border: "none"
              }}
            >
              OK
            </button>
          ) : (
            <div style={{ marginTop: "10px" }}>
              <button
                onClick={message.onConfirm}
                style={{
                  marginRight: "10px",
                  padding: "6px 12px",
                  backgroundColor: "#f44336",
                  color: "#fff",
                  border: "none"
                }}
              >
                {message.confirmLabel || "Yes"}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#555",
                  color: "#fff",
                  border: "none"
                }}
              >
                {message.cancelLabel || "No"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const editorPronunciation = {
    ...DEFAULT_PRONUNCIATION_SETTINGS,
    ...(studySettings.pronunciation || {})
  };
  const activePronunciation =
    currentSet && currentSet !== "new"
      ? normalizeStudySettings(currentSet.study).pronunciation
      : DEFAULT_PRONUNCIATION_SETTINGS;
  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(window.speechSynthesis) &&
    typeof window.SpeechSynthesisUtterance === "function";
  const activePronunciationVoice = findPronunciationVoice(
    speechVoices,
    activePronunciation.language,
    activePronunciation.offlineOnly
  );
  const pronunciationStatus = (pronunciation) => {
    if (!pronunciation.enabled) return "Pronunciation is off.";
    if (!pronunciation.language.trim()) {
      return "Enter a language tag to check for an installed voice.";
    }
    if (!speechSupported) {
      return "Text-to-speech is not supported by this browser.";
    }
    if (!speechVoicesLoaded) return "Checking installed voices...";

    const voice = findPronunciationVoice(
      speechVoices,
      pronunciation.language,
      pronunciation.offlineOnly
    );
    if (voice) {
      return (
        (voice.localService ? "Offline voice ready: " : "Voice ready: ") +
        voice.name +
        " (" +
        voice.lang +
        ")"
      );
    }

    return pronunciation.offlineOnly
      ? "No offline " + pronunciation.language + " voice is installed."
      : "No matching voice was reported; the browser may use its default.";
  };

  return (
    <div
      style={{
        padding: "20px",
        position: "relative",
        backgroundColor: "#121212",
        color: "#f5f5f5",
        minHeight: "100vh"
      }}
    >
      {!currentSet && !studyMode ? (
        <div>
          <h1>My Flashcard Sets</h1>
          {process.env.NODE_ENV === "production" && (
            <p
              role="status"
              style={{
                color:
                  offlineStatus.status === "ready"
                    ? "#8bd18b"
                    : offlineStatus.status === "preparing"
                    ? "#e7c36a"
                    : "#ff8a80",
                marginTop: "-8px"
              }}
            >
              {offlineStatus.status === "ready"
                ? "Offline ready"
                : offlineStatus.status === "preparing"
                ? "Preparing offline mode…"
                : offlineStatus.message || "Offline mode is unavailable."}
            </p>
          )}
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div
              onClick={openCreateSet}
              style={{
                border: "2px dashed #888",
                padding: "20px",
                cursor: "pointer",
                textAlign: "center",
                width: "120px",
                backgroundColor: "#1e1e1e"
              }}
            >
              + Create
            </div>
            {sets.map((s, i) => (
              <div
                key={s.bundledDeckId || i}
                role="group"
                aria-label={s.title + " deck"}
                style={{
                  border: "1px solid #444",
                  padding: "10px",
                  width: "150px",
                  backgroundColor: "#1e1e1e",
                  position: "relative"
                }}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <div style={{ cursor: "pointer" }} onClick={() => startStudy(i)}>
                  <h2 style={{ fontSize: "1rem" }}>{s.title}</h2>
                  <p>{s.cards.length} cards</p>
                  {isBundledDeck(s) && (
                    <small style={{ color: "#8bd18b" }}>Built in</small>
                  )}
                </div>
                {hasDeckDetails(s) && (
                  <button
                    type="button"
                    onClick={() => setModalMessage(formatDeckDetails(s))}
                    aria-label={"Details for " + s.title}
                    style={{
                      display: "block",
                      marginTop: "8px",
                      padding: 0,
                      background: "none",
                      border: "none",
                      color: "#9ecbff",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    Details
                  </button>
                )}
                {hoverIndex === i && !isBundledDeck(s) && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "0",
                      left: "0",
                      right: "0",
                      display: "flex",
                      justifyContent: "space-around",
                      backgroundColor: "rgba(0,0,0,0.7)",
                      padding: "5px"
                    }}
                  >
                    <button
                      onClick={() => editSet(i)}
                      aria-label={"Edit " + s.title}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#4caf50",
                        cursor: "pointer"
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteSet(i)}
                      aria-label={"Delete " + s.title}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#f44336",
                        cursor: "pointer"
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : currentSet === "new" ? (
        <div>
          <button
            onClick={closeEditor}
            style={{
              backgroundColor: "#4caf50",
              padding: "6px 12px",
              color: "#f5f5f5",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              marginBottom: "10px"
            }}
          >
            Back
          </button>
          <h1>{editingSetIndex === null ? "Create New Set" : "Edit Set"}</h1>
          <input
            type="text"
            aria-label="Set title"
            placeholder="Set Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: "8px",
              marginBottom: "10px",
              display: "block",
              width: "100%",
              backgroundColor: "#1e1e1e",
              color: "#f5f5f5",
              border: "1px solid #555"
            }}
          />

          <fieldset
            style={{
              border: "1px solid #444",
              borderRadius: "8px",
              padding: "16px",
              margin: "14px 0 20px"
            }}
          >
            <legend style={{ padding: "0 8px", fontWeight: "bold" }}>
              Answer choices
            </legend>

            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="radio"
                name="choice-mode"
                value={CHOICE_MODES.ALL}
                checked={studySettings.choiceMode === CHOICE_MODES.ALL}
                onChange={(e) =>
                  setStudySettings((current) => ({
                    ...current,
                    choiceMode: e.target.value
                  }))
                }
              />{" "}
              All unique answers
              <small
                style={{ display: "block", color: "#bbb", marginLeft: "22px" }}
              >
                Show every distinct back value on every card.
              </small>
            </label>

            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="radio"
                name="choice-mode"
                value={CHOICE_MODES.RANDOM}
                checked={studySettings.choiceMode === CHOICE_MODES.RANDOM}
                onChange={(e) =>
                  setStudySettings((current) => ({
                    ...current,
                    choiceMode: e.target.value
                  }))
                }
              />{" "}
              Random subset
              <small
                style={{ display: "block", color: "#bbb", marginLeft: "22px" }}
              >
                Shows up to your chosen count, always including the correct
                answer with unique distractors.
              </small>
            </label>

            {studySettings.choiceMode === CHOICE_MODES.RANDOM && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  margin: "0 0 12px 22px"
                }}
              >
                Choices per card
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={studySettings.choiceCount}
                  onChange={(e) =>
                    setStudySettings((current) => ({
                      ...current,
                      choiceCount: e.target.value
                    }))
                  }
                  style={{
                    width: "70px",
                    padding: "6px",
                    backgroundColor: "#1e1e1e",
                    color: "#f5f5f5",
                    border: "1px solid #555"
                  }}
                />
              </label>
            )}

            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="radio"
                name="choice-mode"
                value={CHOICE_MODES.FIXED}
                checked={studySettings.choiceMode === CHOICE_MODES.FIXED}
                onChange={(e) =>
                  setStudySettings((current) => ({
                    ...current,
                    choiceMode: e.target.value
                  }))
                }
              />{" "}
              Fixed choices
              <small
                style={{ display: "block", color: "#bbb", marginLeft: "22px" }}
              >
                Use the same custom answer bank on every card.
              </small>
            </label>

            {studySettings.choiceMode === CHOICE_MODES.FIXED && (
              <label style={{ display: "block", margin: "0 0 12px 22px" }}>
                One choice per line
                <textarea
                  aria-label="Fixed choices"
                  value={studySettings.choices.join("\n")}
                  onChange={(e) =>
                    setStudySettings((current) => ({
                      ...current,
                      choices: e.target.value.split(/\r?\n/)
                    }))
                  }
                  rows="5"
                  placeholder={"Hit\nStand\nDouble\nSplit\nSurrender"}
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "6px",
                    padding: "8px",
                    backgroundColor: "#1e1e1e",
                    color: "#f5f5f5",
                    border: "1px solid #555"
                  }}
                />
              </label>
            )}

            <label style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={studySettings.shuffleChoices}
                onChange={(e) =>
                  setStudySettings((current) => ({
                    ...current,
                    shuffleChoices: e.target.checked
                  }))
                }
              />{" "}
              Shuffle answer positions for each card
            </label>
          </fieldset>

          <fieldset
            style={{
              border: "1px solid #444",
              borderRadius: "8px",
              padding: "16px",
              margin: "14px 0 20px"
            }}
          >
            <legend style={{ padding: "0 8px", fontWeight: "bold" }}>
              Pronunciation
            </legend>

            <label style={{ display: "block", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={editorPronunciation.enabled}
                onChange={(event) =>
                  updatePronunciationSetting("enabled", event.target.checked)
                }
              />{" "}
              Enable text-to-speech for this set
            </label>

            {editorPronunciation.enabled && (
              <div style={{ marginLeft: "22px" }}>
                <label style={{ display: "block", marginBottom: "12px" }}>
                  Language
                  <input
                    type="text"
                    aria-label="Pronunciation language"
                    value={editorPronunciation.language}
                    onChange={(event) =>
                      updatePronunciationSetting(
                        "language",
                        event.target.value
                      )
                    }
                    placeholder="pt-BR"
                    style={{
                      display: "block",
                      width: "140px",
                      marginTop: "6px",
                      padding: "6px",
                      backgroundColor: "#1e1e1e",
                      color: "#f5f5f5",
                      border: "1px solid #555"
                    }}
                  />
                  <small style={{ display: "block", color: "#bbb" }}>
                    Use a language tag such as pt-BR, es-MX, or fr-FR.
                  </small>
                </label>

                <label style={{ display: "block", marginBottom: "10px" }}>
                  <input
                    type="checkbox"
                    checked={editorPronunciation.autoPlay}
                    onChange={(event) =>
                      updatePronunciationSetting(
                        "autoPlay",
                        event.target.checked
                      )
                    }
                  />{" "}
                  Speak automatically when each card appears
                </label>

                <label style={{ display: "block", marginBottom: "10px" }}>
                  <input
                    type="checkbox"
                    checked={editorPronunciation.offlineOnly}
                    onChange={(event) =>
                      updatePronunciationSetting(
                        "offlineOnly",
                        event.target.checked
                      )
                    }
                  />{" "}
                  Only use a voice installed on this device
                </label>

                <small
                  role="status"
                  style={{
                    display: "block",
                    color: findPronunciationVoice(
                      speechVoices,
                      editorPronunciation.language,
                      editorPronunciation.offlineOnly
                    )
                      ? "#8bd18b"
                      : "#e7c36a"
                  }}
                >
                  {pronunciationStatus(editorPronunciation)}
                </small>
              </div>
            )}
          </fieldset>

          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input
              type="text"
              aria-label="Card front"
              placeholder="Front"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              style={{
                padding: "8px",
                flex: 1,
                backgroundColor: "#1e1e1e",
                color: "#f5f5f5",
                border: "1px solid #555"
              }}
            />
            <input
              type="text"
              aria-label="Card back"
              placeholder="Back"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              style={{
                padding: "8px",
                flex: 1,
                backgroundColor: "#1e1e1e",
                color: "#f5f5f5",
                border: "1px solid #555"
              }}
            />
            <button
              onClick={addCard}
              style={{
                padding: "8px 16px",
                backgroundColor: "#333",
                color: "#fff",
                border: "1px solid #555"
              }}
            >
              Add
            </button>
          </div>

          <p style={{ marginTop: "20px", marginBottom: "4px" }}>
            Replace cards from JSON:
          </p>
          <small style={{ display: "block", color: "#bbb", marginBottom: "8px" }}>
            Supports compact front-to-back objects, complete deck files, and
            legacy arrays. A complete deck also replaces the title and study
            settings.
          </small>
          <input
            type="file"
            accept=".json"
            onChange={importFromFile}
            style={{ marginBottom: "20px" }}
          />

          <ul style={{ marginTop: "20px" }}>
            {cards.map((c, i) => (
              <li
                key={i}
                style={{
                  border: "1px solid #444",
                  padding: "5px",
                  marginBottom: "5px",
                  backgroundColor: "#1e1e1e",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <span>
                  <strong>{c.front}</strong>: {c.back}
                </span>
                <button
                  type="button"
                  aria-label={"Remove card " + (i + 1)}
                  onClick={() =>
                    setCards((current) =>
                      current.filter((_, index) => index !== i)
                    )
                  }
                  style={{
                    backgroundColor: "#5c1f1f",
                    color: "#fff",
                    border: "1px solid #8b3333",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    cursor: "pointer"
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={createSet}
            style={{
              padding: "10px 20px",
              marginTop: "20px",
              backgroundColor: "#4caf50",
              color: "#fff",
              border: "none"
            }}
          >
            {editingSetIndex === null ? "Save Set" : "Save Changes"}
          </button>
        </div>
      ) : studyMode && currentCard ? (
        <div>
          <h1>{currentSet.title}</h1>

          {/* Stats + Back inline */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px"
            }}
          >
            <p style={{ margin: 0 }}>
              Remaining: {queue.length} | Right: {correct} | Wrong: {wrong}
            </p>
            <button
              onClick={() => {
                setCurrentSet(null);
                setStudyMode(false);
              }}
              style={{
                backgroundColor: "#4caf50",
                padding: "6px 12px",
                color: "#f5f5f5",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Back
            </button>
          </div>

          <div
            style={{
              border: "1px solid #fff",
              padding: "40px",
              marginBottom: "20px",
              fontSize: "1.5rem",
              textAlign: "center",
              backgroundColor: "#1e1e1e"
            }}
          >
            <div>{currentCard.front}</div>
            {activePronunciation.enabled && (
              <button
                type="button"
                aria-label="Speak card pronunciation"
                onClick={() => speakCard(currentCard)}
                style={{
                  marginTop: "16px",
                  padding: "7px 14px",
                  backgroundColor: "#333",
                  color: "#fff",
                  border: "1px solid #777",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Speak
              </button>
            )}
            {activePronunciation.enabled &&
              (!speechSupported ||
                !speechVoicesLoaded ||
                (activePronunciation.offlineOnly &&
                  !activePronunciationVoice)) && (
                <small
                  role="status"
                  style={{
                    display: "block",
                    marginTop: "10px",
                    color: "#e7c36a",
                    fontSize: "0.8rem"
                  }}
                >
                  {pronunciationStatus(activePronunciation)}
                </small>
              )}
          </div>

          {/* ANSWER GRID */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(
                2,
                studyOptions.length
              )}, 1fr)`,
              gap: "10px",
              marginTop: "20px"
            }}
          >
            {studyOptions.map((value, i) => (
              <label
                key={value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    selectedAnswer === value ? "#4caf50" : "#1e1e1e",
                  border: "1px solid #555",
                  padding: "20px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "center",
                  minHeight: "60px"
                }}
              >
                <input
                  type="radio"
                  name="answer-choice"
                  value={value}
                  checked={selectedAnswer === value}
                  onChange={() => setSelectedAnswer(value)}
                  style={{ display: "none" }}
                />
                {value}
              </label>
            ))}
          </div>

          <button
            onClick={submitAnswer}
            style={{
              width: "100%",
              padding: "15px",
              marginTop: "20px",
              backgroundColor: "#4caf50",
              color: "#fff",
              border: "1px solid #555",
              fontSize: "1.2rem",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Submit
          </button>
        </div>
      ) : studyMode && !currentCard ? (
        <div>
          <h1>Done!</h1>
          <p>
            Right: {correct} | Wrong: {wrong}
          </p>
          <button
            onClick={() => {
              setCurrentSet(null);
              setStudyMode(false);
              setStudyOptions([]);
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4caf50",
              color: "#fff",
              border: "1px solid #555"
            }}
          >
            Back to Sets
          </button>
        </div>
      ) : null}

      <Modal message={modalMessage} onClose={() => setModalMessage("")} />
    </div>
  );
}

export default App;

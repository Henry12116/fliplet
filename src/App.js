import React, { useState, useEffect } from "react";
import {
  buildStudyOptions,
  CHOICE_MODES,
  DEFAULT_STUDY_SETTINGS,
  isDeckEnvelope,
  normalizeDeck,
  normalizeStudySettings,
  shuffleArray,
  validateStudySettings
} from "./deckUtils";

const createDefaultStudySettings = () => ({
  ...DEFAULT_STUDY_SETTINGS,
  choiceMode: CHOICE_MODES.RANDOM,
  choices: []
});

function App() {
  const [sets, setSets] = useState([]);
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
  const [studySettings, setStudySettings] = useState(
    createDefaultStudySettings
  );

  // Load sets from localStorage once
  useEffect(() => {
    const savedSets = localStorage.getItem("flashcardSets");
    if (savedSets) {
      try {
        const parsedSets = JSON.parse(savedSets);
        if (!Array.isArray(parsedSets)) {
          throw new Error("Saved flashcard data must be a list of sets.");
        }

        setSets(
          parsedSets.map((set, index) =>
            normalizeDeck(set, { title: "Set " + (index + 1) })
          )
        );
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
              setSets([]);
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
    }
    setInitialized(true);
  }, []);

  // Save sets whenever updated
  useEffect(() => {
    if (initialized) {
      localStorage.setItem("flashcardSets", JSON.stringify(sets));
    }
  }, [sets, initialized]);

  const resetEditor = () => {
    setTitle("");
    setCards([]);
    setNewKey("");
    setNewValue("");
    setEditingSetIndex(null);
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
    setCurrentSet("new");
    setTitle(set.title);
    setCards([...set.cards]);
    setStudySettings(normalizeStudySettings(set.study));
    setEditingSetIndex(setIndex);
  };

  const deleteSet = (setIndex) => {
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
                key={i}
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
                </div>
                {hoverIndex === i && (
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
            legacy arrays. A complete deck also replaces the title and answer
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
            {currentCard.front}
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

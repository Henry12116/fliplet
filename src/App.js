import React, { useState, useEffect } from "react";

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

  // Load sets from localStorage once
  useEffect(() => {
    const savedSets = localStorage.getItem("flashcardSets");
    if (savedSets) {
      setSets(JSON.parse(savedSets));
    }
    setInitialized(true);
  }, []);

  // Save sets whenever updated
  useEffect(() => {
    if (initialized) {
      localStorage.setItem("flashcardSets", JSON.stringify(sets));
    }
  }, [sets, initialized]);

  const createSet = () => {
    if (!title.trim() || cards.length === 0) {
      setModalMessage("Please add a title and at least one card before saving.");
      return;
    }
    const newSet = { title: title.trim(), cards: [...cards] };
    setSets((prev) => [...prev, newSet]);
    // reset
    setTitle("");
    setCards([]);
    setCurrentSet(null);
    setModalMessage("Set saved successfully!");
  };

  const addCard = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setCards((prev) => [...prev, { key: newKey.trim(), value: newValue.trim() }]);
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
        if (Array.isArray(importedCards)) {
          setCards(importedCards);
          setModalMessage(`Imported ${importedCards.length} cards successfully.`);
        } else {
          setModalMessage("JSON must be an array of cards");
        }
      } catch (err) {
        setModalMessage("Invalid JSON");
      }
    };
    reader.readAsText(file);
  };

  const startStudy = (setIndex) => {
    const set = sets[setIndex];
    setCurrentSet(set);
    const shuffled = [...set.cards].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setCurrentCard(shuffled[0]);
    setStudyMode(true);
    setCorrect(0);
    setWrong(0);
    setSelectedAnswer(null);

    // unique answers fixed once per set
    const uniqueValues = Array.from(new Set(set.cards.map((c) => c.value)));
    setStudyOptions(uniqueValues);
  };

  const editSet = (setIndex) => {
    const set = sets[setIndex];
    setCurrentSet("new");
    setTitle(set.title);
    setCards(set.cards);
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
    if (!selectedAnswer) return;
    if (selectedAnswer === currentCard.value) {
      setCorrect((c) => c + 1);
      nextCard(queue.slice(1));
    } else {
      setWrong((w) => w + 1);
      const rest = queue.slice(1);
      const insertIndex = Math.floor(Math.random() * (rest.length + 1));
      const newQueue = [...rest];
      newQueue.splice(insertIndex, 0, currentCard);
      nextCard(newQueue);

      setModalMessage(`Wrong\nCorrect answer: ${currentCard.value}`);
    }
    setSelectedAnswer(null);
  };

  const nextCard = (newQueue) => {
    setQueue(newQueue);
    setCurrentCard(newQueue[0] || null);
  };

  const BackButton = () => (
  <button
    onClick={() => {
      setCurrentSet(null);
      setStudyMode(false);
    }}
    style={{
      backgroundColor: "#4caf50",
      position: "absolute",
      top: "10px",
      right: "10px",
      padding: "6px 12px",
      color: "#f5f5f5",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      zIndex: 1000
    }}
  >
    Back
  </button>
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
                Yes
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
                No
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
              onClick={() => setCurrentSet("new")}
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
        <div style={{ position: "relative" }}>
          <BackButton />
          <h1>Create New Set</h1>
          <input
            type="text"
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

          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="Key"
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
              placeholder="Value"
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

          <p style={{ marginTop: "20px" }}>Import flashcards from JSON file:</p>
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
                  backgroundColor: "#1e1e1e"
                }}
              >
                <strong>{c.key}</strong>: {c.value}
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
            Save Set
          </button>
        </div>
      ) : studyMode && currentCard ? (
        <div style={{ position: "relative" }}>
          <BackButton />
          <h1>{currentSet.title}</h1>
          <p>
            Remaining: {queue.length} | Right: {correct} | Wrong: {wrong}
          </p>

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
            {currentCard.key}
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
                key={i}
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
                  name={`answer-${currentCard.key}`}
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
        <div style={{ position: "relative" }}>
          <BackButton />
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

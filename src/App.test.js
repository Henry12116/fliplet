import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
});

test("renders the set library", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "My Flashcard Sets" })
  ).toBeTruthy();
});

test("editing an existing set updates it instead of appending a copy", async () => {
  localStorage.setItem(
    "flashcardSets",
    JSON.stringify([
      {
        title: "Original",
        cards: [{ key: "Question", value: "Answer" }]
      }
    ])
  );

  render(<App />);

  const setTitle = await screen.findByText("Original");
  const setCard = setTitle.parentElement.parentElement;
  fireEvent.mouseEnter(setCard);
  fireEvent.click(
    screen.getByRole("button", { name: "Edit Original" })
  );

  const titleInput = screen.getByLabelText("Set title");
  fireEvent.change(titleInput, { target: { value: "Updated" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Save Changes" })
  );

  await waitFor(() => {
    const storedSets = JSON.parse(localStorage.getItem("flashcardSets"));
    expect(storedSets).toHaveLength(1);
    expect(storedSets[0].title).toBe("Updated");
  });
});

test("a new one-card set can be saved with the random default", async () => {
  render(<App />);

  fireEvent.click(screen.getByText("+ Create"));
  fireEvent.change(screen.getByLabelText("Set title"), {
    target: { value: "Starter" }
  });
  fireEvent.change(screen.getByLabelText("Card front"), {
    target: { value: "Question" }
  });
  fireEvent.change(screen.getByLabelText("Card back"), {
    target: { value: "Answer" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Set" }));

  await waitFor(() => {
    const storedSets = JSON.parse(localStorage.getItem("flashcardSets"));
    expect(storedSets).toHaveLength(1);
    expect(storedSets[0].study.choiceMode).toBe("random");
  });
});

test("offers a recoverable reset when saved data is unreadable", async () => {
  localStorage.setItem("flashcardSets", "{not valid json");

  render(<App />);

  fireEvent.click(
    await screen.findByRole("button", { name: "Back up and reset" })
  );

  await waitFor(() => {
    expect(localStorage.getItem("flashcardSetsBackup")).toBe(
      "{not valid json"
    );
    expect(JSON.parse(localStorage.getItem("flashcardSets"))).toEqual([]);
  });
});

test("saves pronunciation settings with a deck", async () => {
  render(<App />);

  fireEvent.click(screen.getByText("+ Create"));
  fireEvent.change(screen.getByLabelText("Set title"), {
    target: { value: "Portuguese" }
  });
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Enable text-to-speech for this set"
    })
  );
  fireEvent.change(screen.getByLabelText("Pronunciation language"), {
    target: { value: "pt-BR" }
  });
  fireEvent.change(screen.getByLabelText("Card front"), {
    target: { value: "olá" }
  });
  fireEvent.change(screen.getByLabelText("Card back"), {
    target: { value: "hello" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Set" }));

  await waitFor(() => {
    const storedSets = JSON.parse(localStorage.getItem("flashcardSets"));
    expect(storedSets[0].study.pronunciation).toEqual({
      enabled: true,
      language: "pt-BR",
      side: "front",
      autoPlay: false,
      offlineOnly: true
    });
  });
});

test("speaks a card with an installed Brazilian Portuguese voice", async () => {
  const localVoice = {
    name: "Brazilian Portuguese",
    lang: "pt-BR",
    localService: true,
    default: true
  };
  const speak = jest.fn();
  const cancel = jest.fn();
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getVoices: () => [localVoice],
      speak,
      cancel
    }
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: function SpeechSynthesisUtterance(text) {
      this.text = text;
    }
  });
  localStorage.setItem(
    "flashcardSets",
    JSON.stringify([
      {
        title: "Portuguese",
        cards: [{ front: "olá / oi", back: "hello" }],
        study: {
          choiceMode: "all",
          pronunciation: {
            enabled: true,
            language: "pt-BR",
            side: "front",
            autoPlay: false,
            offlineOnly: true
          }
        }
      }
    ])
  );

  render(<App />);
  fireEvent.click(await screen.findByText("Portuguese"));
  fireEvent.click(
    await screen.findByRole("button", { name: "Speak card pronunciation" })
  );

  expect(cancel).toHaveBeenCalled();
  expect(speak).toHaveBeenCalledWith(
    expect.objectContaining({
      text: "olá, oi",
      lang: "pt-BR",
      voice: localVoice
    })
  );
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
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

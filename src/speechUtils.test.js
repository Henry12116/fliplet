import { findPronunciationVoice, prepareSpeechText } from "./speechUtils";

const voice = (lang, options = {}) => ({
  lang,
  localService: true,
  default: false,
  ...options
});

test("prefers an exact local pronunciation voice", () => {
  const brazilianVoice = voice("pt-BR");
  const result = findPronunciationVoice(
    [voice("pt-PT"), brazilianVoice, voice("pt-BR", { localService: false })],
    "pt-BR"
  );

  expect(result).toBe(brazilianVoice);
});

test("recognizes Android locale tags that use underscores", () => {
  const brazilianVoice = voice("pt_BR");

  expect(findPronunciationVoice([brazilianVoice], "pt-BR")).toBe(
    brazilianVoice
  );
});

test("does not substitute another Portuguese accent for Brazilian Portuguese", () => {
  expect(
    findPronunciationVoice([voice("pt"), voice("pt-PT")], "pt-BR")
  ).toBeNull();
});

test("does not use a remote voice in offline-only mode", () => {
  expect(
    findPronunciationVoice(
      [voice("pt-BR", { localService: false })],
      "pt-BR",
      true
    )
  ).toBeNull();
});

test("turns slash-separated card fronts into natural pauses", () => {
  expect(prepareSpeechText("o / a / os / as")).toBe("o, a, os, as");
});

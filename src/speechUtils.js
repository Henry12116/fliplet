const normalizedLanguage = (language) =>
  typeof language === "string"
    ? language.trim().replace(/_/g, "-").toLowerCase()
    : "";

const preferredVoice = (voices) =>
  voices.find((voice) => voice.default) || voices[0] || null;

export const findPronunciationVoice = (voices, language) => {
  const requestedLanguage = normalizedLanguage(language);
  if (!requestedLanguage || !Array.isArray(voices)) return null;

  const exactMatches = voices.filter(
    (voice) =>
      voice &&
      typeof voice.lang === "string" &&
      normalizedLanguage(voice.lang) === requestedLanguage
  );
  const localMatches = exactMatches.filter(
    (voice) => voice.localService === true
  );

  return preferredVoice(localMatches) || preferredVoice(exactMatches);
};

export const prepareSpeechText = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\s+/g, " ");

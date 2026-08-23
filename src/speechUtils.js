const normalizedLanguage = (language) =>
  typeof language === "string" ? language.trim().toLowerCase() : "";

const preferredVoice = (voices) =>
  voices.find((voice) => voice.default) || voices[0] || null;

export const findPronunciationVoice = (
  voices,
  language,
  offlineOnly = true
) => {
  const requestedLanguage = normalizedLanguage(language);
  if (!requestedLanguage || !Array.isArray(voices)) return null;

  const eligibleVoices = voices.filter(
    (voice) =>
      voice &&
      typeof voice.lang === "string" &&
      (!offlineOnly || voice.localService === true)
  );
  const exactMatches = eligibleVoices.filter(
    (voice) => normalizedLanguage(voice.lang) === requestedLanguage
  );

  return preferredVoice(exactMatches);
};

export const prepareSpeechText = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\s+/g, " ");

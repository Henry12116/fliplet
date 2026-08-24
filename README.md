# Fliplet

Flashcard study app.

## Deploy

Push to `main`; GitHub Actions builds and deploys automatically.

## Json Upload Format

Can be found in [decks](decks).
```json
{
  "formatVersion": 1,
  "title": "Learn Portuguese",
  "description": "Common words in Portuguese",
  "source": "https://some-portugese-learning-website.com/",
  "study": {
    "choiceMode": "random",
    "choiceCount": 4,
    "choices": [],
    "shuffleChoices": true,
    "pronunciation": {
      "enabled": true,
      "language": "pt-BR",
      "side": "front",
      "autoPlay": false,
      "offlineOnly": true
    }
  },
  "cards": {
    "chapeau de cowboy": "cowboy hat",
    ...
  }
}
```

# Fliplet

Flashcard study app.

## Deploy

Push to `main`; GitHub Actions builds and deploys automatically.

## Bundled decks

Every JSON file under [`decks`](decks) is automatically included when Fliplet
starts, builds, or runs its tests. Add a deck there and commit it to make it
part of the deployed app; no browser upload is needed for repository decks.
These decks are labeled **Built in** and stay read-only in the app; edit their
JSON source to update them for everyone.

To import an editable personal deck, choose **Create** and use the JSON file
picker in the editor. Imported decks remain local to that browser; they do not
write files into this repository or publish decks for other users.

## JSON deck format

Examples can be found in [`decks`](decks).

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

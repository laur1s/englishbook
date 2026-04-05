# Grey's Book Translation Audit

## Verified matches

- `wake up` -> `atsibusti`, `pabusti`
- `medical mission` -> `medicininė misija`, `medicininės misijos`
- `confidence` -> `pasitikėjimas savimi`
- `mean` -> `nemalonus`
- `reports` -> `ataskaitos`
- `appendectomy` -> `apendicito pašalinimas`
- `maid of honor` -> `vyriausioji pamergė`
- `half-sister` -> `įseserė`
- `heart failure` -> `širdies nepakankamumas`
- `count on` -> `pasikliauti`
- `hold back` -> `sulaikyti`
- `spleen` -> `blužnis`
- `storm` -> `audra`
- `heart` -> `širdis`
- `father` -> `tėvas`

## Confirmed misses

- `power outage` -> no translation found
- `flooded` -> no translation found
- `generator` -> no translation found
- `hypothermia` -> no translation found
- `different calling` -> no translation found
- `dreams` -> no translation found
- `reality` -> no translation found

## Findings

- Phrase-first lookup is working for several story phrases and medical terms, which is the right foundation for Grey's Book.
- Coverage is still uneven for Chapter 7 and Chapter 8 vocabulary, especially weather, emergency, and abstract theme words.
- The current dictionary depends on clean bilingual source pairs. If a chapter introduces important words only inside the story, long-press lookup will miss them.
- The UI lookup logic can find one-word, two-word, and three-word terms around the pressed token, but it cannot invent translations for concepts missing from the extracted glossary.

## Priority fixes suggested by the audit

- Expand translation extraction so key Grey's Book vocabulary from later chapters is captured more reliably.
- Prefer chapter-local phrase glossaries where story-specific terms are important for comprehension.
- Add fallbacks or explicit glossary entries for high-value missing words from Chapter 7 and Chapter 8.
- Keep long-press focused on trustworthy glossary-backed translations rather than guessing.

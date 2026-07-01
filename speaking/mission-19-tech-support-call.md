---
title: "Mission 19: Tech-Support Call"
ltTitle: "Misija 19: Techninės pagalbos skambutis"
slug: "tech-support-call"
collection: "speaking-missions"
order: 19
contentType: "speaking-mission"
level: "A2.4"
grammarFocus: ["sequence", "adverbs"]
topics: ["technology", "instructions"]
hasAnswerKey: false
status: "published"
missionType: "role-flip-dialogue"
durationMinutes: 5
sourceRefs:
  - "unit-19"
supportsRecording: true
listening:
  modelText: >-
    User: People can't hear me on the call. Helper: First, check that your headset is connected. Next, make sure the microphone is not muted. Then open the sound settings. User: Do you mean the camera settings? Helper: No, the sound settings—the menu with the speaker symbol. Select your headset under Microphone. Finally, join the call again. You never need to send me a password or private code. Can people hear you now?
  speechText: >-
    People can't hear me on the call. First, check that your headset is connected. Next, make sure the microphone is not muted. Then open the sound settings. Do you mean the camera settings? No, the sound settings—the menu with the speaker symbol. Select your headset under Microphone. Finally, join the call again. You never need to send me a password or private code. Can people hear you now?
  checks:
    - id: "mission-19.gist"
      kind: "gist"
      prompt: "What problem does the user have?"
      ltPrompt: "Kokia naudotojo problema?"
      hint: "Focus on the user's first sentence and the word “hear”."
      ltHint: "Atkreipkite dėmesį į pirmą naudotojo sakinį ir žodį „hear“."
      options:
        - id: "microphone-not-heard"
          text: "Other people cannot hear the user."
        - id: "camera-not-working"
          text: "Other people cannot see the user."
        - id: "password-forgotten"
          text: "The user cannot remember a password."
      answerId: "microphone-not-heard"
      feedback: "The user says, “People can't hear me,” so the call has a microphone or sound problem."
      ltFeedback: "Naudotojas sako „People can't hear me“, todėl skambučio problema susijusi su mikrofonu arba garsu."
    - id: "mission-19.detail"
      kind: "detail"
      prompt: "Which settings should the user open?"
      ltPrompt: "Kuriuos nustatymus naudotojas turi atidaryti?"
      hint: "The user guesses one menu. Notice how the helper corrects that guess."
      ltHint: "Naudotojas spėja vieną meniu. Atkreipkite dėmesį, kaip pagalbos darbuotojas pataiso šį spėjimą."
      options:
        - id: "camera-settings"
          text: "The camera settings"
        - id: "sound-settings"
          text: "The sound settings"
        - id: "account-settings"
          text: "The account settings"
      answerId: "sound-settings"
      feedback: "The helper corrects the misunderstanding: open the sound settings, with the speaker symbol."
      ltFeedback: "Pagalbos darbuotojas pataiso nesusipratimą: reikia atidaryti garso nustatymus su garsiakalbio simboliu."
  shadowLine: "No, the sound settings—the menu with the speaker symbol."
  shadowLineLt: "Ne, garso nustatymus – meniu su garsiakalbio simboliu."
steps:
  - kind: "brief"
    prompt: "Explain a device problem and guide a user through five safe support steps."
    ltPrompt: "Paaiškinkite įrenginio problemą ir padėkite naudotojui atlikti penkis saugius veiksmus."
  - kind: "prep"
    prompt: "Choose a camera, sound, sign-in, or file problem and put the solution steps in order."
    ltPrompt: "Pasirinkite kameros, garso, prisijungimo arba failo problemą ir sudėliokite sprendimo veiksmus eilės tvarka."
    seconds: 25
    support:
      - "First"
      - "Next"
      - "carefully"
  - kind: "speak"
    prompt: "Give the instructions. The user misunderstands one step, so explain it again more clearly."
    ltPrompt: "Pateikite instrukcijas. Naudotojas neteisingai supranta vieną veiksmą, todėl paaiškinkite jį dar kartą aiškiau."
    seconds: 95
    support:
      - "Click..."
      - "Could you say that again?"
      - "Do not share your password."
  - kind: "compare"
    prompt: "Compare with this model: User: People can't hear me on the call. Helper: First, check that your headset is connected. Next, make sure the microphone is not muted. Then open the sound settings. User: Do you mean the camera settings? Helper: No, the sound settings—the menu with the speaker symbol. Select your headset under Microphone. Finally, join the call again. You never need to send me a password or private code. Can people hear you now?"
    ltPrompt: "Paklausykite pavyzdžio ir patikrinkite veiksmų tvarką bei saugumo kalbą."
    support:
      - "Were the steps safe and in a usable order?"
      - "Did the helper check the result at the end?"
  - kind: "reflect"
    prompt: "Correct the misunderstood step and summarise the safe solution."
    ltPrompt: "Pataisykite neteisingai suprastą veiksmą ir apibendrinkite saugų sprendimą."
    support:
      - "clear imperative"
      - "sequence word"
      - "no private information"
---

## Useful Building Blocks / Naudingi sakiniai

- What happens when you...? — Kas nutinka, kai...?
- First, check... — Pirmiausia patikrinkite...
- Next, open/choose... — Toliau atidarykite / pasirinkite...
- Please do that carefully. — Prašau, atlikite tai atsargiai.
- Do you mean this button? — Ar turite omenyje šį mygtuką?
- Let me explain that step again. — Leiskite dar kartą paaiškinti tą veiksmą.
- Never share your password or code. — Niekada neatskleiskite slaptažodžio ar kodo.
- Is it working now? — Ar dabar veikia?

## Safety and Success Check / Saugumas ir sėkmės kriterijai

Good technical English is short, ordered, and easy to check. Give one action at a time and wait for confirmation before moving to the next step.

Your call succeeds when the problem is clear, five steps are in a usable order, one misunderstood step is repaired, and the result is checked. Never ask for or share passwords, verification codes, payment details, or remote access. On the second attempt, change the device problem and explain the repaired step with simpler words, not just more words.

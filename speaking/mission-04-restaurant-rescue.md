---
title: "Mission 4: Restaurant Rescue"
ltTitle: "Misija 4: Situacija restorane"
slug: "restaurant-rescue"
collection: "speaking-missions"
order: 4
contentType: "speaking-mission"
level: "A2.1"
grammarFocus:
  - "countable and uncountable nouns"
  - "polite requests"
topics:
  - "food"
  - "restaurants"
  - "problem solving"
hasAnswerKey: false
status: "published"
missionType: "role-flip-dialogue"
durationMinutes: 6
sourceRefs:
  - "unit-04"
supportsRecording: true
listening:
  modelText: >-
    Customer: Could I have the chicken soup and a cup of tea, please? Waiter: Of course. Anything else? Customer: No, thank you. Later, the customer says: Sorry, I ordered tea, not water. Waiter: I'm sorry about that. I'll bring your tea in a minute. Customer: Thank you.
  speechText: >-
    Could I have the chicken soup and a cup of tea, please? Of course. Anything else? No, thank you. Sorry, I ordered tea, not water. I'm sorry about that. I'll bring your tea in a minute. Thank you.
  checks:
    - id: "mission-04.gist"
      kind: "gist"
      prompt: "Why does the customer speak to the waiter again?"
      ltPrompt: "Kodėl klientas dar kartą kreipiasi į padavėją?"
      hint: "Notice what the customer asks for the second time and how “not” shows the contrast."
      ltHint: "Atkreipkite dėmesį, ko klientas prašo antrą kartą ir kaip pavartoja žodį „not“."
      options:
        - id: "wrong-drink"
          text: "The customer received the wrong drink."
        - id: "cold-soup"
          text: "The soup is cold."
        - id: "pay-the-bill"
          text: "The customer wants to pay."
      answerId: "wrong-drink"
      feedback: "The customer ordered tea but received water, so the problem is the wrong drink."
      ltFeedback: "Klientas užsisakė arbatos, bet gavo vandens, todėl problema – ne tas gėrimas."
    - id: "mission-04.detail"
      kind: "detail"
      prompt: "What will the waiter bring in a minute?"
      ltPrompt: "Ką padavėjas netrukus atneš?"
      hint: "Find the waiter's promise after “I'll bring”."
      ltHint: "Raskite padavėjo pažadą po žodžių „I'll bring“."
      options:
        - id: "cup-of-tea"
          text: "A cup of tea"
        - id: "bowl-of-soup"
          text: "A bowl of soup"
        - id: "glass-of-water"
          text: "A glass of water"
      answerId: "cup-of-tea"
      feedback: "The waiter says, “I'll bring your tea in a minute.” The promised drink is tea."
      ltFeedback: "Padavėjas sako: „I'll bring your tea in a minute.“ Jis pažada atnešti arbatos."
  shadowLine: "Sorry, I ordered tea, not water."
  shadowLineLt: "Atsiprašau, užsisakiau arbatos, o ne vandens."
steps:
  - kind: "brief"
    prompt: "You are in a cafe. First play the customer, then switch and play the waiter."
    ltPrompt: "Esate kavinėje. Pirma vaidinkite klientą, tada apsikeiskite vaidmenimis ir vaidinkite padavėją."
    support:
      - "Order food politely."
      - "Add one problem."
      - "Solve it calmly."
  - kind: "prep"
    prompt: "Choose your meal, your drink, and one problem."
    ltPrompt: "Pasirinkite patiekalą, gėrimą ir vieną problemą."
    seconds: 30
    support:
      - "Wrong drink"
      - "Cold soup"
      - "No table available"
  - kind: "speak"
    prompt: "Round 1: do the dialogue with support. Round 2: repeat without looking at the support."
    ltPrompt: "1 raundas: atlikite dialogą su pagalba. 2 raundas: pakartokite be pagalbos."
    seconds: 75
    support:
      - "Customer: Could I have..., please?"
      - "Waiter: Of course. Anything else?"
      - "Customer: Sorry, I think this is not my order."
      - "Waiter: I'm sorry. I'll change it right away."
  - kind: "compare"
    prompt: "Compare with this model exchange: Customer: Could I have the chicken soup and a cup of tea, please? Waiter: Of course. Anything else? Customer: No, thank you. Later: Sorry, I ordered tea, not water. Waiter: I'm sorry about that. I'll bring your tea in a minute. Customer: Thank you."
    ltPrompt: "Palyginkite savo dialogą su pavyzdžiu."
    support:
      - "Did both people sound polite?"
      - "Did you solve the problem instead of stopping?"
  - kind: "reflect"
    prompt: "Check whether the order, problem, and solution were all clear, then choose one role to improve on the second attempt."
    ltPrompt: "Patikrinkite, ar užsakymas, problema ir sprendimas buvo aiškūs, tada pasirinkite vieną vaidmenį, kurį patobulinsite antruoju bandymu."
    support:
      - "1 = I needed the support lines all the time."
      - "5 = I could improvise naturally."
      - "Accuracy: Did you use Could I have...? and a clear food or drink noun?"
      - "Second attempt: change the problem and solve it in fewer pauses."
---

This mission pushes Unit 4 into live dialogue. The main challenge is not vocabulary. The main challenge is switching roles and staying polite while something goes wrong.

## Useful Building Blocks / Naudingi sakiniai

- Could I have..., please? — Ar galėčiau gauti...?
- Anything else? — Ar dar ko nors?
- Sorry, I ordered..., not... — Atsiprašau, užsisakiau..., o ne...
- I'm sorry about that. — Atsiprašau dėl šios klaidos.
- I'll bring it right away. — Tuoj pat atnešiu.

## Success Check / Sėkmės kriterijai

Your dialogue succeeds when the customer orders a meal and drink politely, identifies one specific problem, and the waiter confirms a practical solution. On the second attempt, change both the problem and the solution, switch roles, and pause less without speaking too quickly.

## Push It Further / Pasunkinkite

- Add a price question.
- Try one version where the waiter is very busy but still polite.

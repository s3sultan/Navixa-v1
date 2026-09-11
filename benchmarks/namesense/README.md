# NAVIXA NameSense human accent benchmark

This benchmark exists to prevent a green unit-test suite from being mistaken for real-world name-detection accuracy.

## Evidence classes

- `human`: real speakers. This is the only evidence that can pass the release gate.
- `synthetic`: generated/replayed audio. Useful for engineering regressions only and always excluded from release evidence.

A 100% synthetic score must never be reported as human accent accuracy.

## Required accent groups

English: Indian (`en-IN`), Filipino (`en-PH`), American (`en-US`), British (`en-GB`).

Arabic: Gulf (`ar-GULF`), Egyptian (`ar-EG`), Syrian (`ar-SY`), Moroccan (`ar-MA`), Algerian (`ar-DZ`). Accent labels must be self-declared by the participant; NAVIXA must not infer nationality or identity from a voice recording.

## Release evidence minimums

For every required accent group:

- at least 25 distinct, pseudonymous speakers;
- at least 200 positive trials where the watched name is intentionally spoken;
- at least 200 negative trials containing confusable names/phrases but not the watched name;
- at least 3 device/microphone classes;
- at least 2 browser/platform families;
- at least 3 acoustic conditions such as clean, office/background speech, and lecture/echo;
- latency present on at least 95% of true-positive detections;
- no single speaker may contribute more than 10% of that accent group's trials.

These are minimums, not a claim that the resulting corpus represents every speaker.

## Release targets

Primary metrics:

1. Overall recall >= 97%.
2. Recall for every required accent >= 95%.
3. Overall false-positive rate <= 0.5%; each accent <= 1.0%.
4. P95 decision/alert latency <= 1500 ms.

The scorer also reports 95% Wilson intervals so a small sample cannot hide behind an attractive point estimate.

## Trial design

Positive prompts should vary position and language switching, for example name-only, title + name, name in the middle/end of a sentence, Arabic-English code switching, rapid speech, quiet speech, and realistic lecture phrasing.

Negative prompts must include hard confusables and ordinary speech. Examples include names such as Salman, Salim, Zoltan, Shelton, Sullivan, Mahmoud vs محمد, and words that contain similar substrings. Negatives are as important as positives because a noisy feature that fires constantly is not reliable.

Do not tune the matcher on the final holdout speakers. Keep development and release speakers disjoint.

## Privacy

Use random `speakerId` values. Do not store participant names, email addresses, phone numbers, account IDs, or hardware serials in benchmark files. Obtain consent for purpose-recorded clips. Store raw voice clips outside the Git repository with access controls and a defined retention period.

## External human speech sources

As of September 2026, Mozilla Common Voice Scripted Speech 26.0 is useful for accent robustness checks. Its English release contains self-declared accent metadata including United States, England, India/South Asia, and Filipino speakers. Its Arabic release also includes `accents` and `variant` metadata. Common Voice audio must not be re-hosted or re-shared from this repository.

Svarah is a separate CC BY 4.0 Indian-accent English benchmark with 9.6 hours from 117 speakers across 65 districts in 19 Indian states. It is useful for general Indian-English ASR stress testing.

Neither source replaces purpose-recorded name prompts. General speech can test ASR robustness, but it cannot prove that NAVIXA reliably detects a particular user's name.

## Result format

Each JSON trial must contain:

```json
{
  "id": "unique-trial-id",
  "mode": "human",
  "accent": "en-IN",
  "speakerId": "anon-017",
  "deviceClass": "laptop-built-in",
  "browser": "chrome-desktop",
  "noise": "lecture-echo",
  "expected": "hit",
  "detected": true,
  "latencyMs": 840
}
```

For a negative trial use `"expected": "miss"`. `latencyMs` is optional when no alert occurred.

## Scoring

Run:

```bash
npm run benchmark:namesense -- benchmarks/namesense/sample-results.json
```

The provided sample intentionally returns `NOT READY`; it demonstrates the schema, not product accuracy.

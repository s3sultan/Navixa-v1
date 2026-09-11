# NAVIXA NameSense human accent benchmark

This benchmark exists to prevent a green unit-test suite, a synthetic demo, or a small convenient sample from being mistaken for real-world name-detection accuracy.

## Evidence classes

- `human`: real speakers captured in a controlled live-microphone session. Only eligible holdout trials can pass the release gate.
- `synthetic`: generated/replayed audio. Useful for engineering regressions only and always excluded from release evidence.

A 100% synthetic score must never be reported as human accent accuracy. The scorer is not a forensic synthetic-audio detector; release provenance is a controlled collection-process requirement, not a cryptographic guarantee. Release sessions must therefore use the controlled collector and live microphone input rather than uploaded audio files.

## Required accent groups

English: Indian (`en-IN`), Filipino (`en-PH`), American (`en-US`), British (`en-GB`).

Arabic: Gulf (`ar-GULF`), Egyptian (`ar-EG`), Syrian (`ar-SY`), Moroccan (`ar-MA`), Algerian (`ar-DZ`). Accent labels are self-declared by participants. NAVIXA must not infer nationality, identity, or ethnicity from voice.

## Release evidence minimums

For **every** required accent group:

- at least 25 distinct pseudonymous holdout speakers;
- at least 500 positive trials where the watched name is intentionally spoken;
- at least 500 negative trials containing confusable names/phrases but not the watched name;
- each speaker contributes at least 24 total trials, including at least 10 positive and 10 negative trials;
- no single speaker contributes more than 6% of that accent group's trials;
- at least 25% of positive trials are dedicated latency prompts where the name is alone or the final spoken item;
- latency is present for at least 98% of detected latency-eligible positives;
- device mix, browser/platform mix, and acoustic mix must meet the configured minimum shares **separately for positive and negative trials as well as overall**.

The default mix requires at least 20% each for laptop built-in mic, headset, and phone; at least 25% each for desktop Chromium and iOS Safari; and at least 20% each for clean, office/background speech, and lecture/echo conditions. Remaining share may cover additional devices, browsers, or acoustic conditions.

Development speakers and final holdout speakers must be disjoint. The scorer blocks release when a holdout `speakerId` also appears in development human data.

These are minimums, not a claim that the resulting corpus represents every speaker or every environment.

## Release targets

Point estimates alone are not enough. NAVIXA gates on both observed metrics and 95% Wilson confidence bounds.

1. Overall recall >= 98%, with the 95% lower bound >= 97%.
2. Recall for every required accent >= 97%, with the 95% lower bound >= 95%.
3. Overall false-positive rate <= 0.5%, with the 95% upper bound <= 0.75%.
4. False-positive rate for every required accent <= 1.0%, with the 95% upper bound <= 2.0%.
5. P95 user-facing alert latency <= 1500 ms.

With 500 positive trials, 485/500 (97%) has a Wilson lower bound of about 95.1%, so the per-accent confidence gate is materially stronger than the original 200-trial design. With 500 negative trials, 4 false alerts already push the Wilson upper bound slightly above 2%, so the confidence gate is intentionally unforgiving.

## Latency definition

Primary latency is measured entirely on the client for dedicated name-only/name-final prompts:

`client VAD end of watched-name utterance -> NAVIXA name-alert dispatch`

Use `performance.now()` for both timestamps. This includes actual browser/local recognition runtime and UI alert dispatch, because the user experiences those delays. It excludes microphone permission/setup time and unrelated page/network setup. Trials with another latency boundary are rejected by the scorer.

## Trial design

Positive prompts vary position and language switching: name-only, title + name, name in the middle/end of a sentence, Arabic-English code switching, rapid speech, quiet speech, and realistic lecture phrasing.

Negative prompts include hard confusables and ordinary speech. Examples include Salman, Salim, Zoltan, Shelton, Sullivan, Mahmoud vs محمد, and similar substrings. Negative coverage is first-class because a listener that fires constantly is not reliable even if recall is high.

Do not tune the matcher on final holdout speakers or final holdout recordings.

## Privacy and collection rules

Raw human voice is sensitive and can be identifying. Pseudonymous IDs do not make raw audio anonymous.

For release evidence:

- obtain explicit participant consent for the benchmark session;
- capture from a live microphone in the controlled benchmark collector;
- process audio transiently for the trial;
- do not persist raw audio after the trial (`rawAudioRetained=false`);
- store only the minimum benchmark record needed for metrics;
- do not store participant names, email addresses, phone numbers, account IDs, precise location, device serial numbers, or other identifying metadata in benchmark files;
- keep collection access limited to the benchmark purpose and define a retention policy for result metadata.

If future research requires retained audio, it must use a separate approved protocol and **must not** be mixed into this release benchmark.

## External human speech sources

As of September 2026, Mozilla Common Voice Scripted Speech 26.0 is useful for general accent/ASR robustness checks. Its English release includes self-declared accent metadata for United States, England, India/South Asia, and Filipino speakers. Its Arabic release includes `accents` and `variant` metadata. Common Voice audio must not be re-hosted from this repository.

Svarah is a CC BY 4.0 Indian-accent English benchmark with 9.6 hours from 117 speakers across 65 districts in 19 Indian states. It is useful for general Indian-English ASR stress testing.

Neither source replaces purpose-recorded NameSense prompts. General speech can stress ASR, but it cannot prove that NAVIXA reliably detects a particular watched name.

## Result format

Each human release trial contains fields like:

```json
{
  "id": "unique-trial-id",
  "mode": "human",
  "split": "holdout",
  "provenance": "controlled-live",
  "captureMethod": "live-microphone",
  "consent": true,
  "rawAudioRetained": false,
  "accent": "en-IN",
  "speakerId": "anon-017",
  "deviceClass": "laptop-built-in",
  "browser": "desktop-chromium",
  "noise": "lecture-echo",
  "expected": "hit",
  "detected": true,
  "latencyEligible": true,
  "latencyMs": 840,
  "latencyBoundary": "client-vad-name-end-to-alert"
}
```

For a negative trial use `"expected": "miss"` and normally `"latencyEligible": false`.

## Scoring

Run:

```bash
npm run benchmark:namesense -- benchmarks/namesense/sample-results.json
```

The sample intentionally returns `NOT READY`. It demonstrates the schema and safeguards, not product accuracy.

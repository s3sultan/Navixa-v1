# Project TODO

- [x] Define important-versus-secondary reminder rules and user-controlled delivery preferences.
- [x] Add a durable reminder record and idempotent delivery status for important academic and task reminders.
- [x] Run important due reminders in the existing scheduled Worker without duplicating email or Telegram sends.
- [x] Keep secondary reminders inside NAVIXA only and surface them on the Today page.
- [x] Add focused tests for priority, user consent, duplicate prevention, and expired reminders.
- [x] Verify the full build and request approval before publishing reminder behavior.
- [x] Make the Wird audio player match the displayed surah and rotate a daily verified reciter selection.
- [ ] Verify the audio player and fallback behavior on mobile before publishing.
- [ ] Replace full-surah playback with an ordered recitation playlist for the ayahs shown on the active Quran page only.
- [ ] Verify that playback stops at the final ayah of the active page and continues on the next page the following day.

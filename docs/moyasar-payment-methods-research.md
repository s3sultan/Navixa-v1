# Moyasar payment-method research

## Sources reviewed — 2026-08-20

- https://docs.moyasar.com/guides/apple-pay/basic-integration
  - Moyasar provides an Apple Pay basic integration using its Payment Form JavaScript library.
  - Search result stated Apple Pay requires configuration in Apple Developer Account and Moyasar Dashboard.

- https://docs.moyasar.com/category/stc-pay
  - Moyasar documents STC Pay acceptance through its Payment Form JavaScript library.

- https://docs.moyasar.com/guides/stc-pay/testing
  - Moyasar provides a distinct STC Pay testing guide.

- https://moyasar.com/en/resources/faqs/
  - Moyasar lists Apple Pay and STC Pay among supported payment methods, in addition to cards and other methods.

## Product implications for NAVIXA

1. Apple Pay and STC Pay are availability controls inside the Moyasar integration; NAVIXA must keep them disabled by default and expose no public UI until an administrator enables the relevant method.
2. Apple Pay requires a configured Apple Pay certificate/domain flow in the Moyasar dashboard and must be tested on supported Apple devices.
3. STC Pay requires its own test flow and should be validated before public display.
4. The existing NAVIXA admin billing settings should own the exposure switch for each method; the payment endpoint must still require explicit public checkout and live-payment enablement.

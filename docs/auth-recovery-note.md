# NAVIXA auth recovery note

The production OTP code path remains ready, but `RESEND_API_KEY` is not currently present in GitHub Actions or the active Cloudflare Worker. Historical Worker metadata confirms it existed in version 911, but Cloudflare no longer allows that version to be activated. Production deploys therefore preserve any remote bindings that exist and continue safely with Google login instead of failing the whole site. Restoring email OTP requires a new valid Resend API key; no historical secret value is exposed or recoverable from Worker version metadata.

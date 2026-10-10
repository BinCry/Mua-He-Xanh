---
date: 2026-10-10
topic: explore-and-journey-ui-fixes
---

# Explore and journey UI fixes

## Context

Reported UI behavior on destination details and journey suggestions.

## What happened

- Kept the destination Like action as an outline button after it is selected; the heart alone becomes filled red.
- Corrected the add-to-journey error handler so only an actual HTTP 401 prompts a login; other failures retain their server message or a neutral retry message.
- Removed the shadow and undefined font fallback from the journey suggestion heading, using the shared Inter display font and a safe line height for Vietnamese diacritics.

## Decisions

- Added source-level regression tests to the default test suite for both visual states and the error-message distinction.
- No plan files existed to synchronize; no broader documentation update was needed.

## Next

- Deploy and hard-refresh client assets before confirming the visual result in production.

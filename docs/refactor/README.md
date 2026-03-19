# Refactor Documentation

This directory documents the current Paperclip refactor foundation execution state in English.

The goal is not to restate the source tree line by line. The goal is to explain:

- how the startup path is composed,
- how public URL resolution works,
- what the heartbeat runtime still needs measured,
- which tests currently prove the wiring,
- and where the remaining risk lives.

## Docs

- [Startup Bootstrap](./startup-bootstrap.md)
- [Access And Onboarding](./access-onboarding.md)
- [Heartbeat Runtime](./heartbeat-runtime.md)
- [Testing Evidence](./testing-evidence.md)
- [Release Readiness](./release-readiness.md)

## Scope

- These docs track the current refactor work on this fork.
- They intentionally avoid claiming final optimization or full runtime proof where we only have unit and orchestration coverage.
- They should be updated whenever a future wave changes startup wiring, heartbeat behavior, or onboarding URL semantics.

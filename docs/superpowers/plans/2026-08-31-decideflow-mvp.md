# DecideFlow MVP Implementation Plan

> **For agentic workers:** Implement task-by-task. Backend domain is TDD; HTTP and Flutter follow the spec in `docs/superpowers/specs/2026-08-31-decideflow-mvp-design.md`.

**Goal:** Ship a cross-platform Flutter MVP that guides a user through a full decision loop with persisted chat, RAG, report, and review reminder.

**Architecture:** FastAPI owns auth, stage machine, RAG, LLM/heuristic coach, and persistence. Flutter is a thin client. Vector/LLM/search are Protocol ports with local fallbacks so the app runs without vendor keys.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, SQLite, pytest, Flutter 3.47 / Dart 3.13, Provider, go_router, dio.

## Global Constraints

- MVP only: no payments, OAuth, SSE, admin UI, push provider.
- Knowledge files must be original summaries, never verbatim books.
- User data is scoped by `user_id`; never leak another user's decisions.
- Default language Chinese; respect `preferences.language` for coach replies.
- App runs with zero vendor keys via HeuristicCoach + LocalVectorStore + HashEmbedder.

## File map

- `backend/app/domain/stages.py` — stage enum and transitions
- `backend/app/domain/coach.py` — HeuristicCoach
- `backend/app/domain/report.py` — markdown report
- `backend/app/services/*` — ports + pinecone/openai/tavily adapters
- `backend/app/api/*` — HTTP
- `backend/knowledge/*.md` — seed RAG corpus
- `app/lib/**` — Flutter client

### Task 1: Domain stage machine, coach, report (pytest)

### Task 2: Persistence + auth + templates API

### Task 3: RAG ingest/query + chat orchestration + reviews

### Task 4: Flutter client screens for the user loop

### Task 5: Seed knowledge, wire README, verify web + API

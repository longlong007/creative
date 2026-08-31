from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from app.api.auth import router as auth_router
from app.api.decisions import router as decisions_router
from app.api.users import router as users_router
from app.config import Settings, get_settings
from app.db import Base, get_db, make_engine
from app.services.chat import ChatOrchestrator
from app.services.llm import build_coach
from app.services.rag import RagService, build_embedder, build_vector_store, build_web_search

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine = make_engine(settings.database_url)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    knowledge_dir = settings.knowledge_dir
    if not Path(knowledge_dir).is_absolute():
        knowledge_dir = str(BACKEND_ROOT / knowledge_dir)
    local_vector = settings.local_vector_path
    if not Path(local_vector).is_absolute():
        local_vector = str(BACKEND_ROOT / local_vector)

    embedder = build_embedder(settings)
    patched = settings.model_copy(update={"local_vector_path": local_vector, "knowledge_dir": knowledge_dir})
    store = build_vector_store(patched, embedder.dim)
    rag_service = RagService(embedder, store, knowledge_dir)
    rag_service.ingest_if_empty()
    orchestrator = ChatOrchestrator(
        rag=rag_service,
        coach=build_coach(settings.openai_api_key, settings.openai_model),
        search=build_web_search(settings),
    )

    application = FastAPI(title=settings.app_name, version="0.1.0")
    application.state.settings = settings
    application.state.orchestrator = orchestrator
    application.state.rag = rag_service
    application.state.session_factory = SessionLocal
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def _get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def _get_orchestrator(request: Request) -> ChatOrchestrator:
        return request.app.state.orchestrator

    application.dependency_overrides[get_db] = _get_db
    from app.api.decisions import get_orchestrator

    application.dependency_overrides[get_orchestrator] = _get_orchestrator
    application.include_router(auth_router, prefix="/api/v1")
    application.include_router(users_router, prefix="/api/v1")
    application.include_router(decisions_router, prefix="/api/v1")

    @application.get("/health")
    def health():
        return {"ok": True, "vectors": store.count()}

    return application


# uvicorn app.main:create_app --factory

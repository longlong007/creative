from pathlib import Path

from app.config import get_settings
from app.services.embeddings import HashEmbedder
from app.services.rag import RagService, build_vector_store


def main() -> None:
    settings = get_settings()
    embedder = HashEmbedder(settings.embedding_dim_hash)
    if settings.openai_api_key:
        from app.services.embeddings import OpenAIEmbedder

        embedder = OpenAIEmbedder(settings.openai_api_key, settings.openai_embedding_model)
    store = build_vector_store(settings, embedder.dim)
    knowledge = Path(__file__).resolve().parents[1] / "knowledge"
    service = RagService(embedder, store, str(knowledge))
    count = service.ingest()
    print(f"ingested {count} documents into {type(store).__name__}")


if __name__ == "__main__":
    main()

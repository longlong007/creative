from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings
from app.services.embeddings import Embedder, HashEmbedder, OpenAIEmbedder
from app.services.vector_store import LocalVectorStore, PineconeVectorStore, VectorStore
from app.services.web_search import (
    NoOpWebSearch,
    TavilyWebSearch,
    WebSearch,
    parse_markdown_docs,
)


@dataclass
class RetrievedChunk:
    id: str
    title: str
    text: str
    score: float

    def as_dict(self) -> dict[str, str | float]:
        return {"id": self.id, "title": self.title, "text": self.text[:800], "score": self.score}


class RagService:
    def __init__(self, embedder: Embedder, store: VectorStore, knowledge_dir: str):
        self.embedder = embedder
        self.store = store
        self.knowledge_dir = knowledge_dir

    def ingest_if_empty(self) -> int:
        if self.store.count() > 0:
            return 0
        return self.ingest()

    def ingest(self) -> int:
        docs = parse_markdown_docs(self.knowledge_dir)
        if not docs:
            return 0
        vectors = self.embedder.embed([f"{d['title']}\n{d['text']}" for d in docs])
        items = []
        for doc, vector in zip(docs, vectors):
            items.append(
                (
                    doc["id"],
                    vector,
                    {"title": doc["title"], "text": doc["text"][:3500]},
                )
            )
        self.store.upsert(items)
        return len(items)

    def search(self, query: str, top_k: int = 4) -> list[RetrievedChunk]:
        if not query.strip():
            return []
        vector = self.embedder.embed([query])[0]
        matches = self.store.query(vector, top_k=top_k)
        chunks: list[RetrievedChunk] = []
        for match in matches:
            meta = match.metadata
            chunks.append(
                RetrievedChunk(
                    id=match.id,
                    title=str(meta.get("title") or match.id),
                    text=str(meta.get("text") or ""),
                    score=match.score,
                )
            )
        return chunks


def build_embedder(settings: Settings) -> Embedder:
    if settings.openai_api_key:
        return OpenAIEmbedder(settings.openai_api_key, settings.openai_embedding_model)
    return HashEmbedder(settings.embedding_dim_hash)


def build_vector_store(settings: Settings, dim: int) -> VectorStore:
    if settings.pinecone_api_key and settings.openai_api_key:
        return PineconeVectorStore(
            api_key=settings.pinecone_api_key,
            index_name=settings.pinecone_index,
            dim=dim,
            cloud=settings.pinecone_cloud,
            region=settings.pinecone_region,
        )
    return LocalVectorStore(settings.local_vector_path)


def build_web_search(settings: Settings) -> WebSearch:
    if settings.tavily_api_key:
        return TavilyWebSearch(settings.tavily_api_key)
    return NoOpWebSearch()

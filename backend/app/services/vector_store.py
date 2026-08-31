from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from app.services.embeddings import cosine


@dataclass
class Match:
    id: str
    score: float
    metadata: dict[str, Any]


class VectorStore(Protocol):
    def upsert(self, items: list[tuple[str, list[float], dict[str, Any]]]) -> None: ...

    def query(self, vector: list[float], top_k: int = 4) -> list[Match]: ...

    def count(self) -> int: ...


class LocalVectorStore:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._data: dict[str, dict[str, Any]] = {}
        if self.path.exists():
            self._data = json.loads(self.path.read_text(encoding="utf-8"))

    def upsert(self, items: list[tuple[str, list[float], dict[str, Any]]]) -> None:
        for item_id, vector, metadata in items:
            self._data[item_id] = {"vector": vector, "metadata": metadata}
        self.path.write_text(json.dumps(self._data), encoding="utf-8")

    def query(self, vector: list[float], top_k: int = 4) -> list[Match]:
        scored: list[Match] = []
        for item_id, payload in self._data.items():
            score = cosine(vector, payload["vector"])
            scored.append(Match(id=item_id, score=score, metadata=payload.get("metadata") or {}))
        scored.sort(key=lambda m: m.score, reverse=True)
        return scored[:top_k]

    def count(self) -> int:
        return len(self._data)


class PineconeVectorStore:
    def __init__(self, api_key: str, index_name: str, dim: int, cloud: str, region: str):
        from pinecone import Pinecone, ServerlessSpec

        self._pc = Pinecone(api_key=api_key)
        existing = {idx.name for idx in self._pc.list_indexes()}
        if index_name not in existing:
            self._pc.create_index(
                name=index_name,
                dimension=dim,
                metric="cosine",
                spec=ServerlessSpec(cloud=cloud, region=region),
            )
        self._index = self._pc.Index(index_name)

    def upsert(self, items: list[tuple[str, list[float], dict[str, Any]]]) -> None:
        vectors = [{"id": i, "values": v, "metadata": m} for i, v, m in items]
        self._index.upsert(vectors=vectors)

    def query(self, vector: list[float], top_k: int = 4) -> list[Match]:
        result = self._index.query(vector=vector, top_k=top_k, include_metadata=True)
        matches = []
        for item in result.get("matches", []):
            matches.append(
                Match(
                    id=item["id"],
                    score=float(item.get("score") or 0),
                    metadata=item.get("metadata") or {},
                )
            )
        return matches

    def count(self) -> int:
        stats = self._index.describe_index_stats()
        return int(stats.get("total_vector_count") or 0)

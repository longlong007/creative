from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol


class Embedder(Protocol):
    dim: int

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class HashEmbedder:
    def __init__(self, dim: int = 256):
        self.dim = dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(text) for text in texts]

    def _one(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        tokens = _tokenize(text)
        if not tokens:
            return vec
        for token in tokens:
            digest = hashlib.md5(token.encode("utf-8")).digest()
            idx = int.from_bytes(digest[:4], "big") % self.dim
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


class OpenAIEmbedder:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.dim = 1536

    def embed(self, texts: list[str]) -> list[list[float]]:
        from openai import OpenAI

        client = OpenAI(api_key=self.api_key)
        response = client.embeddings.create(model=self.model, input=texts)
        return [item.embedding for item in response.data]


def _tokenize(text: str) -> list[str]:
    lowered = text.lower()
    parts = re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]{1,2}", lowered)
    return parts[:400]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))

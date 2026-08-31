from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str

    def as_dict(self) -> dict[str, str]:
        return {"title": self.title, "url": self.url, "snippet": self.snippet}


class WebSearch(Protocol):
    def search(self, query: str, max_results: int = 3) -> list[SearchResult]: ...


class NoOpWebSearch:
    def search(self, query: str, max_results: int = 3) -> list[SearchResult]:
        return []


class TavilyWebSearch:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(self, query: str, max_results: int = 3) -> list[SearchResult]:
        import httpx

        response = httpx.post(
            "https://api.tavily.com/search",
            json={"api_key": self.api_key, "query": query, "max_results": max_results},
            timeout=12.0,
        )
        response.raise_for_status()
        data = response.json()
        results = []
        for item in data.get("results", [])[:max_results]:
            results.append(
                SearchResult(
                    title=item.get("title") or "",
                    url=item.get("url") or "",
                    snippet=(item.get("content") or "")[:280],
                )
            )
        return results


def parse_markdown_docs(knowledge_dir: str) -> list[dict[str, str]]:
    root = Path(knowledge_dir)
    docs: list[dict[str, str]] = []
    if not root.exists():
        return docs
    for path in sorted(root.glob("*.md")):
        text = path.read_text(encoding="utf-8").strip()
        title = path.stem
        if text.startswith("#"):
            first, _, rest = text.partition("\n")
            title = first.lstrip("# ").strip() or title
            text = rest.strip()
        docs.append({"id": path.stem, "title": title, "text": text})
    return docs

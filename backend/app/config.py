from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "DecideFlow"
    secret_key: str = "dev-only-change-me-please-use-32chars"
    access_token_expire_minutes: int = 60 * 24 * 7
    database_url: str = "sqlite:///./data/decideflow.db"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    pinecone_api_key: str = ""
    pinecone_index: str = "decideflow-knowledge"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"
    tavily_api_key: str = ""
    knowledge_dir: str = "knowledge"
    local_vector_path: str = "data/local_vectors.json"
    embedding_dim_hash: int = 256
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

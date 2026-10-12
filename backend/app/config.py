from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-5-sonnet-latest"
    tavily_api_key: str | None = None
    sayari_client_id: str | None = None
    sayari_client_secret: str | None = None
    tradeverifyd_api_key: str | None = None
    database_url: str = "sqlite:///./data/ethical_sourcing.db"
    max_tier_depth: int = 2
    max_nodes_per_tier: int = 25
    max_upload_bytes: int = 20_000_000


@lru_cache
def get_settings() -> Settings:
    return Settings()
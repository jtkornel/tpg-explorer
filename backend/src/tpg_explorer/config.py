from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    traverse_url: str = "http://localhost:7691"
    traverse_api_key: str = ""
    default_database: str = "default"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    model_config = SettingsConfigDict(env_prefix="TPG_", env_file=".env", extra="ignore")


settings = Settings()

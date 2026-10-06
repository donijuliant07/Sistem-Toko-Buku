from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "PustakaGram Admin REST API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    SUPABASE_URL: str = Field(default="https://your-project.supabase.co", description="URL Project Supabase")
    SUPABASE_ANON_KEY: str = Field(default="your-anon-key", description="Anon Key Supabase")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="your-service-role-key", description="Service Role Key Supabase")
    SUPABASE_JWT_SECRET: str = Field(default="super-secret-jwt-key", description="JWT Secret Supabase Auth")

    FRONTEND_ORIGINS: str = "http://localhost:3000"
    STORAGE_BUCKET_PRODUCTS: str = "product-images"

    OPENROUTER_API_KEY: str = Field(default="", description="OpenRouter API Key")
    OPENROUTER_MODEL: str = Field(
        default="qwen/qwen-2.5-72b-instruct:free",
        description="Free OpenRouter Qwen Model",
    )

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
        description="Database URL PostgreSQL",
    )

    @property
    def database_url(self) -> str:
        return self.DATABASE_URL

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    @property
    def supabase_jwt_secret(self) -> str:
        return self.SUPABASE_JWT_SECRET


settings = Settings()

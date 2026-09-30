from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:[YOUR-PASSWORD]@db.zvjyhwygnxrnivenwbkn.supabase.co:5432/postgres"
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_anon_key: str = ""
    supabase_test_email: str = ""
    supabase_test_password: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()

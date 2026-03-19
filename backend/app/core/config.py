from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "GitOps SaaS Platform"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./gitops_platform.db"

    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    GITOPS_REPO_PATH: str = str(Path(__file__).resolve().parents[3] / "gitops-repo")
    GITOPS_REPO_URL: str = "https://github.com/imperfect0007/gitops-repo.git"
    GIT_BRANCH: str = "main"

    KUBECONFIG_PATH: str | None = None

    # Day 10: Custom domains + HTTPS
    BASE_DOMAIN: str = ""  # e.g. yourplatform.com — when set, Ingress + domain are generated per project
    TLS_ENABLED: bool = False  # use cert-manager and add TLS to Ingress
    CERT_MANAGER_ISSUER: str = "letsencrypt-prod"  # ClusterIssuer name
    INGRESS_CLASS: str = "nginx"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

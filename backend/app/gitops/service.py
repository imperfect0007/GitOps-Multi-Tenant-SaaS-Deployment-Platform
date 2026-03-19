import logging
from pathlib import Path

from git import Repo, GitCommandError

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_repo() -> Repo:
    repo_path = Path(settings.GITOPS_REPO_PATH)
    if not (repo_path / ".git").exists():
        logger.info("Cloning gitops repo to %s", repo_path)
        return Repo.clone_from(settings.GITOPS_REPO_URL, str(repo_path), branch=settings.GIT_BRANCH)
    return Repo(str(repo_path))


def push_manifests(tenant_namespace: str, project_name: str, manifests: dict[str, str]):
    """
    Write manifest files to the gitops repo and push.

    Args:
        tenant_namespace: e.g. "tenant-acme"
        project_name: e.g. "web-app"
        manifests: {"deployment.yaml": "...", "service.yaml": "..."}
    """
    repo = _get_repo()
    repo_path = Path(settings.GITOPS_REPO_PATH)

    project_dir = repo_path / "tenants" / tenant_namespace / project_name
    project_dir.mkdir(parents=True, exist_ok=True)

    for filename, content in manifests.items():
        file_path = project_dir / filename
        file_path.write_text(content, encoding="utf-8")
        logger.info("Wrote %s", file_path)

    repo.index.add([str(project_dir / f) for f in manifests])
    repo.index.commit(f"deploy {project_name} in {tenant_namespace}")

    try:
        origin = repo.remote("origin")
        origin.push(settings.GIT_BRANCH)
        logger.info("Pushed to %s branch %s", settings.GITOPS_REPO_URL, settings.GIT_BRANCH)
    except GitCommandError as e:
        logger.error("Git push failed: %s", e)
        raise


def remove_project(tenant_namespace: str, project_name: str):
    """Remove a project's manifests from the gitops repo and push."""
    repo = _get_repo()
    repo_path = Path(settings.GITOPS_REPO_PATH)

    project_dir = repo_path / "tenants" / tenant_namespace / project_name
    if not project_dir.exists():
        return

    import shutil
    shutil.rmtree(project_dir)

    repo.index.add(["*"])
    repo.index.commit(f"remove {project_name} from {tenant_namespace}")

    try:
        origin = repo.remote("origin")
        origin.push(settings.GIT_BRANCH)
    except GitCommandError as e:
        logger.error("Git push failed: %s", e)
        raise

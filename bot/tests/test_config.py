"""The documented model and disabled upload defaults must match startup."""
from pathlib import Path

from app.core.config import Settings


def test_cloud_defaults_require_consent_and_use_documented_model(monkeypatch):
    for key in ("GEMINI_MODEL", "AI_UPLOAD_CONSENT", "AI_PROVIDER"):
        monkeypatch.delenv(key, raising=False)
    settings = Settings(_env_file=None)
    template = Path(__file__).resolve().parents[1] / ".env.example"
    model = next(line.split("=", 1)[1] for line in template.read_text().splitlines() if line.startswith("GEMINI_MODEL="))
    assert settings.GEMINI_MODEL == model
    assert settings.AI_UPLOAD_CONSENT is False

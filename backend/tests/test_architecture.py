import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def loaded_after_importing(module: str) -> set[str]:
    """Modules that importing `module` in a fresh interpreter pulls in."""
    code = f"import sys, {module}; print('\\n'.join(sys.modules))"
    result = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, capture_output=True, text=True, check=True)
    return set(result.stdout.split())


def test_services_do_not_depend_on_the_gemini_sdk():
    """Services talk to the ports in app.ports; only the Gemini adapters may import the SDK."""
    for module in ("app.service", "app.dto", "app.repository", "app.ports"):
        assert "google.genai" not in loaded_after_importing(module), module


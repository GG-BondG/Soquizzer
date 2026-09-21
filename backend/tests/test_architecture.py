import re
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



def test_only_the_gateway_imports_the_gemini_sdk():
    sdk_import = re.compile(r"^\s*(from|import) google\b", re.MULTILINE)
    offenders = [
        str(path.relative_to(BACKEND))
        for path in (BACKEND / "app").rglob("*.py")
        if path.name != "gemini_gateway.py" and sdk_import.search(path.read_text())
    ]
    assert offenders == []


def test_services_take_plain_values_not_http_request_schemas():
    """Controllers unpack request bodies; a service must not know the shape of the HTTP layer's input."""
    request_import = re.compile(r"^from app\.dto import .*Request", re.MULTILINE)
    offenders = [path.name for path in (BACKEND / "app" / "service").glob("*.py") if request_import.search(path.read_text())]
    assert offenders == []

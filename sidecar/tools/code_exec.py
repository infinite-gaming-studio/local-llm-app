import subprocess
import tempfile
import os


def run_python(code: str, timeout: int = 30) -> str:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        f.flush()
        try:
            result = subprocess.run(
                ["python3", f.name],
                capture_output=True,
                text=True,
                timeout=timeout,
                env={**os.environ, "PYTHONPATH": ""},
            )
            if result.returncode == 0:
                return result.stdout or "(no output)"
            else:
                return f"Error:\n{result.stderr}"
        except subprocess.TimeoutExpired:
            return "Error: execution timed out"
        finally:
            os.unlink(f.name)


def run_shell(cmd: str, timeout: int = 30) -> str:
    DENIED = ["rm -rf", "sudo", "mkfs", "dd", ":(){ :|:& };:"]
    for dangerous in DENIED:
        if dangerous in cmd:
            return f"Error: command denied (matches dangerous pattern: {dangerous})"

    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.stdout or result.stderr or "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: command timed out"

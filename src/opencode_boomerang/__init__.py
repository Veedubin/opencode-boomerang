"""opencode-boomerang: Multi-agent orchestration plugin for OpenCode.

This package provides the Boomerang plugin for OpenCode, enabling intelligent
multi-agent coordination through a team of specialized AI agents working together
on your codebase.

Key Features:
- Multi-agent orchestration with specialized sub-agents
- 6-step Boomerang Protocol for consistent code delivery
- Quality gates (lint, typecheck, tests)
- Git discipline enforcement
- Long-term memory integration via super-memory

For usage, see: https://github.com/Veedubin/opencode-boomerang
"""

from importlib.resources import files
from pathlib import Path

__version__ = "0.1.1"

ASSETS_DIR = files(__name__) / "assets" / ".opencode"


def get_assets_dir() -> Path:
    """Return the path to the installed .opencode assets directory.

    Returns:
        Path to the opencode_boomerang/assets/.opencode directory
    """
    # Use as_file to get a concrete filesystem path from the Traversable
    from importlib.resources import as_file

    with as_file(ASSETS_DIR) as assets_path:
        return Path(assets_path)


def install_to_project(project_dir: Path) -> None:
    """Copy the .opencode assets into a target project directory.

    This copies the agents, skills, and plugins into the target project's
    .opencode directory.

    Args:
        project_dir: The root directory of the target project (containing .opencode/)

    Raises:
        FileNotFoundError: If project_dir does not contain a .opencode/ directory
        NotADirectoryError: If project_dir is not a directory
    """
    import shutil

    project_dir = Path(project_dir)
    opencode_dir = project_dir / ".opencode"

    if not opencode_dir.is_dir():
        raise FileNotFoundError(
            f"Project directory '{project_dir}' does not contain a .opencode/ directory"
        )

    assets_dir = get_assets_dir()

    # Copy agents, skills, and plugins directories
    for item in ["agents", "skills", "plugins"]:
        src = assets_dir / item
        dst = opencode_dir / item
        if src.exists():
            if dst.exists():
                # Merge by overwriting existing files
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copytree(src, dst)

    # Also copy the opencode.json.example if it exists
    example_config = assets_dir / "opencode.json.example"
    if example_config.exists():
        shutil.copy2(example_config, opencode_dir / "opencode.json.example")

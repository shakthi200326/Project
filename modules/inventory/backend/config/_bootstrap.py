import sys
from pathlib import Path
from importlib.util import spec_from_file_location

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent

class HyphenDirFinder:
    ALIASES = {
        "shared_file_storage": PROJECT_ROOT / "shared" / "backend" / "file-storage",
        "shared_event_bus": PROJECT_ROOT / "shared" / "backend" / "event-bus",
        "shared_audit": PROJECT_ROOT / "shared" / "backend" / "audit",
        "platform_context": PROJECT_ROOT / "platform" / "context-service",
    }

    @classmethod
    def find_spec(cls, fullname, path=None, target=None):
        parts = fullname.split(".")
        root_name = parts[0]
        if root_name in cls.ALIASES:
            base_path = cls.ALIASES[root_name]
            if len(parts) == 1:
                init_file = base_path / "__init__.py"
                if not init_file.exists():
                    init_file.write_text("", encoding="utf-8")
                return spec_from_file_location(fullname, str(init_file), submodule_search_locations=[str(base_path)])
            else:
                subpath = base_path.joinpath(*parts[1:])
                if subpath.is_dir() and (subpath / "__init__.py").exists():
                    return spec_from_file_location(fullname, str(subpath / "__init__.py"), submodule_search_locations=[str(subpath)])
                elif subpath.with_suffix(".py").exists():
                    return spec_from_file_location(fullname, str(subpath.with_suffix(".py")))
        return None

if not any(isinstance(finder, type) and finder.__name__ == "HyphenDirFinder" for finder in sys.meta_path):
    sys.meta_path.insert(0, HyphenDirFinder)

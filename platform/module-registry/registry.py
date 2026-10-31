import json
from pathlib import Path
from typing import Dict, Any, List

class ModuleRegistry:
    """Discovers, registers, and tracks enabled business modules."""
    _modules: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def register_module(cls, manifest_path: Path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
            code = manifest["code"]
            cls._modules[code] = manifest

    @classmethod
    def get_module(cls, code: str) -> Dict[str, Any]:
        return cls._modules.get(code)

    @classmethod
    def list_modules(cls) -> List[Dict[str, Any]]:
        return list(cls._modules.values())

    @classmethod
    def is_enabled(cls, code: str) -> bool:
        mod = cls.get_module(code)
        return mod.get("enabled", True) if mod else False

"""
Platform Project Service
Manages capital projects, work orders, and project-allocated stock assignments.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class ProjectContext:
    project_id: str
    code: str
    title: str
    status: str = "ACTIVE"

    @classmethod
    def default(cls) -> "ProjectContext":
        return cls(
            project_id="prj-default",
            code="PRJ-GEN-OPS",
            title="General Plant & Warehouse Operations",
        )


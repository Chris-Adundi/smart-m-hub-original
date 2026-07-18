from __future__ import annotations

from fastapi import APIRouter


def path_matches(path: str, prefixes: tuple[str, ...]) -> bool:
    candidates = {path}
    if path.startswith("/api/"):
        candidates.add(path[len("/api"):])
    return any(
        candidate == prefix or candidate.startswith(f"{prefix}/")
        for candidate in candidates
        for prefix in prefixes
    )


def move_routes(source: APIRouter, destination: APIRouter, prefixes: tuple[str, ...]) -> int:
    moved = []
    remaining = []
    for route in source.routes:
        path = getattr(route, "path", "")
        if path_matches(path, prefixes):
            moved.append(route)
        else:
            remaining.append(route)
    source.routes = remaining
    destination.routes.extend(moved)
    return len(moved)

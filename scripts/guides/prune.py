"""Remove obsolete published builds without touching capture or speech caches."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil

from common import PUBLIC, language_tag


def prune(public=PUBLIC, *, dry_run=False, guide=None):
    public = Path(public).resolve()
    index = json.loads((public / "index.json").read_text())
    if index.get("schemaVersion") != 1 or not isinstance(index.get("variants"), list):
        raise ValueError("Cannot prune an unsupported guide index")
    retained = set()
    # Validate every indexed asset before deleting anything. A stale or broken
    # index must not turn the last usable recordings into deletion candidates.
    for variant in index["variants"]:
        name, locale, api, theme, build = (variant[key] for key in ("guide", "language", "apiLevel", "theme", "build"))
        if not re.fullmatch(r"[a-z0-9-]+", name) or type(api) is not int or api < 1 or theme not in ("light", "dark") or not re.fullmatch(r"[a-f0-9]{16}", build):
            raise ValueError("Cannot prune an invalid variant")
        language_tag(locale)
        relative = Path(name) / locale / f"api-{api}" / theme / build
        directory = public / relative
        if directory.resolve() != directory or not directory.is_dir():
            raise ValueError(f"Cannot prune: indexed build is missing or linked: {relative}")
        urls = [variant[key] for key in ("poster", "webm", "mp4", "chapters")]
        if variant.get("captions"):
            urls.append(variant["captions"])
        urls.extend(step["image"] for step in variant["steps"])
        prefix = f"/guides/{relative.as_posix()}/"
        for url in urls:
            if not url.startswith(prefix):
                raise ValueError("Cannot prune: indexed asset is outside its build")
            filename = url[len(prefix):]
            if not filename or Path(filename).name != filename or not (directory / filename).is_file():
                raise ValueError(f"Cannot prune: indexed asset is missing: {url}")
        retained.add(directory)
    obsolete = []
    for directory in sorted(public.glob("*/*/api-*/*/*")):
        if not re.fullmatch(r"[a-f0-9]{16}", directory.name) or not directory.is_dir():
            continue
        if directory.resolve() != directory or directory in retained:
            continue
        if guide is not None and directory.relative_to(public).parts[0] != guide:
            continue
        obsolete.append(directory)
    for directory in obsolete:
        print(f"{'Would remove' if dry_run else 'Removing'} {directory.relative_to(public)}")
        if not dry_run:
            shutil.rmtree(directory)
    print(f"{'Would remove' if dry_run else 'Removed'} {len(obsolete)} obsolete builds; kept {len(retained)} indexed builds.")
    return obsolete


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List obsolete builds without deleting them")
    parser.add_argument("--guide", help="Prune only this guide ID")
    args = parser.parse_args()
    try:
        prune(dry_run=args.dry_run, guide=args.guide)
    except (ValueError, KeyError, TypeError, OSError) as error:
        parser.exit(1, f"Guide pruning failed: {error}\n")

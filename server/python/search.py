#!/usr/bin/env python3
"""Small JSON adapter around ytmusicapi's public, unauthenticated search."""

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'ytmusic-function'))
from catalog import handle_request


def main() -> int:
    request = json.load(sys.stdin)
    print(json.dumps(handle_request(request), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - send diagnostics only to the server log
        print(f"ytmusicapi request failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error

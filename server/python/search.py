#!/usr/bin/env python3
"""Small JSON adapter around ytmusicapi's public, unauthenticated search."""

import json
import re
import sys

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def search(query: str) -> list[dict[str, object]]:
    from ytmusicapi import YTMusic

    matches = YTMusic().search(query, filter="songs", limit=20)
    results: list[dict[str, object]] = []
    for item in matches:
        video_id = item.get("videoId")
        title = item.get("title")
        if not isinstance(video_id, str) or not VIDEO_ID.fullmatch(video_id):
            continue
        if item.get("resultType") != "song" or not isinstance(title, str) or not title.strip():
            continue

        artists = item.get("artists") or []
        artist_names = [
            artist.get("name")
            for artist in artists
            if isinstance(artist, dict) and isinstance(artist.get("name"), str)
        ]
        thumbnails = item.get("thumbnails") or []
        thumbnail_url = None
        for thumbnail in reversed(thumbnails):
            if isinstance(thumbnail, dict) and isinstance(thumbnail.get("url"), str):
                thumbnail_url = thumbnail["url"]
                break

        duration = item.get("duration_seconds")
        results.append(
            {
                "videoId": video_id,
                "title": title.strip()[:200],
                "artist": ", ".join(artist_names)[:200],
                "durationSec": duration if isinstance(duration, int) and duration >= 0 else None,
                "thumbnailUrl": thumbnail_url,
            }
        )
        if len(results) == 20:
            break
    return results


def main() -> int:
    request = json.load(sys.stdin)
    if request.get("action") == "check":
        import ytmusicapi  # noqa: F401

        print(json.dumps({"ready": True}))
        return 0

    query = request.get("query")
    if request.get("action") != "search" or not isinstance(query, str) or len(query.strip()) < 2:
        print("Invalid search request", file=sys.stderr)
        return 2

    print(json.dumps(search(query.strip()), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - send diagnostics only to the server log
        print(f"ytmusicapi request failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error

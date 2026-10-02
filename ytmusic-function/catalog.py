"""Shared unauthenticated YouTube Music search used by local and Vercel runtimes."""

import re

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def search(query: str) -> list[dict[str, object]]:
    from ytmusicapi import YTMusic

    matches = YTMusic().search(query, filter="songs", limit=20)
    if not isinstance(matches, list):
        return []

    results: list[dict[str, object]] = []
    for item in matches:
        if not isinstance(item, dict):
            continue
        video_id = item.get("videoId")
        title = item.get("title")
        if not isinstance(video_id, str) or not VIDEO_ID.fullmatch(video_id):
            continue
        if item.get("resultType") != "song" or not isinstance(title, str) or not title.strip():
            continue

        raw_artists = item.get("artists")
        artists = raw_artists if isinstance(raw_artists, list) else []
        artist_names = [
            artist["name"].strip()
            for artist in artists
            if isinstance(artist, dict)
            and isinstance(artist.get("name"), str)
            and artist["name"].strip()
        ]
        raw_thumbnails = item.get("thumbnails")
        thumbnails = raw_thumbnails if isinstance(raw_thumbnails, list) else []
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
                "durationSec": (
                    duration
                    if isinstance(duration, int) and not isinstance(duration, bool) and duration >= 0
                    else None
                ),
                "thumbnailUrl": thumbnail_url,
            }
        )
        if len(results) == 20:
            break
    return results


def handle_request(request: object) -> object:
    if not isinstance(request, dict):
        raise ValueError("Invalid search request")
    if request.get("action") == "check":
        import ytmusicapi  # noqa: F401

        return {"ready": True}

    query = request.get("query")
    if (
        request.get("action") != "search"
        or not isinstance(query, str)
        or len(query.strip()) < 2
        or len(query.strip()) > 100
    ):
        raise ValueError("Invalid search request")
    return search(query.strip())

import sys
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import catalog


class FakeYTMusic:
    def __init__(self, rows):
        self.rows = rows
        self.call = None

    def search(self, query, filter, limit):
        self.call = (query, filter, limit)
        return self.rows


def fake_ytmusic_module(rows):
    module = ModuleType("ytmusicapi")
    module.YTMusic = lambda: FakeYTMusic(rows)
    return module


class CatalogTests(unittest.TestCase):
    def test_search_skips_malformed_provider_rows_and_optional_fields(self):
        rows = [
            None,
            {
                "videoId": "dQw4w9WgXcQ",
                "resultType": "song",
                "title": "  Canción válida  ",
                "artists": 7,
                "thumbnails": 3,
                "duration_seconds": True,
            },
        ]
        with patch.dict(sys.modules, {"ytmusicapi": fake_ytmusic_module(rows)}):
            result = catalog.search("  prueba musical  ")

        self.assertEqual(
            result,
            [
                {
                    "videoId": "dQw4w9WgXcQ",
                    "title": "Canción válida",
                    "artist": "",
                    "durationSec": None,
                    "thumbnailUrl": None,
                }
            ],
        )

    def test_search_limits_results_and_sanitizes_unicode_metadata(self):
        rows = [
            {
                "videoId": f"id{index:09d}",
                "resultType": "song",
                "title": "  Música 東京  " + ("x" * 220),
                "artists": [{"name": "  Artista ñ  "}, {"name": 3}, None],
                "thumbnails": [{"url": "small"}, {"url": "https://img.example/cover.jpg"}],
                "duration_seconds": 0,
            }
            for index in range(25)
        ]
        with patch.dict(sys.modules, {"ytmusicapi": fake_ytmusic_module(rows)}):
            result = catalog.search("  canción 東京  ")

        self.assertEqual(len(result), 20)
        self.assertEqual(result[0]["title"], ("Música 東京  " + ("x" * 220))[:200])
        self.assertEqual(result[0]["artist"], "Artista ñ")
        self.assertEqual(result[0]["durationSec"], 0)
        self.assertEqual(result[0]["thumbnailUrl"], "https://img.example/cover.jpg")

    def test_handle_request_accepts_check_and_rejects_invalid_search_bounds(self):
        with patch.dict(sys.modules, {"ytmusicapi": fake_ytmusic_module([])}):
            self.assertEqual(catalog.handle_request({"action": "check"}), {"ready": True})

        for request in (
            None,
            [],
            {"action": "other", "query": "canción"},
            {"action": "search", "query": "x"},
            {"action": "search", "query": "x" * 101},
            {"action": "search", "query": 12},
        ):
            with self.subTest(request=request):
                with self.assertRaises(ValueError):
                    catalog.handle_request(request)


if __name__ == "__main__":
    unittest.main()

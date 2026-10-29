"""Serve the app locally: python3 serve.py [port]  (default 8766)

Same as `python3 -m http.server`, plus a no-cache header so the browser
always picks up edits to the program instead of a stale copy.
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    root = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(NoCacheHandler, directory=root)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Ruth's Exercises: http://localhost:{port}  (Ctrl+C to stop)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()

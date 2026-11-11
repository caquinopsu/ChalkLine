"""
Local stand-in for Vercel's Python runtime: serves api/check.py at http://127.0.0.1:8000/api/check.
`npm run dev` starts this next to Next.js, and next.config.ts forwards /api/check here in development.
"""

import sys  # lets us tell Python where to find api/check.py
from http.server import ThreadingHTTPServer  # a small web server that handles requests in parallel
from pathlib import Path  # file paths that work on Windows and Mac

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))  # make "import check" find api/check.py
from check import handler  # noqa: E402 - the same handler class Vercel runs

PORT = 8000  # the port Next.js forwards to

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)  # every request goes to our handler
    print(f"SymPy checker running at http://127.0.0.1:{PORT}/api/check")
    server.serve_forever()  # keep running until Ctrl+C

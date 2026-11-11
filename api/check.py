"""
SymPy math checker: a Python serverless function that Vercel serves at /api/check.

  GET /api/check             -> runs a fixed self-test (proves SymPy works on the server)
  GET /api/check?a=...&b=... -> says whether expressions a and b are mathematically equal

Expressions use SymPy syntax, e.g.  x^2*exp(x)  or  sin(x)^2 + cos(x)^2.
(Phase 1 will add converting the AI's LaTeX into this format.)

Run locally (no web server needed):  .venv\\Scripts\\python api\\check.py
"""

import json  # turns Python dicts into JSON text for the response
import re  # regular expressions, used to reject unsafe input
from http.server import BaseHTTPRequestHandler  # the handler style Vercel runs for /api/*.py files
from urllib.parse import parse_qs, urlparse  # reads ?a=...&b=... out of the URL

import sympy  # the symbolic math library
from sympy.parsing.sympy_parser import (  # tools that turn a text string into a SymPy expression
    convert_xor,  # lets students write x^2 instead of Python's x**2
    implicit_multiplication_application,  # lets "2x" mean 2*x and "sin x" mean sin(x)
    parse_expr,  # the parser itself
    standard_transformations,  # SymPy's default parsing rules
)

MAX_LEN = 200  # longest expression we accept (keeps the server from doing huge work)

# Only these characters may appear in an expression. No quotes, underscores or brackets,
# which blocks attempts to sneak Python code in through the parser.
ALLOWED_CHARS = re.compile(r"^[A-Za-z0-9\s+\-*/^().,]*$")

# The only names the parser may use. Any other name (like x or n) becomes a plain math symbol.
# "__builtins__": {} removes Python's built-in functions (open, eval, ...) from reach.
SAFE_NAMES = {
    "__builtins__": {},
    # building blocks the parser itself generates when it reads text
    "Integer": sympy.Integer, "Float": sympy.Float, "Rational": sympy.Rational,
    "Symbol": sympy.Symbol, "Function": sympy.Function,
    # constants
    "pi": sympy.pi, "E": sympy.E, "e": sympy.E, "oo": sympy.oo, "I": sympy.I,
    # functions students will use in Calc I and II
    "sin": sympy.sin, "cos": sympy.cos, "tan": sympy.tan,
    "sec": sympy.sec, "csc": sympy.csc, "cot": sympy.cot,
    "asin": sympy.asin, "acos": sympy.acos, "atan": sympy.atan,
    "arcsin": sympy.asin, "arccos": sympy.acos, "arctan": sympy.atan,
    "sinh": sympy.sinh, "cosh": sympy.cosh, "tanh": sympy.tanh,
    "exp": sympy.exp, "log": sympy.log, "ln": sympy.log,
    "sqrt": sympy.sqrt, "Abs": sympy.Abs, "abs": sympy.Abs, "factorial": sympy.factorial,
}

# Parsing rules: SymPy defaults + allow ^ for powers + allow implicit multiplication.
TRANSFORMS = standard_transformations + (convert_xor, implicit_multiplication_application)


def parse(text: str):
    """Safely turn a string like 'x^2 + 2x' into a SymPy expression."""
    if len(text) > MAX_LEN:  # refuse very long input
        raise ValueError(f"Expression is longer than {MAX_LEN} characters.")
    if not ALLOWED_CHARS.match(text):  # refuse unexpected characters
        raise ValueError("Expression contains characters that aren't allowed.")
    if re.search(r"[A-Za-z)]\s*\.", text):  # refuse "name." (Python attribute access); decimals like 2.5 are fine
        raise ValueError("Expression contains a '.' after a name, which isn't allowed.")
    return parse_expr(text, global_dict=dict(SAFE_NAMES), transformations=TRANSFORMS)  # copy so the parser can't change our table


def equivalent(a, b) -> bool:
    """True when a and b are the same math, i.e. a - b simplifies to 0."""
    return sympy.simplify(a - b) == 0


def self_test() -> dict:
    """Fixed check from preset problem 3: d/dx [ e^(x^2) / 2 ] should equal x*e^(x^2)."""
    x = sympy.Symbol("x")  # the variable x
    antiderivative = sympy.exp(x**2) / 2  # the expected answer to the integral of x*e^(x^2)
    integrand = x * sympy.exp(x**2)  # the function we integrated
    derivative = sympy.diff(antiderivative, x)  # differentiate the answer...
    return {  # ...and confirm it gives back the integrand
        "ok": True,
        "sympy_version": sympy.__version__,
        "test": "d/dx [ e^(x^2) / 2 ] == x * e^(x^2)",
        "derivative": str(derivative),
        "equivalent": equivalent(derivative, integrand),
    }


def compare(a_text: str, b_text: str) -> dict:
    """Parse two user expressions and report whether they're equal."""
    a = parse(a_text)  # first expression
    b = parse(b_text)  # second expression
    return {"ok": True, "a": str(a), "b": str(b), "equivalent": equivalent(a, b)}


class handler(BaseHTTPRequestHandler):
    """Vercel calls this class for every request to /api/check."""

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)  # e.g. {"a": ["x^2"], "b": ["x*x"]}
        a_text = query.get("a", [None])[0]  # first value of ?a=, or None
        b_text = query.get("b", [None])[0]  # first value of ?b=, or None
        try:
            if a_text is None and b_text is None:  # no inputs -> run the self-test
                self._send(200, self_test())
            elif a_text is None or b_text is None:  # only one input -> explain the mistake
                self._send(400, {"ok": False, "error": "Provide both ?a= and ?b=, or neither."})
            else:  # both inputs -> compare them
                self._send(200, compare(a_text, b_text))
        except Exception as err:  # bad input (or a math error) -> friendly JSON instead of a crash
            self._send(400, {"ok": False, "error": str(err)})

    def _send(self, status: int, body: dict):
        """Write a JSON response."""
        data = json.dumps(body).encode("utf-8")  # dict -> JSON text -> bytes
        self.send_response(status)  # HTTP status code (200 = OK, 400 = bad request)
        self.send_header("Content-Type", "application/json")  # tell the browser it's JSON
        self.send_header("Content-Length", str(len(data)))  # size of the body
        self.end_headers()  # finished the headers
        self.wfile.write(data)  # send the body


if __name__ == "__main__":  # only runs when you start this file directly, not on Vercel
    print(json.dumps(self_test(), indent=2))  # the fixed self-test
    print(json.dumps(compare("sin(x)^2 + cos(x)^2", "1"), indent=2))  # a trig identity -> true
    print(json.dumps(compare("2x + 1", "x + 1"), indent=2))  # not equal -> false

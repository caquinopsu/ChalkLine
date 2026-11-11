"""
SymPy math checker: a Python serverless function that Vercel serves at /api/check.

  GET  /api/check             -> fixed self-test (proves SymPy works on the server)
  GET  /api/check?a=...&b=... -> are expressions a and b equal? (friendly syntax: 2x, x^2)
  POST /api/check             -> batch check used by the app (strict SymPy syntax), body:
        {"pairs": [["a1", "b1"], ["a2", "b2"]], "mode": "value" | "antiderivative", "var": "x"}
     -> {"ok": true, "results": [{"equivalent": true | false | null, "error": "..."}]}
        equivalent = null means "couldn't decide" (the app then trusts the AI's judgment).

Modes:
  value          -> a and b must be exactly equal (limits, derivatives, algebra)
  antiderivative -> a and b may differ by a constant (+ C), i.e. d/dx (a - b) = 0

Run locally (no web server needed):  .venv\\Scripts\\python api\\check.py
"""

import json  # turns Python dicts into JSON text and back
import re  # regular expressions, used to reject unsafe input
from concurrent.futures import ThreadPoolExecutor  # lets us give up on math that takes too long
from concurrent.futures import TimeoutError as FutureTimeout  # the error raised when time runs out
from http.server import BaseHTTPRequestHandler  # the handler style Vercel runs for /api/*.py files
from urllib.parse import parse_qs, urlparse  # reads ?a=...&b=... out of the URL

import sympy  # the symbolic math library
from sympy.parsing.sympy_parser import (  # tools that turn a text string into a SymPy expression
    convert_xor,  # lets x^2 mean x**2
    implicit_multiplication_application,  # lets "2x" mean 2*x and "sin x" mean sin(x)
    parse_expr,  # the parser itself
    standard_transformations,  # SymPy's default parsing rules
)

MAX_LEN = 400  # longest expression we accept (keeps the server from doing huge work)
MAX_PAIRS = 12  # most comparisons allowed in one request
TIME_LIMIT = 8.0  # seconds we spend on one comparison before answering "couldn't decide"

# Only these characters may appear. No quotes, underscores, brackets or "=", which blocks
# attempts to sneak Python code in through the parser.
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
    "sqrt": sympy.sqrt, "Abs": sympy.Abs, "abs": sympy.Abs,
    "factorial": sympy.factorial, "binomial": sympy.binomial,
    # calculus objects (unevaluated until we call .doit())
    "Integral": sympy.Integral, "Limit": sympy.Limit, "Derivative": sympy.Derivative,
    "Sum": sympy.Sum, "integrate": sympy.integrate, "diff": sympy.diff, "limit": sympy.limit,
}

# Friendly rules (for people typing in the URL): defaults + ^ for powers + implicit multiplication.
FRIENDLY = standard_transformations + (convert_xor, implicit_multiplication_application)
# Strict rules (for the app, whose expressions the AI writes in proper SymPy syntax).
STRICT = standard_transformations + (convert_xor,)

# Points where we test "are these equal?" numerically. Chosen positive and away from 0 and 1,
# so logs, square roots and fractions stay defined.
SAMPLE_POINTS = [0.37, 0.81, 1.23, 1.71, 2.29, 3.07]


def parse(text: str, strict: bool = False):
    """Safely turn a string like 'x^2 + 2x' into a SymPy expression."""
    if len(text) > MAX_LEN:  # refuse very long input
        raise ValueError(f"Expression is longer than {MAX_LEN} characters.")
    if not ALLOWED_CHARS.match(text):  # refuse unexpected characters
        raise ValueError("Expression contains characters that aren't allowed.")
    if re.search(r"[A-Za-z)]\s*\.", text):  # refuse "name." (Python attribute access); decimals like 2.5 are fine
        raise ValueError("Expression contains a '.' after a name, which isn't allowed.")
    rules = STRICT if strict else FRIENDLY  # pick the parsing rules
    return parse_expr(text, global_dict=dict(SAFE_NAMES), transformations=rules)  # copy so the parser can't change our table


def numeric_zero(expr, var) -> bool | None:
    """Is expr equal to 0 everywhere? Tested by plugging in sample numbers.
    Returns True (zero), False (not zero) or None (couldn't evaluate enough points)."""
    symbols = sorted(expr.free_symbols, key=lambda s: s.name)  # every variable in the expression
    good_points = 0  # how many points gave a usable number
    for i, base in enumerate(SAMPLE_POINTS):
        subs = {s: base + 0.13 * j for j, s in enumerate(symbols)}  # give each variable a slightly different value
        try:
            value = complex(expr.evalf(subs=subs))  # evaluate to an actual number
        except (TypeError, ValueError):
            continue  # something unevaluated remained (e.g. a limit SymPy couldn't do) -> skip this point
        if value != value or abs(value) == float("inf"):  # NaN or infinity -> skip this point
            continue
        good_points += 1  # this point counts
        if abs(value) > 1e-7:  # clearly not zero -> the expressions differ
            return False
    return True if good_points >= 3 else None  # need a few points to be confident


def equivalent(a, b, mode: str = "value", var=None) -> bool | None:
    """Are a and b the same math? mode 'antiderivative' allows them to differ by a constant."""
    var = var or sympy.Symbol("x")  # default variable
    difference = sympy.sympify(a).doit() - sympy.sympify(b).doit()  # .doit() actually computes integrals/limits/sums
    if mode == "antiderivative":
        # ln|u| and ln(u) differ only by a constant, so dropping absolute values is safe here
        # (and avoids SymPy's messy derivative of |u|).
        difference = difference.replace(sympy.Abs, lambda inner: inner)
        difference = sympy.diff(difference, var)  # constants (like + C) disappear when differentiated
    if difference == 0:  # SymPy already sees they're identical
        return True
    if difference.is_number:  # no variables left: compare as plain numbers
        result = numeric_zero(difference, var)
        return result
    result = numeric_zero(difference, var)  # numeric test first: fast and reliable
    if result is not None:
        return result
    return sympy.simplify(difference) == 0 or None  # last resort: symbolic simplification


def compare_with_timeout(a_text: str, b_text: str, mode: str, var_name: str) -> dict:
    """Parse and compare two strict-syntax expressions, giving up after TIME_LIMIT seconds."""
    try:
        a = parse(a_text, strict=True)  # first expression
        b = parse(b_text, strict=True)  # second expression
    except Exception as err:  # bad syntax -> report it, equivalence unknown
        return {"equivalent": None, "error": f"parse: {err}"}
    var = sympy.Symbol(var_name)  # the main variable, e.g. x
    pool = ThreadPoolExecutor(max_workers=1)  # run the math in a helper thread so we can time it
    future = pool.submit(equivalent, a, b, mode, var)
    try:
        return {"equivalent": future.result(timeout=TIME_LIMIT)}  # wait at most TIME_LIMIT seconds
    except FutureTimeout:
        return {"equivalent": None, "error": "timeout"}  # too slow -> undecided
    except Exception as err:  # math error (e.g. division by zero) -> undecided
        return {"equivalent": None, "error": f"math: {err}"}
    finally:
        pool.shutdown(wait=False)  # don't wait for a stuck thread


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


def compare_friendly(a_text: str, b_text: str) -> dict:
    """GET version: friendly syntax, exact equality."""
    a = parse(a_text)  # first expression
    b = parse(b_text)  # second expression
    return {"ok": True, "a": str(a), "b": str(b), "equivalent": equivalent(a, b)}


def batch(body: dict) -> dict:
    """POST version: several strict-syntax comparisons at once."""
    pairs = body.get("pairs")  # list of [a, b] pairs
    mode = body.get("mode", "value")  # "value" or "antiderivative"
    var_name = str(body.get("var", "x"))  # main variable name
    if not isinstance(pairs, list) or not pairs or len(pairs) > MAX_PAIRS:
        raise ValueError(f"'pairs' must be a list of 1 to {MAX_PAIRS} [a, b] pairs.")
    if mode not in ("value", "antiderivative"):
        raise ValueError("'mode' must be 'value' or 'antiderivative'.")
    if not re.fullmatch(r"[A-Za-z]", var_name):  # one-letter variable names only
        raise ValueError("'var' must be a single letter.")
    results = []
    for pair in pairs:
        if not (isinstance(pair, list) and len(pair) == 2 and all(isinstance(p, str) for p in pair)):
            results.append({"equivalent": None, "error": "each pair must be two strings"})
            continue
        results.append(compare_with_timeout(pair[0], pair[1], mode, var_name))
    return {"ok": True, "results": results}


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
                self._send(200, compare_friendly(a_text, b_text))
        except Exception as err:  # bad input (or a math error) -> friendly JSON instead of a crash
            self._send(400, {"ok": False, "error": str(err)})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))  # how many bytes the body has
            if length > 20_000:  # refuse huge bodies
                raise ValueError("Request body too large.")
            body = json.loads(self.rfile.read(length) or b"{}")  # read and decode the JSON body
            self._send(200, batch(body))
        except Exception as err:  # bad request -> friendly JSON error
            self._send(400, {"ok": False, "error": str(err)})

    def _send(self, status: int, body: dict):
        """Write a JSON response."""
        data = json.dumps(body).encode("utf-8")  # dict -> JSON text -> bytes
        self.send_response(status)  # HTTP status code (200 = OK, 400 = bad request)
        self.send_header("Content-Type", "application/json")  # tell the browser it's JSON
        self.send_header("Content-Length", str(len(data)))  # size of the body
        self.end_headers()  # finished the headers
        self.wfile.write(data)  # send the body

    def log_message(self, format, *args):  # keep the local dev server's console quiet
        pass


if __name__ == "__main__":  # only runs when you start this file directly, not on Vercel
    print(json.dumps(self_test(), indent=2))  # the fixed self-test
    print(json.dumps(compare_friendly("sin(x)^2 + cos(x)^2", "1"), indent=2))  # a trig identity -> true
    print(json.dumps(batch({  # the kinds of checks the app will run
        "mode": "antiderivative", "var": "x",
        "pairs": [
            ["Integral(x*log(x), x)", "x**2/2*log(x) - Integral(x/2, x)"],  # by parts step 2 -> true
            ["x**2/2*log(x) - Integral(x/2, x)", "x**2/2*log(x) - x**2/4 + C"],  # final answer -> true
            ["x**2/2*log(x) - Integral(x/2, x)", "x**2/2*log(x) - x**2/2"],  # forgot the 1/2 -> false
        ],
    }), indent=2))
    print(json.dumps(batch({
        "mode": "value", "var": "x",
        "pairs": [
            ["Limit((exp(x) - 1 - x)/x**2, x, 0)", "Limit((exp(x) - 1)/(2*x), x, 0)"],  # L'Hopital -> true
            ["Limit((exp(x) - 1)/(2*x), x, 0)", "1"],  # wrong final value -> false (it's 1/2)
            ["Sum(n**2/2**n, (n, 1, oo))", "6"],  # series sum -> true
        ],
    }), indent=2))

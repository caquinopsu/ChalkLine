# Chalkline

An AI calculus tutor (Calc I + II) that makes the algebra visible. *See the math move.*

> Work in progress: the full README (Try it, How to test it, Superpowers, ...) comes at ship time.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your keys.
3. `npm run dev`, then open http://localhost:3000

The Python SymPy checker (`api/check.py`) runs on Vercel. To test its math locally:

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python api\check.py
```

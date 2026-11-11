"use client"; // this page runs in the browser (it has buttons and state), not only on the server

import { useState } from "react"; // React "state": a variable that re-draws the page when it changes

export default function Home() {
  // `result` holds the text we show in the box; `setResult` changes it (and re-draws the page)
  const [result, setResult] = useState("Click a button to test a server route.");

  // Calls one of our server routes and shows its JSON reply in the box.
  async function callRoute(path: string) {
    setResult(`Calling ${path} ...`); // show progress right away
    try {
      const res = await fetch(path); // ask the server (await = wait for the reply)
      const text = await res.text(); // read the reply as text
      try {
        setResult(`${path}  (HTTP ${res.status})\n\n${JSON.stringify(JSON.parse(text), null, 2)}`); // pretty-print JSON
      } catch {
        // Not JSON: locally this usually means the Python route isn't running (next dev only runs TypeScript)
        setResult(
          `${path}  (HTTP ${res.status})\n\nNo JSON reply. If you're running locally with "npm run dev", ` +
            `this is expected for /api/check: Python routes only run on Vercel.`,
        );
      }
    } catch (err) {
      setResult(`${path} failed: ${String(err)}`); // network error, server down, etc.
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Chalkline: Phase 0</h1>
      <p>Skeleton check. These buttons call the two server routes.</p>

      <div className="flex gap-3">
        {/* onClick runs our function when the button is clicked */}
        <button className="rounded border px-4 py-2" onClick={() => callRoute("/api/check")}>
          Test SymPy
        </button>
        <button className="rounded border px-4 py-2" onClick={() => callRoute("/api/health")}>
          Check keys
        </button>
      </div>

      {/* <pre> keeps the line breaks and spacing of the JSON */}
      <pre className="whitespace-pre-wrap rounded border p-4 text-sm">{result}</pre>
    </main>
  );
}

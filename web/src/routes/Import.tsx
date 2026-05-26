import { Link, useSearchParams } from "react-router";

export function Import() {
  const [params] = useSearchParams();
  const url = params.get("url") ?? params.get("text");
  const title = params.get("title");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-semibold">Import a recipe</h1>
      {url ? (
        <p className="mt-4 text-sm text-slate-600">
          Shared from: <span className="font-mono break-all">{url}</span>
          {title ? <span className="ml-2 italic">"{title}"</span> : null}
        </p>
      ) : (
        <p className="mt-4 text-slate-600">Paste a URL or upload a markdown file to begin.</p>
      )}
      <Link to="/" className="mt-6 inline-block text-sm text-blue-600 underline">
        Back home
      </Link>
    </main>
  );
}

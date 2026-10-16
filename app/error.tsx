"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="serif text-3xl">We couldn’t load this page</h1>
      <p className="my-5">
        Check your connection and try again. Your saved queue and orders are
        safe.
      </p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="serif text-3xl">This table isn’t here</h1>
      <p className="my-5">The page or visit could not be found.</p>
      <Link className="btn" href="/">
        Back to restaurant
      </Link>
    </main>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-zinc-900">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Baloot Org Frontend Scaffold</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Minimal pages for testing backend auth, owner bootstrap, and basic
          dashboard behavior.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <a
            className="rounded-xl bg-black px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800"
            href="/login"
          >
            Login
          </a>
          <a
            className="rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            href="/dashboard"
          >
            Dashboard
          </a>
          <a
            className="rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            href="/owner-setup"
          >
            Owner Setup
          </a>
        </div>
      </main>
    </div>
  );
}

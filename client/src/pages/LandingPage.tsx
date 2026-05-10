import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { LogoMark } from '../components/LogoMark'

export function LandingPage() {
  // If the user is already logged in, skip the marketing page and send them
  // straight to the app. We check the token from the auth store — same as
  // ProtectedRoute does, just inverted.
  const token = useAuthStore((s) => s.token)
  if (token) {
    return <Navigate to="/expenses" replace />
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Top nav ──────────────────────────────────────────────────────
          - `sticky top-0` so the nav stays pinned as you scroll
          - `bg-white/80 backdrop-blur` gives a frosted-glass look when the
            page scrolls behind it (modern SaaS landing-page convention)
          - The logo on the left links back to "/" (i.e. itself)
          - "Features" anchor scrolls to the features section below
      */}
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-emerald-100/60 via-green-50/70 to-emerald-100/60 backdrop-blur-md border-b border-emerald-100/60">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <LogoMark size="sm" />
          </Link>

          {/* Middle: anchor links (hidden on small screens to save space) */}
          <div className="hidden md:flex items-center gap-7">
            <a
              href="#features"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Features
            </a>
          </div>

          {/* Right: auth CTAs */}
          <div className="flex items-center gap-1 md:gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm shadow-green-200"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-white to-emerald-50">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy + CTAs */}
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-green-700 bg-green-100 rounded-full px-3 py-1 mb-5">
              Built for friends, not finance majors
            </span>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
              Stop the awkward
              <br />
              <span className="text-green-600">money conversations.</span>
            </h1>

            <p className="mt-6 text-lg text-gray-600 max-w-md">
              Fairshare splits expenses with friends and shows you exactly who
              owes whom. No spreadsheets, no math, no IOUs.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="bg-green-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                Get started, it's free
              </Link>
              <Link
                to="/login"
                className="border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                I have an account
              </Link>
            </div>
          </div>

          {/* Right: mock balance card — pure CSS, no images required */}
          <div className="relative">
            {/* Soft blob behind the card for depth */}
            <div className="absolute -inset-4 bg-green-100 rounded-3xl blur-2xl opacity-50" />

            <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-gray-900">Your balances</h3>
                <span className="text-xs text-gray-400">Group: Barcelona trip</span>
              </div>

              <div className="space-y-3">
                <BalanceRowMock name="Alex" status="owes you" amount="42.50" tone="green" />
                <BalanceRowMock name="Priya" status="owes you" amount="18.00" tone="green" />
                <BalanceRowMock name="Sam" status="you owe" amount="12.75" tone="amber" />
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">Net</span>
                <span className="text-lg font-bold text-green-600">+$47.75</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">
            Everything you need, nothing you don't
          </h2>
          <p className="mt-3 text-gray-600 max-w-xl mx-auto">
            Three features. That's it. Because splitting a dinner bill
            shouldn't require an MBA.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<SplitIcon />}
            title="Split in seconds"
            body="Add who paid, the total, and who was there. We do the math. Even splits only — no fiddly percentages to argue about."
            accent="green"
          />
          <FeatureCard
            icon={<ChartIcon />}
            title="See who owes whom"
            body="Real-time net balances across all your expenses and settlements. One number tells you exactly where you stand."
            accent="emerald"
          />
          <FeatureCard
            icon={<CheckIcon />}
            title="Settle up cleanly"
            body="Pay someone back in person? Record it once. Fairshare reconciles your balance across every expense automatically."
            accent="amber"
          />
        </div>
      </section>

      {/* ── Bottom CTA band ───────────────────────────────────────────── */}
      <section className="bg-green-600">
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to stop chasing receipts?
          </h2>
          <p className="mt-3 text-green-100">
            Create an account in 30 seconds. Your friends will thank you.
          </p>
          <Link
            to="/register"
            className="inline-block mt-7 bg-white text-green-700 font-bold px-7 py-3 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Get started
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-gray-400">
          Fairshare · {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  )
}

// ── Small subcomponents (kept in the same file for simplicity) ────────────

function BalanceRowMock({
  name,
  status,
  amount,
  tone,
}: {
  name: string
  status: string
  amount: string
  tone: 'green' | 'amber'
}) {
  const toneClasses =
    tone === 'green'
      ? 'text-green-600'
      : 'text-amber-600'
  const initial = name.charAt(0)
  const avatarBg =
    tone === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'

  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${avatarBg}`}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">{status}</p>
      </div>
      <span className={`text-sm font-semibold ${toneClasses}`}>${amount}</span>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode
  title: string
  body: string
  accent: 'green' | 'emerald' | 'amber'
}) {
  // Each accent sets BOTH the bubble background AND the icon stroke color.
  // The icons use `currentColor`, so changing the text color of the parent
  // changes the icon color — keeping the palette controlled in one place.
  const bubbleClass = {
    green: 'bg-green-100 text-green-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
  }[accent]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-7 hover:border-green-300 hover:shadow-md transition-all">
      <div
        className={`w-12 h-12 rounded-xl ${bubbleClass} flex items-center justify-center mb-4`}
      >
        {icon}
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  )
}

// ── Inline SVG icons (Lucide-style: 24x24 viewBox, stroke-based) ──────────
//
// All three use `stroke="currentColor"`, which means they inherit color from
// their parent's `text-` class. So FeatureCard's `text-green-700` etc.
// controls the icon stroke color.

function SplitIcon() {
  // A path that branches into two — visual metaphor for "splitting"
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 v6" />
      <path d="M12 9 l-6 6" />
      <path d="M12 9 l6 6" />
      <path d="M6 15 v4" />
      <path d="M18 15 v4" />
    </svg>
  )
}

function ChartIcon() {
  // Three bars of increasing height — clean bar chart for "balances"
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="8" />
      <line x1="18" y1="20" x2="18" y2="11" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  )
}

function CheckIcon() {
  // Circle with a checkmark — "settled / done"
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12 l3 3 l5-6" />
    </svg>
  )
}

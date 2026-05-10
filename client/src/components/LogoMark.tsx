// Fairshare brand mark.
//
// Two visual components:
//   1. The ICON — a rounded gradient square containing two overlapping
//      rounded squares. The overlap is the visual metaphor for "what's
//      shared between us." Reads as sharing/fairness without being literal.
//   2. The WORDMARK — the word "Fairshare" in the brand typeface.
//
// Putting both in one component means we change the brand in one place.

type LogoMarkProps = {
  // 'sm' for navbar (~36px icon), 'md' for hero/auth pages (~48px icon)
  size?: 'sm' | 'md'
  // Whether to show the "Fairshare" text next to the icon
  withWordmark?: boolean
}

export function LogoMark({ size = 'sm', withWordmark = true }: LogoMarkProps) {
  const containerClass = size === 'sm' ? 'w-9 h-9' : 'w-12 h-12'
  const wordmarkClass = size === 'sm' ? 'text-xl' : 'text-2xl'

  return (
    <div className="flex items-center gap-2.5">
      {/* Icon container — gradient + soft shadow gives it a "lifted" feel */}
      <div
        className={`${containerClass} bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm shadow-green-200`}
      >
        {/* The actual mark — drawn in SVG so it scales perfectly at any size.
            viewBox is a 32×32 coordinate system; the two rounded squares
            overlap in the middle. Each has fill-opacity 0.7 against the green
            background; where they overlap, the math gives ~0.91, creating a
            visibly brighter "shared" region. */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[60%] h-[60%]"
          aria-hidden="true"
        >
          {/* Left square — slightly lower-left */}
          <rect
            x="3"
            y="8"
            width="16"
            height="16"
            rx="4.5"
            fill="white"
            fillOpacity="0.72"
          />
          {/* Right square — slightly upper-right; overlap with the left
              creates a brighter shared region */}
          <rect
            x="13"
            y="8"
            width="16"
            height="16"
            rx="4.5"
            fill="white"
            fillOpacity="0.72"
          />
        </svg>
      </div>

      {withWordmark && (
        <span className={`font-bold text-gray-900 tracking-tight ${wordmarkClass}`}>
          Fairshare
        </span>
      )}
    </div>
  )
}

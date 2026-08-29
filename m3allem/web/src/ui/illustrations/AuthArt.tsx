/**
 * The scene on the auth pages' navy panel.
 *
 * It draws what the product actually does — a job request, and priced offers
 * coming back from tradesmen — because a decorative blob on a sign-in page
 * teaches a new visitor nothing. Every number in it is Latin and the layout is
 * direction-neutral, so it reads the same in Arabic.
 */
export function AuthArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 400" className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.07" />
        </linearGradient>
        <linearGradient id="offer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.97" />
          <stop offset="100%" stopColor="#e8f1fa" stopOpacity="0.92" />
        </linearGradient>
      </defs>

      {/* the request the client posts */}
      <g>
        <rect
          x="26"
          y="42"
          width="250"
          height="176"
          rx="20"
          fill="url(#card)"
          stroke="#ffffff"
          strokeOpacity="0.24"
          strokeWidth="1.5"
        />
        <rect x="48" y="66" width="62" height="62" rx="12" fill="#ffffff" fillOpacity="0.16" />
        <path
          d="M60 112l14-16 10 11 8-8 10 13H60Z"
          fill="#ffffff"
          fillOpacity="0.45"
        />
        <circle cx="66" cy="84" r="6" fill="#ffffff" fillOpacity="0.5" />

        <rect x="124" y="70" width="128" height="11" rx="5.5" fill="#ffffff" fillOpacity="0.55" />
        <rect x="124" y="90" width="98" height="9" rx="4.5" fill="#ffffff" fillOpacity="0.28" />
        <rect x="124" y="107" width="112" height="9" rx="4.5" fill="#ffffff" fillOpacity="0.28" />

        <g stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" fill="none">
          <path d="M52 156c0-5.6 4.6-10.2 10.2-10.2S72.4 150.4 72.4 156c0 6.6-10.2 16.6-10.2 16.6S52 162.6 52 156Z" />
          <circle cx="62.2" cy="155.6" r="3.2" />
        </g>
        <rect x="82" y="150" width="86" height="9" rx="4.5" fill="#ffffff" fillOpacity="0.3" />
        <rect x="82" y="165" width="58" height="9" rx="4.5" fill="#ffffff" fillOpacity="0.18" />

        <rect x="48" y="190" width="96" height="12" rx="6" fill="#ffffff" fillOpacity="0.5" />
      </g>

      {/* the offers coming back */}
      <g>
        <rect
          x="188"
          y="182"
          width="238"
          height="86"
          rx="18"
          fill="url(#offer)"
        />
        <circle cx="222" cy="225" r="20" fill="#103a5e" fillOpacity="0.14" />
        <circle cx="222" cy="219" r="7.5" fill="#103a5e" fillOpacity="0.55" />
        <path d="M209 238c2.4-6 7.2-9 13-9s10.6 3 13 9Z" fill="#103a5e" fillOpacity="0.55" />
        <rect x="254" y="203" width="92" height="10" rx="5" fill="#103a5e" fillOpacity="0.5" />
        <g fill="#e8a33d">
          <path d="M254 224l2.1 4.4 4.7.7-3.4 3.3.8 4.8-4.2-2.2-4.2 2.2.8-4.8-3.4-3.3 4.7-.7 2.1-4.4Z" />
          <path d="M272 224l2.1 4.4 4.7.7-3.4 3.3.8 4.8-4.2-2.2-4.2 2.2.8-4.8-3.4-3.3 4.7-.7 2.1-4.4Z" />
          <path d="M290 224l2.1 4.4 4.7.7-3.4 3.3.8 4.8-4.2-2.2-4.2 2.2.8-4.8-3.4-3.3 4.7-.7 2.1-4.4Z" />
        </g>
        <rect x="342" y="212" width="66" height="30" rx="15" fill="#103a5e" />
        <text
          x="375"
          y="232"
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="#ffffff"
          fontFamily="Inter, system-ui, sans-serif"
        >
          450
        </text>
      </g>

      <g opacity="0.85">
        <rect
          x="206"
          y="286"
          width="220"
          height="76"
          rx="18"
          fill="#ffffff"
          fillOpacity="0.16"
          stroke="#ffffff"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
        <circle cx="240" cy="324" r="18" fill="#ffffff" fillOpacity="0.22" />
        <circle cx="240" cy="318" r="6.5" fill="#ffffff" fillOpacity="0.6" />
        <path d="M228 336c2.2-5.4 6.6-8.2 12-8.2s9.8 2.8 12 8.2Z" fill="#ffffff" fillOpacity="0.6" />
        <rect x="270" y="306" width="80" height="9" rx="4.5" fill="#ffffff" fillOpacity="0.45" />
        <rect x="270" y="323" width="54" height="9" rx="4.5" fill="#ffffff" fillOpacity="0.25" />
        <rect x="352" y="310" width="58" height="26" rx="13" fill="#ffffff" fillOpacity="0.3" />
        <text
          x="381"
          y="328"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="#ffffff"
          fontFamily="Inter, system-ui, sans-serif"
        >
          520
        </text>
      </g>

      {/* the arc that ties a request to the answers it draws */}
      <path
        d="M150 214c0 46 34 62 74 62"
        stroke="#ffffff"
        strokeOpacity="0.3"
        strokeWidth="1.8"
        strokeDasharray="5 7"
        fill="none"
        strokeLinecap="round"
      />

      <g fill="#ffffff" fillOpacity="0.2">
        <circle cx="410" cy="70" r="5" />
        <circle cx="386" cy="112" r="3" />
        <circle cx="432" cy="132" r="3.5" />
        <circle cx="38" cy="300" r="4" />
        <circle cx="76" cy="336" r="2.5" />
      </g>
    </svg>
  )
}

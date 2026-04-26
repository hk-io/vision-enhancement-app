/**
 * Brand icons matching ClearVision mockups (Smart Text / Smart Read / Describe Scene).
 */

const magnify = "#0d47a1";

export function SmartTextIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 60" fill="currentColor" aria-hidden>
      <rect x="8" y="1" width="44" height="58" rx="6" />
      <rect x="12" y="8" width="36" height="40" rx="3" fill={magnify} />
      <rect x="24" y="51" width="12" height="5" rx="2.5" fill={magnify} />
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M18 17 L18 12 L23 12" />
        <path d="M37 12 L42 12 L42 17" />
        <path d="M18 39 L18 44 L23 44" />
        <path d="M37 44 L42 44 L42 39" />
      </g>
      <text
        x="30"
        y="30"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="13"
        fontWeight="900"
        fill="currentColor"
        fontFamily="Lexend, sans-serif"
        letterSpacing="1"
      >
        AR
      </text>
    </svg>
  );
}

export function SmartReadIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
      <path d="M20 4l.6 1.4L22 6l-1.4.6L20 8l-.6-1.4L18 6l1.4-.6z" />
    </svg>
  );
}

export function DescribeSceneIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 11.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-7c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"
      />
      <path
        fill="rgba(255,255,255,0.9)"
        d="M17.5 2h4c.28 0 .5.22.5.5v3c0 .28-.22.5-.5.5h-.8l-.7 1.2-.7-1.2h-.8c-.28 0-.5-.22-.5-.5v-3c0-.28.22-.5.5-.5z"
      />
    </svg>
  );
}

/** Spoken feedback on: filled speaker + wave arcs */
export function TtsOnIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10v4h3l5 3V7L7 10H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M14 9.5c.9 1 1.2 1.9 1.2 2.5s-.3 1.5-1.2 2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 7.5c1.4 1.6 2 3.1 2 4.5s-.6 2.9-2 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

/** Spoken feedback off: speaker + mute X */
export function TtsOffIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10v4h3l5 3V7L7 10H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M15 10l4 4M19 10l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

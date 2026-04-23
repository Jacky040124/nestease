export function Logo({ size = 24, fillOpacity = 0.15 }: { size?: number; fillOpacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* House shape */}
      <path
        d="M16 3L3 14h4v14h18V14h4L16 3z"
        fill="currentColor"
        opacity={fillOpacity}
      />
      <path
        d="M16 3L3 14h4v14h18V14h4L16 3z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Checkmark */}
      <path
        d="M11 18l3.5 3.5L22 14"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Hand-drawn marks, 1.25px stroke, 20px grid. Drawn for this app: strata for
 *  depth, a buoy for reminders, a sounding line for focus. No emoji, no icon set. */

interface Props {
  size?: number
  className?: string
}

/* The number a caller passes is the size at a 16px root — 18 still means 18px
   in a window. It is written in rem so a mark grows with the type around it
   instead of staying a fixed dot on a large display. The px attributes stay
   underneath as the fallback if the style never lands. */
const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.25}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
)

export const IconDepths = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <path d="M3 5.5h14" />
      <path d="M4.5 10h11" opacity={0.72} />
      <path d="M6.5 14.5h7" opacity={0.45} />
    </>
  ))

export const IconFocus = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <path d="M10 2.5v9" opacity={0.5} />
      <circle cx={10} cy={13.5} r={3.2} />
      <path d="M6.5 4.5h7" opacity={0.5} />
    </>
  ))

export const IconTimer = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <circle cx={10} cy={11} r={6.5} />
      <path d="M10 7.6V11l2.4 1.6" />
      <path d="M7.6 2.8h4.8" />
    </>
  ))

export const IconBuoy = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <path d="M10 2.5v6" />
      <path d="M10 3.2 13 4.4 10 5.6" />
      <circle cx={10} cy={11.6} r={3.1} />
      <path d="M3.5 16.4c1.4 0 1.4 1 2.8 1s1.4-1 2.8-1 1.4 1 2.8 1 1.4-1 2.8-1" opacity={0.6} />
    </>
  ))

export const IconSettings = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <path d="M3 6h14M3 14h14" opacity={0.6} />
      <circle cx={7.5} cy={6} r={1.8} />
      <circle cx={13} cy={14} r={1.8} />
    </>
  ))

export const IconSurface = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <path d="M10 15.5V5.5" />
      <path d="M6.2 9 10 5.2 13.8 9" />
    </>
  ))

export const IconCheck = ({ size = 20, className }: Props) =>
  svg(size, className, <path d="M4.5 10.5 8.2 14 15.5 6.4" />)

export const IconPlus = ({ size = 20, className }: Props) =>
  svg(size, className, <path d="M10 4.5v11M4.5 10h11" />)

export const IconClose = ({ size = 20, className }: Props) =>
  svg(size, className, <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />)

export const IconChevron = ({ size = 20, className }: Props) =>
  svg(size, className, <path d="M6 8.5 10 12.5 14 8.5" />)

export const IconPlay = ({ size = 20, className }: Props) =>
  svg(size, className, <path d="M7 4.8 15 10l-8 5.2V4.8Z" />)

export const IconPause = ({ size = 20, className }: Props) =>
  svg(size, className, <path d="M7.5 5v10M12.5 5v10" />)

export const IconSkip = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <path d="M6 5.2 12.5 10 6 14.8V5.2Z" />
      <path d="M14.5 5v10" />
    </>
  ))

export const IconAsk = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <path d="M3.5 9.2c0-2.6 2.9-4.7 6.5-4.7s6.5 2.1 6.5 4.7-2.9 4.7-6.5 4.7c-.7 0-1.4-.1-2-.2L4 15.5l.9-2.5c-.9-.8-1.4-1.8-1.4-2.9Z" />
      <path d="M7.8 9.2h4.4" opacity={0.55} />
    </>
  ))

export const IconMic = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <rect x={7.6} y={2.6} width={4.8} height={9} rx={2.4} />
      <path d="M4.8 9.6a5.2 5.2 0 0 0 10.4 0" />
      <path d="M10 14.8v2.6" />
    </>
  ))

export const IconSearch = ({ size = 20, className }: Props) =>
  svg(size, className, (
    <>
      <circle cx={9} cy={9} r={4.8} />
      <path d="M12.6 12.6 16 16" />
    </>
  ))

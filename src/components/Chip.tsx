import type { DimOption } from '../types'

interface Props {
  option: DimOption
  active?: boolean
  onClick?: () => void
  dim?: boolean
  /** the row treatment: the option's colour on a wash of itself */
  loud?: boolean
}

/** Quiet everywhere except on a task row, where saturation is the whole point
 *  — it is what lets a schedule be read at a glance instead of parsed. */
export function Chip({ option, active, onClick, dim, loud }: Props) {
  const style = { ['--chip' as string]: option.color }

  if (loud) {
    return (
      <span className="chip chip-loud" style={style} data-dim={dim ? '' : undefined}>
        {option.name}
      </span>
    )
  }

  const content = (
    <>
      <span className="chip-dot" style={{ background: option.color }} />
      {option.name}
    </>
  )

  if (!onClick) {
    return (
      <span className="chip" data-dim={dim ? '' : undefined}>
        {content}
      </span>
    )
  }
  return (
    <button className="chip chip-button" data-active={active ? '' : undefined} onClick={onClick}>
      {content}
    </button>
  )
}

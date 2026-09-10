import { useUi } from '../store/useUi'
import { IconAsk } from '../design/icons'

/** Opens the assistant without a keyboard. ⌘K is a shortcut, not a door. */
export function ChatButton({ label = 'Tanya' }: { label?: string }) {
  return (
    <button
      className="icon-button chat-open"
      title={label}
      aria-label={label}
      onClick={() => useUi.getState().setPalette(true)}
    >
      <IconAsk size={18} />
    </button>
  )
}

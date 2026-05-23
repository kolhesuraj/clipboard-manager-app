import type { ClipboardItem as Item } from '../App'

interface Props {
  item: Item
  onCopy: (content: string) => void
  onDelete: (id: number) => void
  onPin: (id: number) => void
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function ClipboardItem({ item, onCopy, onDelete, onPin }: Props) {
  const preview = item.content.length > 300 ? item.content.slice(0, 300) + '…' : item.content

  return (
    <li
      className={`clipboard-item${item.pinned ? ' pinned' : ''}`}
      onClick={() => onCopy(item.content)}
      title="Click to copy and paste"
    >
      {/* Pin indicator — click to toggle pin */}
      <span
        className="item-pin-indicator"
        title={item.pinned ? 'Unpin' : 'Pin'}
        onClick={(e) => { e.stopPropagation(); onPin(item.id) }}
      >📌</span>

      <div className="item-body">
        <span className="item-preview">{preview}</span>
        <time className="item-time">{relativeTime(item.created_at)}</time>
      </div>

      {/* Action buttons — appear on hover */}
      <div className="item-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="action-btn delete"
          onClick={() => onDelete(item.id)}
          title="Delete"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </li>
  )
}

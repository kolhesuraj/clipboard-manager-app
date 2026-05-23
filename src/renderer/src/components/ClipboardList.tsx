import ClipboardItem from './ClipboardItem.tsx'
import type { ClipboardItem as Item } from '../App'

interface Props {
  items: Item[]
  onCopy: (content: string) => void
  onDelete: (id: number) => void
  onPin: (id: number) => void
}

export default function ClipboardList({ items, onCopy, onDelete, onPin }: Props) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 48 48" fill="none" className="empty-icon">
          <rect x="8" y="10" width="32" height="36" rx="3" stroke="currentColor" strokeWidth="2" />
          <rect x="18" y="6" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
          <line x1="16" y1="22" x2="32" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="30" x2="28" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p>No items yet</p>
        <p className="empty-sub">Copy something to start tracking history</p>
      </div>
    )
  }

  return (
    <ul className="clipboard-list">
      {items.map((item) => (
        <ClipboardItem
          key={item.id}
          item={item}
          onCopy={onCopy}
          onDelete={onDelete}
          onPin={onPin}
        />
      ))}
    </ul>
  )
}

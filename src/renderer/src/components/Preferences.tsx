interface Props {
  mutterConsent: boolean
  onMutterConsentChange: (value: boolean) => void
  onBack: () => void
}

export default function Preferences({ mutterConsent, onMutterConsentChange, onBack }: Props) {
  return (
    <div className="prefs-panel">
      <div className="prefs-header">
        <button className="prefs-back" onClick={onBack} title="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="prefs-title">Preferences</span>
      </div>

      <div className="prefs-body">
        <section className="prefs-section">
          <h3 className="prefs-section-title">Paste Method</h3>

          <div className="prefs-row">
            <div className="prefs-row-info">
              <span className="prefs-row-label">Screen recording auto-paste</span>
              <span className="prefs-row-desc">
                Uses GNOME RemoteDesktop (Mutter) to paste when wtype / xdotool are unavailable.
                Briefly shows the screen-recording indicator in the top bar.
              </span>
            </div>
            <button
              className={`prefs-toggle${mutterConsent ? ' on' : ''}`}
              onClick={() => onMutterConsentChange(!mutterConsent)}
              title={mutterConsent ? 'Disable' : 'Enable'}
            >
              <span className="prefs-toggle-thumb" />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

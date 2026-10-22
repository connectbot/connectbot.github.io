const letterRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** A visual stand-in for the Android input method; never part of the exported layout. */
export function GoogleKeyboardPreview({ height, tablet }: Readonly<{ height: number; tablet: boolean }>) {
  return (
    <figure className="kb-gboard" data-testid="google-keyboard-preview" aria-label="Google Keyboard preview (simulated Gboard)" style={{ height }}>
      <div className="kb-gboard-content" aria-hidden="true">
        <div className="kb-gboard-toolbar">
          <span className="kb-gboard-menu">▦</span>
          <span>☺</span>
          <span>GIF</span>
          <span>▣</span>
          <span>⚙</span>
          <span className="kb-gboard-toolbar-end">•••</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
          </svg>
        </div>
        {tablet && <div className="kb-gboard-row">{Array.from('1234567890', key => <span className="kb-gboard-key" key={key}>{key}</span>)}</div>}
        {letterRows.map((row, index) => (
          <div className={`kb-gboard-row kb-gboard-letters-${index}`} key={row}>
            {index === 2 && <span className="kb-gboard-key kb-gboard-special">⇧</span>}
            {Array.from(row, key => <span className="kb-gboard-key" key={key}>{key}</span>)}
            {index === 2 && <span className="kb-gboard-key kb-gboard-special">⌫</span>}
          </div>
        ))}
        <div className="kb-gboard-row">
          <span className="kb-gboard-key kb-gboard-special">?123</span>
          <span className="kb-gboard-key kb-gboard-punctuation">,</span>
          <span className="kb-gboard-key kb-gboard-space">English</span>
          <span className="kb-gboard-key kb-gboard-punctuation">.</span>
          <span className="kb-gboard-key kb-gboard-enter">↵</span>
        </div>
        <div className="kb-gboard-navigation"><span /></div>
      </div>
    </figure>
  );
}

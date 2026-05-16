import { useState } from 'react'

const DEFAULT_SERVER = import.meta.env.VITE_SERVER_URL || ''

export default function ConnectScreen({ onConnect }) {
  const [url,     setUrl]     = useState(DEFAULT_SERVER)
  const [key,     setKey]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function connect() {
    const serverUrl = url.trim()
    const apiKey    = key.trim()
    if (!apiKey)    { setError('API key is required');    return }
    if (!serverUrl) { setError('Server URL is required'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${serverUrl}/health`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      localStorage.setItem('cam_url', serverUrl)
      localStorage.setItem('cam_key', apiKey)
      onConnect()
    } catch (err) {
      setError(`Cannot reach server: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const installCmd  = `pip install claude-monitor-agent`
  const setupCmd    = `claude-monitor setup --server-url ${url || '<SERVER_URL>'} --key <YOUR_KEY>`

  return (
    <div className="cs-wrap">
      <div className="cs-box">
        <div className="cs-logo">
          <span className="cs-icon">&#9632;</span>
          <h1>Claude Access Monitor</h1>
        </div>
        <p className="cs-tagline">Real-time visibility into Claude Code tool usage</p>

        <div className="cs-form">
          <label>
            Server URL
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-monitor-backend.railway.app"
            />
          </label>
          <label>
            API Key
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Paste your API key"
              onKeyDown={e => e.key === 'Enter' && connect()}
              autoFocus
            />
            <small>
              No account needed — generate a key with:{' '}
              <code>python -c "import uuid; print(uuid.uuid4())"</code>
            </small>
          </label>

          {error && <div className="cs-error">{error}</div>}

          <button
            className="btn btn-p cs-btn"
            onClick={connect}
            disabled={loading}
          >
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        </div>

        <div className="cs-install">
          <div className="cs-install-title">Setup the agent on your machine</div>
          <div className="cs-step">
            <span className="cs-step-n">1</span>
            <code>{installCmd}</code>
          </div>
          <div className="cs-step">
            <span className="cs-step-n">2</span>
            <code>{setupCmd}</code>
          </div>
          <div className="cs-step">
            <span className="cs-step-n">3</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              Restart Claude Code — events stream here automatically.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Left panel — Agent tree */}
      <div
        style={{
          width: '25%',
          borderRight: '1px solid #ccc',
          padding: '1rem',
          overflowY: 'auto',
        }}
      >
        <h2>Agents</h2>
        <p>Agent tree will appear here.</p>
      </div>

      {/* Center panel — Task list / main view */}
      <div
        style={{
          flex: 1,
          padding: '1rem',
          overflowY: 'auto',
        }}
      >
        <h2>Tasks</h2>
        <p>Task list will appear here.</p>
      </div>

      {/* Right panel — Token counts / session info */}
      <div
        style={{
          width: '25%',
          borderLeft: '1px solid #ccc',
          padding: '1rem',
          overflowY: 'auto',
        }}
      >
        <h2>Tokens</h2>
        <p>Token counts and session info will appear here.</p>
      </div>
    </div>
  )
}

export default App

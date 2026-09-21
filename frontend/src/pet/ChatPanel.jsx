export default function ChatPanel({ messages, sending, input, onInputChange, onSend, onClose }) {
  return (
    <div className="pet-chat-panel" role="dialog" aria-label="Assistant chat">
      <div className="pet-chat-header">
        <span>Study assistant</span>
        <button type="button" className="pet-chat-close" onClick={onClose} aria-label="Close assistant chat">
          ×
        </button>
      </div>
      <div className="pet-chat-message-list">
        {messages.map((msg, index) => (
          <div key={`${msg.role}-${index}`} className={`pet-chat-message pet-chat-message-${msg.role}`}>
            {msg.text}
          </div>
        ))}
        {sending && <div className="pet-chat-message pet-chat-message-assistant pet-chat-message-thinking">…</div>}
      </div>
      <div className="pet-chat-form">
        <input
          type="text"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask your assistant..."
          aria-label="Message the assistant"
          disabled={sending}
        />
        <button type="button" onClick={onSend} disabled={sending || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

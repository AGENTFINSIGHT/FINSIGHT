import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { chatMessage } from '../utils/apiClient';

const QUICK_QUESTIONS = [
  'What was my biggest expense?',
  'How much did I spend on food?',
  'How can I save more money?',
  'Which category needs attention?',
];

export default function ChatBot({ financialData }) {
  const [messages, setMessages] = useState([{ role: 'ai', content: "Hi! I've analyzed your statement. Ask me anything about your spending! 💡" }]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const reply = await chatMessage(userMsg, financialData, messages);
      setMessages(prev => [...prev, { role: 'ai', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {QUICK_QUESTIONS.map(q => (
          <button key={q} className="btn btn-ghost btn-sm" onClick={() => send(q)} disabled={loading} style={{ fontSize: '0.78rem' }}>
            <Sparkles size={11} /> {q}
          </button>
        ))}
      </div>
      <div className="chat-window">
        <div className="chat-messages" id="chat-messages">
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: m.role === 'ai' ? 'var(--blue-glow)' : 'var(--purple-glow)', border: `1px solid ${m.role === 'ai' ? 'rgba(99,179,237,0.2)' : 'rgba(183,148,244,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.role === 'ai' ? <Bot size={14} color="var(--blue)" /> : <User size={14} color="var(--purple)" />}
              </div>
              <div className={`chat-bubble ${m.role}`}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--blue-glow)', border: '1px solid rgba(99,179,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={14} color="var(--blue)" /></div>
              <div className="chat-bubble ai" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0,1,2].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', animation: `pulse-glow 1s ease-in-out ${d*0.2}s infinite`, display: 'inline-block' }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input-row">
          <input id="chat-input" className="input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask about your spending…" disabled={loading} style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" id="btn-send" onClick={() => send()} disabled={loading || !input.trim()} style={{ padding: '10px 16px' }}><Send size={14} /></button>
        </div>
      </div>
    </div>
  );
}

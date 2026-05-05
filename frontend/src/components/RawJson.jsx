import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function RawJson({ data }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>Raw JSON Output</p>
          <p className="text-xs text-muted">Ready for direct database storage</p>
        </div>
        <button
          className={`btn btn-ghost btn-sm`}
          id="btn-copy-json"
          onClick={copy}
          style={{ color: copied ? 'var(--emerald)' : undefined, borderColor: copied ? 'rgba(72,187,120,0.3)' : undefined }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>
      <div className="json-viewer">
        <pre>
          <code
            dangerouslySetInnerHTML={{
              __html: json
                .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
                  let cls = 'color:#79c0ff'; // number
                  if (/^"/.test(match)) {
                    if (/:$/.test(match)) cls = 'color:#ff7b72'; // key
                    else cls = 'color:#a5d6ff'; // string
                  } else if (/true|false/.test(match)) cls = 'color:#79c0ff';
                  else if (/null/.test(match)) cls = 'color:#8b949e';
                  return `<span style="${cls}">${match}</span>`;
                })
            }}
          />
        </pre>
      </div>
    </div>
  );
}

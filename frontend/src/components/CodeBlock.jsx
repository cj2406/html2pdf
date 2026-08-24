import { useState } from 'react';

export default function CodeBlock({ label, code }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="codeblock">
      <div className="bar">
        <span>{label}</span>
        <button className="copy-btn" onClick={copy}>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}

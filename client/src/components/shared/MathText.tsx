import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import type { ReactNode } from 'react';

interface MathTextProps {
  children?: string | null;
  className?: string;
}

const ALLOWED_IMAGE_SRC = /^(data:image\/(png|jpeg|jpg|webp);base64,|https?:\/\/|\/api\/questions\/images\/)/i;

function renderSafeNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return <Latex key={key} strict={false}>{node.textContent ?? ''}</Latex>;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map((child, index) =>
    renderSafeNode(child, `${key}-${index}`),
  );

  if (tag === 'br') return <br key={key} />;
  if (tag === 'img') {
    const src = element.getAttribute('src') || '';
    if (!ALLOWED_IMAGE_SRC.test(src)) return null;
    return (
      <img
        key={key}
        src={src}
        alt={element.getAttribute('alt') || 'question image'}
        loading="lazy"
        className="my-2 max-h-80 max-w-full rounded border border-slate-200 object-contain"
      />
    );
  }
  if (tag === 'strong' || tag === 'b') return <strong key={key}>{children}</strong>;
  if (tag === 'em' || tag === 'i') return <em key={key}>{children}</em>;
  if (tag === 'u') return <u key={key}>{children}</u>;
  if (tag === 'sub') return <sub key={key}>{children}</sub>;
  if (tag === 'sup') return <sup key={key}>{children}</sup>;
  if (tag === 'a') {
    const href = element.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return <span key={key}>{children}</span>;
    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-indigo-600 underline"
      >
        {children}
      </a>
    );
  }
  if (tag === 'p' || tag === 'div') return <span key={key} className="block">{children}</span>;
  if (tag === 'ul' || tag === 'ol') return <span key={key} className="my-1 block pl-4">{children}</span>;
  if (tag === 'li') return <span key={key} className="block before:content-['•_']">{children}</span>;
  if (tag === 'span') return <span key={key}>{children}</span>;
  return <span key={key}>{children}</span>;
}

export function MathText({ children, className = '' }: MathTextProps) {
  if (!children) return null;
  const template = document.createElement('template');
  template.innerHTML = children;
  const nodes = Array.from(template.content.childNodes);

  return (
    <span className={`math-text ${className}`} style={{ wordBreak: 'break-word' }}>
      {nodes.length > 0
        ? nodes.map((node, index) => renderSafeNode(node, String(index)))
        : <Latex strict={false}>{children}</Latex>}
    </span>
  );
}

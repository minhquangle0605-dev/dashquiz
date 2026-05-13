import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

interface MathTextProps {
  children?: string | null;
  className?: string;
}

export function MathText({ children, className = '' }: MathTextProps) {
  if (!children) return null;

  return (
    <div className={`math-text ${className}`} style={{ wordBreak: 'break-word' }}>
      <Latex strict={false}>{children}</Latex>
    </div>
  );
}

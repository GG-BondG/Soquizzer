import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const BARE_EXPONENT = /(\w)\^(\{[^{}]+\}|-?\w+)/g;
const BARE_SUBSCRIPT = /(\w)_(\{[^{}]+\}|-?\w+)/g;

function braced(part) {
  return part.startsWith('{') ? part : `{${part}}`;
}

// Quizzes written before the prompt asked for LaTeX use bare shorthand like `n^2` or `x_1` instead of `$n^2$`.
// Rewriting it here (rather than only in the prompt) means older, already-generated quizzes render properly
// too. Skipped entirely once the text has a `$` already, so real LaTeX is never double-processed.
function withLegacyMathNotation(text) {
  if (!text || text.includes('$')) return text;
  return text
    .replace(BARE_EXPONENT, (_match, base, exponent) => `$${base}^${braced(exponent)}$`)
    .replace(BARE_SUBSCRIPT, (_match, base, subscript) => `$${base}_${braced(subscript)}$`);
}

// react-markdown wraps everything in a <p>, which breaks layout when this sits inside a <span> (option text) or
// is meant to flow inline with a status tag. Rendering the paragraph's children directly keeps it inline-safe.
const components = { p: ({ children }) => <>{children}</> };

// Renders quiz text (stem, options, explanations, ...) as Markdown with inline/block LaTeX math via KaTeX.
export default function MathText({ text }) {
  if (!text) return null;
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]} components={components}>
      {withLegacyMathNotation(text)}
    </ReactMarkdown>
  );
}

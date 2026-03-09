import React, { Children, Component, type ReactNode } from 'react';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

/**
 * Error boundary that catches react-typist crashes (e.g. Symbol conversion
 * errors with React 18 Fragments) and falls back to rendering children
 * without the typing animation.
 */
class TypistErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn('[SafeTypist] Caught render error, falling back:', error.message);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

type SafeTypistProps = React.ComponentProps<typeof Typist>;

function SafeTypist({ children, ...props }: SafeTypistProps) {
  // Filter out null/undefined/false children that cause react-typist's
  // eachPromise to throw "object null is not iterable"
  const safeChildren = Children.toArray(children).filter(Boolean);
  if (safeChildren.length === 0) return null;
  return (
    <TypistErrorBoundary fallback={<>{children}</>}>
      <Typist {...props}>{safeChildren}</Typist>
    </TypistErrorBoundary>
  );
}

// Re-export Typist.Delay so callers can use SafeTypist.Delay
SafeTypist.Delay = Typist.Delay;

export default SafeTypist;

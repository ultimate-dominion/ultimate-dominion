// Stub for @base-org/account — not used, but thirdweb dynamically imports it.
// Vite 4's esbuild doesn't support `import ... with { type: 'json' }` syntax.
export const createBaseAccountSDK = () => {
  throw new Error('@base-org/account is not available');
};

declare module 'next' {
  export type Metadata = {
    title?: string | { default?: string; template?: string };
    description?: string;
    robots?: { index?: boolean; follow?: boolean };
  };
}

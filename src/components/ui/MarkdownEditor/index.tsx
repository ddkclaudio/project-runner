'use client';

import dynamic from 'next/dynamic';
import { forwardRef } from 'react';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import { useThemePreference } from '@/hooks/useThemePreference';
import type { InitializedMarkdownEditorProps } from './InitializedMarkdownEditor';
import styles from './MarkdownEditor.module.css';

const Editor = dynamic(() => import('./InitializedMarkdownEditor'), {
  ssr: false,
  loading: () => <div className={styles.loading} aria-busy="true" aria-label="Carregando editor" />,
});

export type MarkdownEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number | string;
  /** Remonta o editor (ex.: ao trocar de organização). */
  remountKey?: string;
  readOnly?: boolean;
  'aria-label'?: string;
};

export const MarkdownEditor = forwardRef<MDXEditorMethods, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChange,
      placeholder = 'Escreva em Markdown…',
      className,
      minHeight,
      remountKey,
      readOnly,
      'aria-label': ariaLabel,
    },
    ref,
  ) {
    const { isLight, resolvedTheme } = useThemePreference();
    const colorScheme = isLight ? 'light' : 'dark';

    const editorProps: InitializedMarkdownEditorProps = {
      markdown: value,
      onChange,
      placeholder,
      className,
      minHeight,
      readOnly,
      colorScheme,
      editorRef: ref,
      'aria-label': ariaLabel,
    };

    // remountKey + tema: Radix dark/light precisa remontar para aplicar as escalas
    return <Editor key={`${remountKey ?? 'mdx'}-${resolvedTheme}`} {...editorProps} />;
  },
);

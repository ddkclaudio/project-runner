'use client';

import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  Separator,
  type MDXEditorMethods,
  type MDXEditorProps,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import type { ForwardedRef } from 'react';
import { cx } from '@/utils';
import styles from './MarkdownEditor.module.css';

export type InitializedMarkdownEditorProps = Omit<MDXEditorProps, 'markdown'> & {
  markdown: string;
  editorRef?: ForwardedRef<MDXEditorMethods> | null;
  className?: string;
  minHeight?: number | string;
  /** Alinha o skin do Radix ao tema do Nexus. */
  colorScheme?: 'light' | 'dark';
  'aria-label'?: string;
};

export default function InitializedMarkdownEditor({
  editorRef,
  className,
  minHeight = 220,
  colorScheme = 'dark',
  'aria-label': ariaLabel,
  readOnly = false,
  ...props
}: InitializedMarkdownEditorProps) {
  const minH = typeof minHeight === 'number' ? `${minHeight}px` : minHeight;
  const isDark = colorScheme !== 'light';

  const plugins = [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    markdownShortcutPlugin(),
    ...(readOnly
      ? []
      : [
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <ListsToggle />
                <Separator />
                <CreateLink />
              </>
            ),
          }),
        ]),
  ];

  return (
    <div
      className={cx(styles.root, readOnly && styles.readOnly, className)}
      style={{ ['--mdx-min-height' as string]: minH }}
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      data-color-scheme={colorScheme}
      data-readonly={readOnly || undefined}
    >
      <MDXEditor
        className={cx(
          styles.editor,
          isDark ? 'dark-theme' : 'light-theme',
          isDark ? styles.editorDark : styles.editorLight,
        )}
        contentEditableClassName={styles.content}
        plugins={plugins}
        readOnly={readOnly}
        {...props}
        ref={editorRef}
      />
    </div>
  );
}

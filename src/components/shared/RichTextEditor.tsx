// Title: Rich Text Editor
// Path: src/components/shared/RichTextEditor.tsx
// Functionality: TipTap-based rich-text editor (monochrome). Emits HTML via onChange.
// Toolbar state is reactive to selection (useEditorState), with paragraph-style and
// font-size dropdowns, a standard text-color control, and core formatting.

'use client';

import { useEffect, useRef } from 'react';
import { Extension } from '@tiptap/core';
import { useEditor, EditorContent, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { Highlight } from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extension-placeholder';
import { en } from '@/localization/en';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const t = en.richEditor;
const FONT_SIZES = ['12', '14', '16', '18', '24', '30'];

// Adds a `fontSize` attribute to the textStyle mark (set via setMark('textStyle', ...)).
const FontSize = Extension.create<{ types: string[] }>({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },
});

const Icons = {
  Bold: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" /><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>,
  Italic: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>,
  Underline: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>,
  Strike: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><path d="M16 6C16 6 14.5 4 12 4C9.5 4 8 6 8 8C8 10 16 14 16 16C16 18 14.5 20 12 20C9.5 20 8 18 8 18" /></svg>,
  Highlight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 18H21" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>,
  Link: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
  Quote: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Code: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
  AlignLeft: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="3" y2="6" /><line x1="15" y1="12" x2="3" y2="12" /><line x1="17" y1="18" x2="3" y2="18" /></svg>,
  AlignCenter: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="3" y2="6" /><line x1="19" y1="12" x2="5" y2="12" /><line x1="17" y1="18" x2="7" y2="18" /></svg>,
  AlignRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="12" x2="9" y2="12" /><line x1="21" y1="18" x2="7" y2="18" /></svg>,
  BulletList: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  OrderedList: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></svg>,
  Undo: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>,
  Redo: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>,
};

const Divider = () => <span className="mx-0.5 h-6 w-px shrink-0 bg-zinc-200" aria-hidden="true" />;
const selectClass = 'h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 outline-none transition-colors hover:border-zinc-300 focus:border-zinc-400';

function MenuBar({ editor }: { editor: Editor }) {
  const colorRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      highlight: editor.isActive('highlight'),
      link: editor.isActive('link'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      codeBlock: editor.isActive('codeBlock'),
      alignLeft: editor.isActive({ textAlign: 'left' }),
      alignCenter: editor.isActive({ textAlign: 'center' }),
      alignRight: editor.isActive({ textAlign: 'right' }),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
      color: (editor.getAttributes('textStyle').color as string | undefined) || '',
      fontSize: ((editor.getAttributes('textStyle').fontSize as string | undefined) || '').replace('px', ''),
      block: editor.isActive('heading', { level: 1 }) ? 'h1'
        : editor.isActive('heading', { level: 2 }) ? 'h2'
        : editor.isActive('heading', { level: 3 }) ? 'h3'
        : 'p',
    }),
  });

  if (!state) return null;

  const btn = (active: boolean) =>
    `h-8 w-8 flex shrink-0 items-center justify-center rounded-md transition-colors ${
      active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
    }`;

  const applyBlock = (value: string) => {
    if (value === 'p') {
      editor.chain().focus().setParagraph().run();
    } else if (value !== state.block) {
      editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
    }
  };

  const applyFontSize = (value: string) => {
    editor.chain().focus().setMark('textStyle', { fontSize: value ? `${value}px` : null }).run();
  };

  const applyLink = () => {
    const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt(t.linkPrompt, previous);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div role="toolbar" aria-label={t.toolbarLabel} className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 p-2">
      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!state.canUndo} className={`${btn(false)} disabled:opacity-30`} title={t.undo} aria-label={t.undo}><Icons.Undo /></button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!state.canRedo} className={`${btn(false)} disabled:opacity-30`} title={t.redo} aria-label={t.redo}><Icons.Redo /></button>
      <Divider />

      <select aria-label={t.styleLabel} value={state.block} onChange={e => applyBlock(e.target.value)} className={selectClass}>
        <option value="p">{t.paragraph}</option>
        <option value="h1">{t.heading1}</option>
        <option value="h2">{t.heading2}</option>
        <option value="h3">{t.heading3}</option>
      </select>
      <select aria-label={t.fontSizeLabel} value={state.fontSize} onChange={e => applyFontSize(e.target.value)} className={selectClass}>
        <option value="">{t.fontSizeDefault}</option>
        {FONT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
      </select>
      <Divider />

      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(state.bold)} title={t.bold} aria-label={t.bold} aria-pressed={state.bold}><Icons.Bold /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(state.italic)} title={t.italic} aria-label={t.italic} aria-pressed={state.italic}><Icons.Italic /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(state.underline)} title={t.underline} aria-label={t.underline} aria-pressed={state.underline}><Icons.Underline /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(state.strike)} title={t.strike} aria-label={t.strike} aria-pressed={state.strike}><Icons.Strike /></button>

      <span className="relative">
        <input
          ref={colorRef}
          type="color"
          aria-label={t.textColor}
          value={state.color || '#18181b'}
          onInput={e => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
          className="sr-only"
        />
        <button type="button" onClick={() => colorRef.current?.click()} className={`${btn(false)} flex-col gap-0`} title={t.textColor} aria-label={t.textColor}>
          <span className="text-[13px] font-bold leading-none">A</span>
          <span className="mt-0.5 h-1 w-4 rounded-sm" style={{ backgroundColor: state.color || '#18181b' }} />
        </button>
      </span>
      <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={btn(state.highlight)} title={t.highlight} aria-label={t.highlight} aria-pressed={state.highlight}><Icons.Highlight /></button>
      <button type="button" onClick={applyLink} className={btn(state.link)} title={t.link} aria-label={t.link} aria-pressed={state.link}><Icons.Link /></button>
      <Divider />

      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btn(state.alignLeft)} title={t.alignLeft} aria-label={t.alignLeft} aria-pressed={state.alignLeft}><Icons.AlignLeft /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btn(state.alignCenter)} title={t.alignCenter} aria-label={t.alignCenter} aria-pressed={state.alignCenter}><Icons.AlignCenter /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btn(state.alignRight)} title={t.alignRight} aria-label={t.alignRight} aria-pressed={state.alignRight}><Icons.AlignRight /></button>
      <Divider />

      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(state.bulletList)} title={t.bulletList} aria-label={t.bulletList} aria-pressed={state.bulletList}><Icons.BulletList /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(state.orderedList)} title={t.orderedList} aria-label={t.orderedList} aria-pressed={state.orderedList}><Icons.OrderedList /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(state.blockquote)} title={t.quote} aria-label={t.quote} aria-pressed={state.blockquote}><Icons.Quote /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btn(state.codeBlock)} title={t.codeBlock} aria-label={t.codeBlock} aria-pressed={state.codeBlock}><Icons.Code /></button>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write the notice residents will see...' }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'notice-prose min-h-[45vh] p-5 focus:outline-none',
      },
    },
  });

  // Reflect external resets (e.g. after sending) back into the editor.
  useEffect(() => {
    if (editor && value === '' && editor.getHTML() !== '<p></p>') {
      editor.commands.setContent('');
    }
  }, [value, editor]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {editor && <MenuBar editor={editor} />}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

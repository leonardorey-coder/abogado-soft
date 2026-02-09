// ============================================================================
// CollaborativeEditor — Editor de texto enriquecido colaborativo en tiempo real
// Usa TipTap (ProseMirror) + Y.js (CRDT) + Socket.io (transporte WebSocket)
// ============================================================================

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import * as Y from 'yjs';
import { SocketIOProvider, ConnectedUser } from '../lib/socketProvider';
import { documentsApi } from '../lib/api';

// ─── Props ───────────────────────────────────────────────────────────────────

interface CollaborativeEditorProps {
  documentId: string;
  userName: string;
  userId: string;
}

// ─── Color palette for users ─────────────────────────────────────────────────

const COLORS = ['#4F46E5', '#DC2626', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#65A30D'];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ─── Toolbar Button ──────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  icon?: string;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  small?: boolean;
}

const ToolbarBtn: React.FC<ToolbarBtnProps> = ({ icon, label, active, disabled, onClick, title, small }) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick?.(); }}
    disabled={disabled}
    title={title}
    className={`
      flex items-center justify-center rounded-lg transition-colors
      ${small ? 'size-7' : 'size-8'}
      ${active ? 'bg-primary/15 text-primary' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
      ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    {label ? (
      <span className={`font-bold ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
    ) : (
      <span className={`material-symbols-outlined ${small ? 'text-base' : 'text-lg'}`}>{icon}</span>
    )}
  </button>
);

const Divider = () => <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5" />;

// ─── Main Component ──────────────────────────────────────────────────────────

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  documentId,
  userName,
  userId,
}) => {
  // Y.js document — created once per mount (use key={documentId} from parent)
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<SocketIOProvider | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [synced, setSynced] = useState(false);
  const [saved, setSaved] = useState(true);
  const [initialContentLoaded, setInitialContentLoaded] = useState(false);

  // ─── Initialize Socket.io provider ──────────────────────────────────
  useEffect(() => {
    const user: ConnectedUser = {
      id: userId,
      name: userName,
      color: getUserColor(userId),
    };

    const socketProvider = new SocketIOProvider(documentId, ydoc, user);
    socketProvider.onUsersChange = (users) => setConnectedUsers(users);
    socketProvider.onSynced = () => setSynced(true);
    setProvider(socketProvider);

    return () => {
      socketProvider.destroy();
    };
  }, [documentId, ydoc, userId, userName]);

  // Cleanup Y.Doc on unmount
  useEffect(() => {
    return () => {
      ydoc.destroy();
    };
  }, [ydoc]);

  // ─── TipTap Editor ──────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({
        document: ydoc,
      }),
      Placeholder.configure({
        placeholder: 'Escribe aquí para comenzar a editar el documento…',
        emptyEditorClass: 'is-editor-empty',
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[800px] px-16 py-12 dark:prose-invert',
      },
    },
    onUpdate: () => {
      setSaved(false);
    },
  }, [ydoc]);

  // ─── Auto-save indicator ────────────────────────────────────────────
  useEffect(() => {
    if (saved) return;
    const timer = setTimeout(() => setSaved(true), 2000);
    return () => clearTimeout(timer);
  }, [saved]);
  // ─── Load original file content when Y.Doc is empty after sync ───────
  useEffect(() => {
    if (!synced || !editor || initialContentLoaded) return;

    // Check if the Y.Doc is empty (no content yet)
    const xmlFragment = ydoc.getXmlFragment('default');
    const isEmpty = xmlFragment.length === 0 ||
      (xmlFragment.length === 1 && xmlFragment.toJSON() === '');

    if (!isEmpty) {
      setInitialContentLoaded(true);
      return;
    }

    // Y.Doc is empty — try to load original file content
    (async () => {
      try {
        const { html } = await documentsApi.getContent(documentId);
        if (html && html.trim()) {
          editor.commands.setContent(html);
          console.log('[CollabEditor] Loaded original file content into editor');
        }
      } catch (err) {
        // Expected for PDFs, images, etc. — silently ignore
        console.log('[CollabEditor] No extractable content from file (expected for non-text files)');
      } finally {
        setInitialContentLoaded(true);
      }
    })();
  }, [synced, editor, documentId, ydoc, initialContentLoaded]);
  // ─── Loading state ──────────────────────────────────────────────────
  if (!synced) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px] bg-white dark:bg-[#0f0f1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Conectando al editor colaborativo…</p>
        </div>
      </div>
    );
  }

  if (!editor) return null;

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-0.5 flex-wrap shadow-sm">
        {/* Connected users */}
        <div className="flex items-center gap-1 mr-3 pr-3 border-r border-gray-200 dark:border-gray-700">
          {connectedUsers.map((u) => (
            <div
              key={u.id}
              title={u.name}
              className="size-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-sm ring-2 ring-white dark:ring-gray-900"
              style={{ backgroundColor: u.color }}
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {connectedUsers.length > 0 && (
            <span className="text-[11px] text-gray-400 ml-1 whitespace-nowrap">
              {connectedUsers.length} en línea
            </span>
          )}
        </div>

        {/* Format: Bold, Italic, Underline, Strike */}
        <ToolbarBtn icon="format_bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita (⌘B)" />
        <ToolbarBtn icon="format_italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva (⌘I)" />
        <ToolbarBtn icon="format_underlined" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado (⌘U)" />
        <ToolbarBtn icon="format_strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado" />

        <Divider />

        {/* Headings */}
        <ToolbarBtn label="H1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1" />
        <ToolbarBtn label="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2" />
        <ToolbarBtn label="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3" small />
        <ToolbarBtn icon="text_fields" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} title="Párrafo" />

        <Divider />

        {/* Lists */}
        <ToolbarBtn icon="format_list_bulleted" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista con viñetas" />
        <ToolbarBtn icon="format_list_numbered" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada" />

        <Divider />

        {/* Alignment */}
        <ToolbarBtn icon="format_align_left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinear izquierda" />
        <ToolbarBtn icon="format_align_center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrar" />
        <ToolbarBtn icon="format_align_right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinear derecha" />
        <ToolbarBtn icon="format_align_justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar" />

        <Divider />

        {/* Block elements */}
        <ToolbarBtn icon="format_quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita" />
        <ToolbarBtn icon="code" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Bloque de código" />
        <ToolbarBtn icon="horizontal_rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea horizontal" />

        <Divider />

        {/* Undo / Redo */}
        <ToolbarBtn icon="undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer (⌘Z)" />
        <ToolbarBtn icon="redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer (⌘⇧Z)" />

        {/* Save indicator */}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className={`material-symbols-outlined text-sm ${saved ? 'text-green-500' : 'text-amber-500 animate-pulse'}`}>
            {saved ? 'cloud_done' : 'sync'}
          </span>
          <span>{saved ? 'Guardado' : 'Guardando…'}</span>
        </div>
      </div>

      {/* ── Editor Content ── */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0f0f1a]">
        <div className="max-w-[900px] mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ── TipTap Editor Styles ── */}
      <style>{`
        .tiptap {
          outline: none;
        }
        .tiptap p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap h1 { font-size: 2em; font-weight: 800; margin-bottom: 0.5em; margin-top: 0.75em; line-height: 1.2; }
        .tiptap h2 { font-size: 1.5em; font-weight: 700; margin-bottom: 0.4em; margin-top: 0.6em; line-height: 1.3; }
        .tiptap h3 { font-size: 1.25em; font-weight: 600; margin-bottom: 0.3em; margin-top: 0.5em; line-height: 1.4; }
        .tiptap p { margin-bottom: 0.75em; line-height: 1.7; }
        .tiptap ul, .tiptap ol { padding-left: 1.5em; margin-bottom: 0.75em; }
        .tiptap li { margin-bottom: 0.25em; }
        .tiptap blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1em;
          margin-left: 0;
          color: #6b7280;
          font-style: italic;
          margin-bottom: 0.75em;
        }
        .tiptap pre {
          background: #1e1e2e;
          color: #cdd6f4;
          padding: 1em;
          border-radius: 0.5em;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9em;
          overflow-x: auto;
          margin-bottom: 0.75em;
        }
        .tiptap code {
          background: #f3f4f6;
          padding: 0.15em 0.4em;
          border-radius: 0.25em;
          font-size: 0.9em;
        }
        .tiptap hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5em 0;
        }
        .tiptap s { text-decoration: line-through; color: #9ca3af; }
        .tiptap u { text-decoration: underline; }
        .tiptap strong { font-weight: 700; }
        .tiptap em { font-style: italic; }

        /* Images */
        .tiptap img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5em;
          margin: 1em auto;
          display: block;
        }
        .tiptap img.ProseMirror-selectednode {
          outline: 3px solid #3b82f6;
          border-radius: 0.5em;
        }

        /* Tables from DOCX */
        .tiptap table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1em;
        }
        .tiptap th, .tiptap td {
          border: 1px solid #d1d5db;
          padding: 0.5em 0.75em;
          text-align: left;
        }
        .tiptap th {
          background: #f3f4f6;
          font-weight: 700;
        }

        /* Dark mode overrides */
        .dark .tiptap code { background: #1f2937; color: #e5e7eb; }
        .dark .tiptap hr { border-top-color: #374151; }
        .dark .tiptap blockquote { border-left-color: #6366f1; color: #9ca3af; }
        .dark .tiptap h1, .dark .tiptap h2, .dark .tiptap h3 { color: #f3f4f6; }
        .dark .tiptap p, .dark .tiptap li { color: #d1d5db; }
      `}</style>
    </div>
  );
};

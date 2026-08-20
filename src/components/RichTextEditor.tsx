"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import UniqueID from "@tiptap/extension-unique-id";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import {
  normalizeRichTextContent,
  textFromContent,
  type RichTextContent,
} from "@/lib/rich-text";

type EditorFont = "serif" | "sans" | "mono";

interface RichTextEditorProps {
  noteId: string;
  content: RichTextContent;
  readOnly: boolean;
  onEdit: () => void;
  onChange: (content: RichTextContent, plainText: string) => void;
  toolbarTail: ReactNode;
}

const HIGHLIGHTS = [
  { value: "#fff0a6", label: "Yellow" },
  { value: "#dfe8fa", label: "Blue" },
  { value: "#dfeee2", label: "Green" },
  { value: "#f4dfe6", label: "Rose" },
  { value: "#e8e0f3", label: "Violet" },
];

const CODE_LANGUAGES = [
  { value: "", label: "Plain code" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "markdown", label: "Markdown" },
];

function storedBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  return stored === null ? fallback : stored === "true";
}

function storedFont(): EditorFont {
  if (typeof window === "undefined") return "serif";
  const stored = window.localStorage.getItem("epinote:editor-font");
  return stored === "sans" || stored === "mono" || stored === "serif" ? stored : "serif";
}

function looksLikeMarkdown(value: string): boolean {
  return /(^|\n)(#{1,3}\s|[-*+]\s|\d+[.)]\s|>\s|```|\|.+\|)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/u.test(value);
}

function looksLikeFencedCode(value: string): boolean {
  return /^```[a-z\d_+-]*[^\S\r\n]*\r?\n[\s\S]*\r?\n```[^\S\r\n]*$/iu.test(value.trim());
}

function normalizedHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/")) return trimmed;
  const candidate = /^[a-z][a-z\d+.-]*:/iu.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(candidate).protocol) ? candidate : "";
  } catch {
    return "";
  }
}

function ToolButton({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
}: {
  label: ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`editor-tool-button ${active ? "active" : ""}`}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({
  noteId,
  content,
  readOnly,
  onEdit,
  onChange,
  toolbarTail,
}: RichTextEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const [markdownEnabled, setMarkdownEnabled] = useState(() =>
    storedBoolean("epinote:markdown-input", false),
  );
  const [font, setFont] = useState<EditorFont>(storedFont);
  const [tableSize, setTableSize] = useState({ rows: 3, cols: 3 });

  const editor = useEditor(
    {
      immediatelyRender: false,
      content: content as JSONContent,
      editable: !readOnly,
      // Code fences are an explicit writing convention, so they remain useful
      // without enabling every Markdown shortcut.
      enableInputRules: markdownEnabled ? true : ["codeBlock"],
      enablePasteRules: markdownEnabled,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          codeBlock: {
            HTMLAttributes: { spellcheck: "false" },
          },
          link: {
            openOnClick: false,
            autolink: markdownEnabled,
            defaultProtocol: "https",
            protocols: ["http", "https", "mailto"],
            HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
          },
        }),
        Highlight.configure({ multicolor: true }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TableKit.configure({
          table: {
            resizable: true,
            renderWrapper: true,
            HTMLAttributes: { class: "epinote-table" },
          },
        }),
        UniqueID.configure({
          types: ["paragraph", "heading", "blockquote", "listItem", "taskItem", "codeBlock", "table"],
        }),
        Markdown.configure({ markedOptions: { gfm: true } }),
        Placeholder.configure({ placeholder: "Start writing…" }),
      ],
      editorProps: {
        attributes: {
          "aria-label": "Note content",
          class: "epinote-rich-editor",
          spellcheck: "true",
        },
        handlePaste: (_view, event) => {
          const clipboard = event.clipboardData;
          if (!clipboard) return false;
          const text = clipboard.getData("text/plain");
          const fencedCode = looksLikeFencedCode(text);
          if (!fencedCode && (!markdownEnabled || clipboard.getData("text/html") || !looksLikeMarkdown(text))) {
            return false;
          }
          const current = editorRef.current;
          if (!current) return false;
          event.preventDefault();
          current.commands.insertContent(text, { contentType: "markdown" });
          return true;
        },
        handleKeyDown: (view, event) => {
          const current = editorRef.current;
          if (!current || !current.isActive("codeBlock")) return false;

          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            return current.chain().focus().exitCode().run();
          }

          if (event.key !== "Enter" || !view.state.selection.empty) return false;
          const { $from } = view.state.selection;
          if ($from.parent.type.name !== "codeBlock") return false;
          const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
          const currentLine = textBeforeCursor.slice(textBeforeCursor.lastIndexOf("\n") + 1);
          if (currentLine !== "```" && currentLine !== "~~~") return false;

          event.preventDefault();
          return current
            .chain()
            .focus()
            .deleteRange({ from: $from.pos - currentLine.length, to: $from.pos })
            .exitCode()
            .run();
        },
      },
      onCreate: ({ editor: createdEditor }) => {
        editorRef.current = createdEditor;
      },
      onDestroy: () => {
        editorRef.current = null;
      },
      onUpdate: ({ editor: updatedEditor }) => {
        const normalized = normalizeRichTextContent(updatedEditor.getJSON());
        if (normalized) onChange(normalized, textFromContent(normalized));
      },
    },
    [noteId, markdownEnabled],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(content);
    if (current !== incoming) editor.commands.setContent(content as JSONContent, { emitUpdate: false });
  }, [content, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => current ? ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      highlight: current.isActive("highlight"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      taskList: current.isActive("taskList"),
      codeBlock: current.isActive("codeBlock"),
      codeLanguage: String(current.getAttributes("codeBlock").language ?? ""),
      link: current.isActive("link"),
      table: current.isActive("table"),
      heading1: current.isActive("heading", { level: 1 }),
      heading2: current.isActive("heading", { level: 2 }),
      heading3: current.isActive("heading", { level: 3 }),
    }) : null,
  });

  const disabled = !editor || readOnly;
  const textStyle = state?.heading1 ? "h1" : state?.heading2 ? "h2" : state?.heading3 ? "h3" : "paragraph";

  function setTextStyle(value: string) {
    if (!editor) return;
    if (value === "paragraph") editor.chain().focus().setParagraph().run();
    else editor.chain().focus().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  }

  function setLink() {
    if (!editor) return;
    const existing = String(editor.getAttributes("link").href ?? "");
    const value = window.prompt("Link URL", existing);
    if (value === null) return;
    const href = normalizedHref(value);
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function toggleMarkdown() {
    const next = !markdownEnabled;
    window.localStorage.setItem("epinote:markdown-input", String(next));
    setMarkdownEnabled(next);
  }

  function changeFont(value: EditorFont) {
    window.localStorage.setItem("epinote:editor-font", value);
    setFont(value);
  }

  return (
    <>
      <div className="format-bar" aria-label="Note formatting">
        <button type="button" onClick={onEdit} className={!readOnly ? "active" : ""}>Write</button>
        <span className="editor-tool-divider" />
        <select
          className="editor-tool-select style-select"
          aria-label="Text style"
          title="Text style"
          value={textStyle}
          disabled={disabled}
          onChange={(event) => setTextStyle(event.target.value)}
        >
          <option value="paragraph">Text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <select
          className="editor-tool-select font-select"
          aria-label="Editor font"
          title="Editor font"
          value={font}
          onChange={(event) => changeFont(event.target.value as EditorFont)}
        >
          <option value="serif">Serif</option>
          <option value="sans">Sans</option>
          <option value="mono">Mono</option>
        </select>
        <ToolButton label={<strong>B</strong>} title="Bold (⌘B)" active={state?.bold} disabled={disabled} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <ToolButton label={<em>I</em>} title="Italic (⌘I)" active={state?.italic} disabled={disabled} onClick={() => editor?.chain().focus().toggleItalic().run()} />
        <ToolButton label={<span className="underline-tool">U</span>} title="Underline (⌘U)" active={state?.underline} disabled={disabled} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
        <select
          className={`editor-tool-select highlight-select ${state?.highlight ? "active" : ""}`}
          aria-label="Highlight color"
          title="Highlight"
          value=""
          disabled={disabled}
          onChange={(event) => {
            if (!editor) return;
            if (event.target.value === "clear") editor.chain().focus().unsetHighlight().run();
            else editor.chain().focus().setHighlight({ color: event.target.value }).run();
          }}
        >
          <option value="">Highlight</option>
          {HIGHLIGHTS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          <option value="clear">Clear highlight</option>
        </select>
        <span className="editor-tool-divider" />
        <ToolButton label="•" title="Bullet list" active={state?.bulletList} disabled={disabled} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <ToolButton label="1." title="Numbered list" active={state?.orderedList} disabled={disabled} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
        <ToolButton label="☑" title="Checklist" active={state?.taskList} disabled={disabled} onClick={() => editor?.chain().focus().toggleTaskList().run()} />
        <ToolButton label="↗" title="Add or edit link" active={state?.link} disabled={disabled} onClick={setLink} />
        <ToolButton
          label={<span className="code-tool-label"><span aria-hidden="true">&lt;/&gt;</span> Code</span>}
          title="Code block — or type ``` and press Enter"
          active={state?.codeBlock}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        />
        {state?.codeBlock && (
          <div className="code-context-tools" aria-label="Code block options">
            <select
              className="editor-tool-select code-language-select"
              aria-label="Code language"
              title="Code language"
              value={state.codeLanguage}
              disabled={disabled}
              onChange={(event) => editor?.chain().focus().updateAttributes("codeBlock", {
                language: event.target.value || null,
              }).run()}
            >
              {CODE_LANGUAGES.map((language) => (
                <option value={language.value} key={language.value || "plain"}>{language.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="code-exit-button"
              title="Finish code block (Ctrl/⌘+Enter)"
              disabled={disabled}
              onClick={() => editor?.chain().focus().exitCode().run()}
            >
              Done
            </button>
          </div>
        )}
        <details className="table-tool-menu dismissible-details">
          <summary
            className={`editor-tool-button ${state?.table ? "active" : ""} ${disabled ? "disabled" : ""}`}
            title="Table"
            aria-label="Table"
          >
            ▦
          </summary>
          {!state?.table ? (
            <div className="table-grid-popover">
              <strong>{tableSize.rows} × {tableSize.cols} table</strong>
              <div className="table-grid-picker" role="grid" aria-label="Choose table size">
                {Array.from({ length: 36 }, (_, index) => {
                  const row = Math.floor(index / 6) + 1;
                  const col = index % 6 + 1;
                  return (
                    <button
                      type="button"
                      role="gridcell"
                      className={row <= tableSize.rows && col <= tableSize.cols ? "selected" : ""}
                      aria-label={`${row} rows by ${col} columns`}
                      disabled={disabled}
                      key={`${row}-${col}`}
                      onPointerEnter={() => setTableSize({ rows: row, cols: col })}
                      onClick={(event) => {
                        editor?.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run();
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="table-actions-popover">
              <button type="button" onClick={() => editor?.chain().focus().addRowAfter().run()}>Add row</button>
              <button type="button" onClick={() => editor?.chain().focus().addColumnAfter().run()}>Add column</button>
              <button type="button" onClick={() => editor?.chain().focus().deleteRow().run()}>Delete row</button>
              <button type="button" onClick={() => editor?.chain().focus().deleteColumn().run()}>Delete column</button>
              <button className="danger" type="button" onClick={() => editor?.chain().focus().deleteTable().run()}>Delete table</button>
            </div>
          )}
        </details>
        <button
          type="button"
          className={`markdown-toggle ${markdownEnabled ? "active" : ""}`}
          aria-pressed={markdownEnabled}
          title={markdownEnabled ? "Markdown shortcuts are on" : "Turn on Markdown shortcuts"}
          onClick={toggleMarkdown}
        >
          MD <span>{markdownEnabled ? "On" : "Off"}</span>
        </button>
        <span className="format-spacer" />
        {toolbarTail}
      </div>
      <div className={`editor-area rich-editor-area editor-font-${font} ${readOnly ? "read-mode" : ""}`}>
        <EditorContent editor={editor} />
      </div>
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { WorkspacePayload } from "@/lib/workspace";

type Note = WorkspacePayload["notes"][number];
type SaveState = "Saved" | "Unsaved changes" | "Saving…" | "Save failed";
type OrganizeState = "idle" | "loading" | "ready" | "applying" | "error";
type OrganizeProposal = {
  id: string;
  sourceRevision: number;
  title: string;
  body: string;
};

export function WorkspaceApp({
  initialWorkspace,
  userName,
  userEmail,
}: {
  initialWorkspace: WorkspacePayload;
  userName: string;
  userEmail: string;
}) {
  const router = useRouter();
  const initialBookId = initialWorkspace.books[0]?.id ?? null;
  const initialNoteId = initialWorkspace.notes.find((note) => note.bookId === initialBookId)?.id ?? null;
  const [books, setBooks] = useState(initialWorkspace.books);
  const [notes, setNotes] = useState(initialWorkspace.notes);
  const [activeBookId, setActiveBookId] = useState<string | null>(initialBookId);
  const [selectedId, setSelectedId] = useState(initialNoteId);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(false);
  const [creating, setCreating] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(initialWorkspace.workspace.name);
  const [workspaceDraft, setWorkspaceDraft] = useState(initialWorkspace.workspace.name);
  const [renamingWorkspace, setRenamingWorkspace] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [noteActionId, setNoteActionId] = useState<string | null>(null);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [noteTitleDraft, setNoteTitleDraft] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [addingBook, setAddingBook] = useState(false);
  const [bookNameDraft, setBookNameDraft] = useState("");
  const [bookSaving, setBookSaving] = useState(false);
  const [bookError, setBookError] = useState("");
  const [organizePanelOpen, setOrganizePanelOpen] = useState(false);
  const [organizeState, setOrganizeState] = useState<OrganizeState>("idle");
  const [organizeProposal, setOrganizeProposal] = useState<OrganizeProposal | null>(null);
  const [organizeError, setOrganizeError] = useState("");
  const notesRef = useRef(notes);
  const savingRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes.filter((note) => note.bookId === activeBookId);
    return notes.filter((note) =>
      note.title.toLowerCase().includes(normalized) || note.body.toLowerCase().includes(normalized),
    );
  }, [activeBookId, notes, query]);

  useEffect(() => {
    if (!selected) return;
    const rawDraft = window.localStorage.getItem(`epinote:draft:${selected.id}`);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as Pick<Note, "title" | "body" | "revision">;
      if (
        draft.revision === selected.revision &&
        (draft.title !== selected.title || draft.body !== selected.body)
      ) {
        const timeout = window.setTimeout(() => {
          setNotes((current) =>
            current.map((note) =>
              note.id === selected.id ? { ...note, title: draft.title, body: draft.body } : note,
            ),
          );
          setDirty(true);
          setSaveState("Unsaved changes");
        }, 0);
        return () => window.clearTimeout(timeout);
      }
    } catch {
      window.localStorage.removeItem(`epinote:draft:${selected.id}`);
    }
    // A draft is restored only when selecting a different persisted note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const saveNote = useCallback(async (note: Note): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaveState("Saving…");
    setError("");

    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: note.revision,
          title: note.title || "Untitled note",
          body: note.body,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        note?: { revision: number; updatedAt: string };
      };

      if (!response.ok || !data.note) {
        setError(data.error || "Unable to save this note.");
        setSaveState("Save failed");
        return false;
      }

      const latest = notesRef.current.find((item) => item.id === note.id);
      const unchangedSinceRequest =
        latest?.title === note.title && latest?.body === note.body;

      setNotes((current) =>
        current.map((item) =>
          item.id === note.id
            ? { ...item, revision: data.note!.revision, updatedAt: data.note!.updatedAt }
            : item,
        ),
      );

      if (unchangedSinceRequest) {
        window.localStorage.removeItem(`epinote:draft:${note.id}`);
        setDirty(false);
        setSaveState("Saved");
      } else {
        setSaveState("Unsaved changes");
      }
      return true;
    } catch {
      setError("EpiNote is unreachable. Your draft is still in this browser.");
      setSaveState("Save failed");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!dirty || !selected || savingRef.current || renamingNoteId) return;
    const timeout = window.setTimeout(() => void saveNote(selected), 900);
    return () => window.clearTimeout(timeout);
  }, [dirty, selected, saveNote, renamingNoteId]);

  function updateSelected(changes: Partial<Pick<Note, "title" | "body">>) {
    if (!selected) return;
    const next = { ...selected, ...changes };
    setNotes((current) => current.map((note) => (note.id === selected.id ? next : note)));
    window.localStorage.setItem(
      `epinote:draft:${selected.id}`,
      JSON.stringify({ title: next.title, body: next.body, revision: next.revision }),
    );
    setDirty(true);
    setSaveState("Unsaved changes");
  }

  async function chooseNote(noteId: string) {
    if (noteId === selectedId) return;
    if (dirty && selected && !(await saveNote(selected))) return;
    const nextNote = notesRef.current.find((note) => note.id === noteId);
    if (nextNote) setActiveBookId(nextNote.bookId);
    setSelectedId(noteId);
    setDirty(false);
    setError("");
    setPreview(false);
    closeOrganizePanel();
  }

  async function createNote() {
    if (creating) return;
    if (!activeBookId) return;
    if (dirty && selected && !(await saveNote(selected))) return;
    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: activeBookId }),
      });
      const data = (await response.json()) as { error?: string; note?: Note };
      if (!response.ok || !data.note) {
        setError(data.error || "Unable to create a note.");
        return;
      }
      setNotes((current) => [data.note!, ...current]);
      setBooks((current) =>
        current.map((book) =>
          book.id === data.note!.bookId ? { ...book, noteCount: book.noteCount + 1 } : book,
        ),
      );
      setSelectedId(data.note.id);
      setDirty(false);
      setSaveState("Saved");
      setPreview(false);
      closeOrganizePanel();
      window.setTimeout(() => editorRef.current?.focus(), 0);
    } catch {
      setError("EpiNote is unreachable. Try again when your connection returns.");
    } finally {
      setCreating(false);
    }
  }

  async function chooseBook(bookId: string) {
    closeBookCreator();
    if (bookId === activeBookId) return;
    if (dirty && selected && !(await saveNote(selected))) return;
    setActiveBookId(bookId);
    setSelectedId(notesRef.current.find((note) => note.bookId === bookId)?.id ?? null);
    setDirty(false);
    setError("");
    setPreview(false);
    setQuery("");
    closeOrganizePanel();
  }

  function closeBookCreator() {
    if (bookSaving) return;
    setAddingBook(false);
    setBookNameDraft("");
    setBookError("");
  }

  function toggleBookCreator() {
    if (addingBook) closeBookCreator();
    else {
      setBookError("");
      setAddingBook(true);
    }
  }

  async function createBook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = bookNameDraft.trim();
    if (!name || name.length > 100 || bookSaving) return;
    if (dirty && selected && !(await saveNote(selected))) return;
    setBookSaving(true);
    setBookError("");

    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        error?: string;
        book?: { id: string; name: string; systemKey: string | null; noteCount: number };
      };
      if (!response.ok || !data.book) {
        setBookError(data.error || "Unable to create this book.");
        return;
      }

      setBooks((current) => [...current, data.book!]);
      setActiveBookId(data.book.id);
      setSelectedId(null);
      setBookNameDraft("");
      setAddingBook(false);
      setDirty(false);
      setSaveState("Saved");
    } catch {
      setBookError("EpiNote is unreachable. The book was not created.");
    } finally {
      setBookSaving(false);
    }
  }

  function startBulletList() {
    const editor = editorRef.current;
    if (!editor || !selected) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selection = selected.body.slice(start, end);
    const bulleted = selection
      ? selection.split("\n").map((line) => `• ${line}`).join("\n")
      : "• ";
    const nextBody = selected.body.slice(0, start) + bulleted + selected.body.slice(end);
    updateSelected({ body: nextBody });
    window.setTimeout(() => {
      editor.focus();
      const cursor = selection ? start + bulleted.length : start + 2;
      editor.setSelectionRange(cursor, cursor);
    }, 0);
  }

  function exportNote() {
    if (!selected) return;
    const blob = new Blob([`${selected.title}\n\n${selected.body}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "note"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    if (dirty && selected) await saveNote(selected);
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.ok) {
      router.push("/login");
      router.refresh();
    }
    else setError("Unable to sign out. Your notes remain available here.");
  }

  async function renameWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = workspaceDraft.trim();
    if (nextName.length < 2 || nextName.length > 100) {
      setWorkspaceError("Use a workspace name between 2 and 100 characters.");
      return;
    }

    if (nextName === workspaceName) {
      setRenamingWorkspace(false);
      setWorkspaceError("");
      return;
    }

    setWorkspaceSaving(true);
    setWorkspaceError("");
    try {
      const response = await fetch(`/api/workspaces/${initialWorkspace.workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const data = (await response.json()) as {
        error?: string;
        workspace?: { id: string; name: string };
      };

      if (!response.ok || !data.workspace) {
        setWorkspaceError(data.error || "Unable to rename this workspace.");
        return;
      }

      setWorkspaceName(data.workspace.name);
      setWorkspaceDraft(data.workspace.name);
      setRenamingWorkspace(false);
    } catch {
      setWorkspaceError("EpiNote is unreachable. Try again when your connection returns.");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  function beginWorkspaceRename() {
    setWorkspaceDraft(workspaceName);
    setWorkspaceError("");
    setRenamingWorkspace(true);
  }

  function cancelWorkspaceRename() {
    setWorkspaceDraft(workspaceName);
    setWorkspaceError("");
    setRenamingWorkspace(false);
  }

  async function beginNoteRename(note: Note) {
    setNoteActionId(null);
    if (note.id !== selectedId) {
      if (dirty && selected && !(await saveNote(selected))) return;
      setSelectedId(note.id);
      setDirty(false);
      setError("");
      setPreview(false);
    }
    setNoteTitleDraft(note.title || "Untitled note");
    setRenamingNoteId(note.id);
  }

  async function renameNote(event: React.FormEvent<HTMLFormElement>, noteId: string) {
    event.preventDefault();
    const note = notesRef.current.find((item) => item.id === noteId);
    const title = noteTitleDraft.trim();
    if (!note || !title || title.length > 200) return;
    if (title === note.title) {
      setRenamingNoteId(null);
      return;
    }

    const nextNote = { ...note, title };
    const nextNotes = notesRef.current.map((item) => (item.id === noteId ? nextNote : item));
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setDirty(true);
    setSaveState("Unsaved changes");
    if (await saveNote(nextNote)) setRenamingNoteId(null);
  }

  async function deleteNote(note: Note) {
    setNoteActionId(null);
    if (!window.confirm(`Delete “${note.title || "Untitled note"}”?`)) return;
    setDeletingNoteId(note.id);
    setError("");

    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: note.revision }),
      });
      const data = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok || !data.ok) {
        setError(data.error || "Unable to delete this note.");
        return;
      }

      const remaining = notesRef.current.filter((item) => item.id !== note.id);
      notesRef.current = remaining;
      setNotes(remaining);
      setBooks((current) =>
        current.map((book) =>
          book.id === note.bookId
            ? { ...book, noteCount: Math.max(0, book.noteCount - 1) }
            : book,
        ),
      );
      window.localStorage.removeItem(`epinote:draft:${note.id}`);
      if (selectedId === note.id) {
        setSelectedId(remaining.find((item) => item.bookId === activeBookId)?.id ?? null);
        setDirty(false);
        setSaveState("Saved");
        setPreview(false);
        closeOrganizePanel();
      }
    } catch {
      setError("EpiNote is unreachable. The note was not deleted.");
    } finally {
      setDeletingNoteId(null);
    }
  }

  function closeOrganizePanel() {
    setOrganizePanelOpen(false);
    setOrganizeState("idle");
    setOrganizeProposal(null);
    setOrganizeError("");
  }

  async function organizeNote() {
    if (!selected || organizeState === "loading" || organizeState === "applying") return;
    if (!selected.body.trim()) {
      setError("Add some text before organizing this note.");
      return;
    }
    if (dirty && !(await saveNote(selected))) return;

    setOrganizePanelOpen(true);
    setOrganizeState("loading");
    setOrganizeProposal(null);
    setOrganizeError("");
    try {
      const response = await fetch(`/api/notes/${selected.id}/organize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as {
        error?: string;
        proposal?: OrganizeProposal;
      };
      if (!response.ok || !data.proposal) {
        setOrganizeError(data.error || "Unable to organize this note.");
        setOrganizeState("error");
        return;
      }
      setOrganizeProposal(data.proposal);
      setOrganizeState("ready");
    } catch {
      setOrganizeError("EpiNote cannot reach the AI service right now.");
      setOrganizeState("error");
    }
  }

  async function applyOrganization() {
    if (!selected || !organizeProposal || organizeState === "applying") return;
    setOrganizeState("applying");
    setOrganizeError("");
    try {
      const response = await fetch(`/api/notes/${selected.id}/organize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: organizeProposal.id,
          expectedRevision: organizeProposal.sourceRevision,
        }),
      });
      const data = (await response.json()) as { error?: string; note?: Note };
      if (!response.ok || !data.note) {
        setOrganizeError(data.error || "Unable to apply this organization.");
        setOrganizeState("error");
        return;
      }

      const nextNotes = notesRef.current.map((note) =>
        note.id === data.note!.id ? { ...note, ...data.note! } : note,
      );
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      window.localStorage.removeItem(`epinote:draft:${data.note.id}`);
      setDirty(false);
      setSaveState("Saved");
      setError("");
      closeOrganizePanel();
    } catch {
      setOrganizeError("EpiNote cannot apply this suggestion right now.");
      setOrganizeState("error");
    }
  }

  const avatar = userName.trim().charAt(0).toUpperCase() || "E";
  const activeBook = books.find((book) => book.id === activeBookId) ?? null;

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-identity">
          <span className="wordmark workspace-wordmark">EpiNote</span>
          <span className="topbar-divider" />
          {renamingWorkspace ? (
            <form className="workspace-inline-rename" onSubmit={renameWorkspace}>
              <input
                value={workspaceDraft}
                onChange={(event) => setWorkspaceDraft(event.target.value)}
                onBlur={(event) => event.currentTarget.form?.requestSubmit()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelWorkspaceRename();
                  }
                }}
                aria-label="Workspace name"
                minLength={2}
                maxLength={100}
                autoFocus
                disabled={workspaceSaving}
                required
              />
              {workspaceError && <span role="alert">{workspaceError}</span>}
            </form>
          ) : (
            <span
              className="workspace-name workspace-name-editable"
              onDoubleClick={beginWorkspaceRename}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "F2") beginWorkspaceRename();
              }}
              role="button"
              tabIndex={0}
              title="Double-click to rename"
              aria-label={`${workspaceName}. Double-click to rename workspace.`}
            >
              {workspaceName}
            </span>
          )}
        </div>
        <label className="workspace-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this workspace"
            aria-label="Search notes"
          />
        </label>
        <div className="workspace-account">
          <span className={`save-chip ${saveState === "Save failed" ? "failed" : ""}`}>
            {saveState === "Saved" ? "Saved automatically" : saveState}
          </span>
          <details className="user-menu">
            <summary className="avatar-button" title="Open account menu" aria-label="Open account menu">
              {avatar}
            </summary>
            <div className="account-popover">
              <p className="account-label">Signed in as</p>
              <strong>{userName}</strong>
              <span className="account-email">{userEmail}</span>
              <div className="account-context">
                <span>Organization</span>
                <strong>{initialWorkspace.organization.name}</strong>
                <span>Workspace</span>
                <strong>{workspaceName}</strong>
              </div>
              <button className="account-signout" type="button" onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          </details>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="notes-sidebar">
          <div className="sidebar-heading">
            <span>Library</span>
            <button
              type="button"
              aria-label={addingBook ? "Cancel new book" : "Create book"}
              aria-expanded={addingBook}
              title={addingBook ? "Cancel new book" : "Create book"}
              onClick={toggleBookCreator}
            >{addingBook ? "×" : "+"}</button>
          </div>
          <div className="book-list" aria-label="Library">
            {books.map((book) => (
              <button
                className={`book-row ${book.id === activeBookId ? "selected" : ""}`}
                type="button"
                key={book.id}
                onClick={() => void chooseBook(book.id)}
                title={book.systemKey === "unsorted" ? "Default place for quick captures" : book.name}
              >
                <span aria-hidden="true">{book.id === activeBookId ? "▾" : "›"}</span>
                <strong>{book.name}</strong>
                <span className="book-note-count" aria-label={`${book.noteCount} notes`}>
                  {book.noteCount}
                </span>
              </button>
            ))}
            {addingBook && (
              <form
                className="book-create-form"
                onSubmit={createBook}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    closeBookCreator();
                  }
                }}
              >
                <input
                  value={bookNameDraft}
                  onChange={(event) => setBookNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      closeBookCreator();
                    }
                  }}
                  placeholder="Book name"
                  aria-label="Book name"
                  maxLength={100}
                  autoFocus
                  disabled={bookSaving}
                  required
                />
                <button type="submit" aria-label="Add book" disabled={bookSaving}>✓</button>
                <button
                  className="book-create-cancel"
                  type="button"
                  aria-label="Cancel new book"
                  onClick={closeBookCreator}
                  disabled={bookSaving}
                >×</button>
                {bookError && <span role="alert">{bookError}</span>}
              </form>
            )}
          </div>
          <button className="new-note-button" type="button" onClick={createNote} disabled={creating || !activeBookId}>
            <span>+</span>{creating ? "Creating…" : "New note"}
          </button>
          <div className="note-list" aria-label="Notes">
            {filteredNotes.map((note) => (
              <div
                className={`note-row ${note.id === selectedId ? "selected" : ""}`}
                key={note.id}
              >
                {renamingNoteId === note.id ? (
                  <form className="note-inline-rename" onSubmit={(event) => void renameNote(event, note.id)}>
                    <input
                      value={noteTitleDraft}
                      onChange={(event) => setNoteTitleDraft(event.target.value)}
                      onBlur={(event) => event.currentTarget.form?.requestSubmit()}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setRenamingNoteId(null);
                        }
                      }}
                      aria-label="Note name"
                      maxLength={200}
                      autoFocus
                      required
                    />
                  </form>
                ) : (
                  <button
                    className="note-row-main"
                    type="button"
                    onClick={() => void chooseNote(note.id)}
                    onDoubleClick={() => void beginNoteRename(note)}
                    title="Double-click to rename"
                  >
                    <span className="note-row-title">{note.title || "Untitled note"}</span>
                    <span className="note-row-date">
                      {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                        new Date(note.updatedAt),
                      )}
                    </span>
                  </button>
                )}
                <button
                  className="note-more-button"
                  type="button"
                  aria-label={`Actions for ${note.title || "Untitled note"}`}
                  aria-expanded={noteActionId === note.id}
                  onClick={() => setNoteActionId((current) => (current === note.id ? null : note.id))}
                  disabled={deletingNoteId === note.id}
                >
                  {deletingNoteId === note.id ? "…" : "•••"}
                </button>
                {noteActionId === note.id && (
                  <div className="note-actions-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => void beginNoteRename(note)}>
                      Rename
                    </button>
                    <button className="danger" type="button" role="menuitem" onClick={() => void deleteNote(note)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            {filteredNotes.length === 0 && (
              <p className="empty-list">
                {query.trim()
                  ? "No notes match."
                  : notes.length
                    ? "No notes in this book yet."
                    : "Your first note starts here."}
              </p>
            )}
          </div>
        </aside>

        <section className="note-panel">
          {selected ? (
            <>
              <div className="note-header">
                <p className="note-path">
                  {initialWorkspace.organization.name} / {activeBook?.name ?? "Quick Capture"}
                </p>
                <input
                  className="note-title-input"
                  value={selected.title}
                  onChange={(event) => updateSelected({ title: event.target.value })}
                  maxLength={200}
                  aria-label="Note title"
                />
              </div>
              <div className="format-bar" aria-label="Formatting">
                <button type="button" onClick={() => setPreview(false)} className={!preview ? "active" : ""}>Edit</button>
                <button type="button" onClick={startBulletList} aria-label="Bullet list">• List</button>
                <span className="format-spacer" />
                <button type="button" onClick={() => setPreview(true)} className={preview ? "active" : ""}>Read</button>
              </div>
              <div className="editor-area">
                {preview ? (
                  <article className="note-preview">
                    {selected.body.split("\n").map((line, index) => (
                      <p key={`${index}-${line.slice(0, 12)}`}>{line || "\u00a0"}</p>
                    ))}
                  </article>
                ) : (
                  <textarea
                    ref={editorRef}
                    value={selected.body}
                    onChange={(event) => updateSelected({ body: event.target.value })}
                    placeholder="Start writing…"
                    aria-label="Note content"
                    spellCheck
                  />
                )}
              </div>
              <footer className="note-footer">
                <button
                  className="button button-secondary button-small organize-button"
                  type="button"
                  title={selected.body.trim() ? "Organize this note with AI" : "Add text before organizing"}
                  onClick={() => void organizeNote()}
                  disabled={!selected.body.trim() || organizeState === "loading" || organizeState === "applying"}
                >
                  Organize
                </button>
                <div className="note-footer-right">
                  {error && <span className="workspace-error" role="alert">{error}</span>}
                  <button className="button button-secondary button-small" type="button" onClick={exportNote}>Export</button>
                  {!dirty && saveState === "Saved" ? (
                    <span className="autosave-confirmation" role="status">✓ Saved automatically</span>
                  ) : (
                    <button
                      className="button button-small"
                      type="button"
                      onClick={() => void saveNote(selected)}
                      disabled={saveState === "Saving…"}
                    >
                      {saveState === "Save failed" ? "Retry save" : saveState === "Saving…" ? "Saving…" : "Save now"}
                    </button>
                  )}
                </div>
              </footer>
              {organizePanelOpen && (
                <aside className="organize-panel" aria-label="Organize note">
                  <header className="organize-panel-header">
                    <div>
                      <p className="eyebrow">AI suggestion</p>
                      <h2>Organize note</h2>
                    </div>
                    <button type="button" onClick={closeOrganizePanel} aria-label="Close organize panel">×</button>
                  </header>
                  <p className="organize-safety">
                    Your saved text is sent to OpenRouter. The original stays unchanged until you apply the suggestion.
                  </p>
                  {organizeState === "loading" && (
                    <div className="organize-panel-state" role="status">
                      <strong>Creating a clearer structure…</strong>
                      <span>Preserving names, links, timestamps, and source details.</span>
                    </div>
                  )}
                  {organizeState === "error" && (
                    <div className="organize-panel-state organize-panel-error" role="alert">
                      <strong>Organization failed</strong>
                      <span>{organizeError}</span>
                      <button className="button button-secondary button-small" type="button" onClick={() => void organizeNote()}>
                        Try again
                      </button>
                    </div>
                  )}
                  {organizeProposal && (organizeState === "ready" || organizeState === "applying") && (
                    <div className="organize-proposal">
                      <p className="organize-proposal-label">Proposed title</p>
                      <h3>{organizeProposal.title}</h3>
                      <p className="organize-proposal-label">Proposed layout</p>
                      <pre>{organizeProposal.body}</pre>
                      <footer>
                        <button className="button button-secondary button-small" type="button" onClick={closeOrganizePanel} disabled={organizeState === "applying"}>
                          Keep original
                        </button>
                        <button className="button button-small" type="button" onClick={() => void applyOrganization()} disabled={organizeState === "applying"}>
                          {organizeState === "applying" ? "Applying…" : "Apply organization"}
                        </button>
                      </footer>
                    </div>
                  )}
                </aside>
              )}
            </>
          ) : (
            <div className="empty-editor">
              <p className="eyebrow">{activeBook?.name ?? "Quick Capture"}</p>
              <h1>Begin with a useful note.</h1>
              <p>Capture the thought now. You can organize and connect it later.</p>
              <button className="button" type="button" onClick={createNote}>Create your first note</button>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

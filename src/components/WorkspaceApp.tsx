"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { WorkspacePayload } from "@/lib/workspace";

type Note = WorkspacePayload["notes"][number];
type SaveState = "Saved" | "Unsaved changes" | "Saving…" | "Save failed";

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
  const [notes, setNotes] = useState(initialWorkspace.notes);
  const [selectedId, setSelectedId] = useState(initialWorkspace.notes[0]?.id ?? null);
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
  const notesRef = useRef(notes);
  const savingRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const userMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(normalized) ||
        note.body.toLowerCase().includes(normalized),
    );
  }, [notes, query]);

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
    if (!dirty || !selected || savingRef.current) return;
    const timeout = window.setTimeout(() => void saveNote(selected), 900);
    return () => window.clearTimeout(timeout);
  }, [dirty, selected, saveNote]);

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
    setSelectedId(noteId);
    setDirty(false);
    setError("");
    setPreview(false);
  }

  async function createNote() {
    if (creating) return;
    if (dirty && selected && !(await saveNote(selected))) return;
    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as { error?: string; note?: Note };
      if (!response.ok || !data.note) {
        setError(data.error || "Unable to create a note.");
        return;
      }
      setNotes((current) => [data.note!, ...current]);
      setSelectedId(data.note.id);
      setDirty(false);
      setSaveState("Saved");
      setPreview(false);
      window.setTimeout(() => editorRef.current?.focus(), 0);
    } catch {
      setError("EpiNote is unreachable. Try again when your connection returns.");
    } finally {
      setCreating(false);
    }
  }

  function formatSelection(before: string, after = before) {
    const editor = editorRef.current;
    if (!editor || !selected) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const nextBody =
      selected.body.slice(0, start) +
      before +
      selected.body.slice(start, end) +
      after +
      selected.body.slice(end);
    updateSelected({ body: nextBody });
    window.setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }

  function exportNote() {
    if (!selected) return;
    const blob = new Blob([`# ${selected.title}\n\n${selected.body}\n`], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "note"}.md`;
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
    userMenuRef.current?.removeAttribute("open");
    setWorkspaceDraft(workspaceName);
    setWorkspaceError("");
    setRenamingWorkspace(true);
  }

  function cancelWorkspaceRename() {
    setWorkspaceDraft(workspaceName);
    setWorkspaceError("");
    setRenamingWorkspace(false);
  }

  const avatar = userName.trim().charAt(0).toUpperCase() || "E";
  const activeBook = initialWorkspace.books[0];

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-identity">
          <span className="wordmark workspace-wordmark">EpiNote</span>
          <span className="topbar-divider" />
          <button
            className="workspace-name workspace-name-button"
            type="button"
            onClick={beginWorkspaceRename}
            title="Rename workspace"
            aria-label={`Rename workspace ${workspaceName}`}
          >
            <span>{workspaceName}</span>
            <span className="workspace-edit-mark" aria-hidden="true">Rename</span>
          </button>
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
            {saveState}
          </span>
          <details className="user-menu" ref={userMenuRef}>
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
              <button className="account-action" type="button" onClick={beginWorkspaceRename}>
                Rename workspace
              </button>
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
            <span>Books</span>
            <button type="button" aria-label="Create book" title="Books are coming next">+</button>
          </div>
          <div className="book-row"><span>▾</span><strong>{activeBook?.name ?? "Unsorted"}</strong></div>
          <button className="new-note-button" type="button" onClick={createNote} disabled={creating}>
            <span>+</span>{creating ? "Creating…" : "New note"}
          </button>
          <div className="note-list" aria-label="Notes">
            {filteredNotes.map((note) => (
              <button
                className={`note-row ${note.id === selectedId ? "selected" : ""}`}
                type="button"
                key={note.id}
                onClick={() => void chooseNote(note.id)}
              >
                <span className="note-row-title">{note.title || "Untitled note"}</span>
                <span className="note-row-date">
                  {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                    new Date(note.updatedAt),
                  )}
                </span>
              </button>
            ))}
            {filteredNotes.length === 0 && (
              <p className="empty-list">{notes.length ? "No notes match." : "Your first note starts here."}</p>
            )}
          </div>
        </aside>

        <section className="note-panel">
          {selected ? (
            <>
              <div className="note-header">
                <p className="note-path">
                  {initialWorkspace.organization.name} / {activeBook?.name ?? "Unsorted"}
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
                <button type="button" onClick={() => setPreview(false)} className={!preview ? "active" : ""}>Write</button>
                <button type="button" onClick={() => formatSelection("**")} aria-label="Bold"><strong>B</strong></button>
                <button type="button" onClick={() => formatSelection("_")} aria-label="Italic"><em>I</em></button>
                <button type="button" onClick={() => formatSelection("- ", "")} aria-label="List">List</button>
                <span className="format-spacer" />
                <button type="button" onClick={() => setPreview(true)} className={preview ? "active" : ""}>Preview</button>
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
                <button className="button button-secondary button-small" type="button" title="AI review comes after reliable notes" disabled>
                  Review
                </button>
                <div className="note-footer-right">
                  {error && <span className="workspace-error" role="alert">{error}</span>}
                  <button className="button button-secondary button-small" type="button" onClick={exportNote}>Export</button>
                  <button className="button button-small" type="button" onClick={() => void saveNote(selected)} disabled={!dirty || saveState === "Saving…"}>Save</button>
                </div>
              </footer>
            </>
          ) : (
            <div className="empty-editor">
              <p className="eyebrow">Unsorted</p>
              <h1>Begin with a useful note.</h1>
              <p>Capture the thought now. You can organize and connect it later.</p>
              <button className="button" type="button" onClick={createNote}>Create your first note</button>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
          )}
        </section>
      </div>
      {renamingWorkspace && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !workspaceSaving) {
              cancelWorkspaceRename();
            }
          }}
        >
          <section
            className="workspace-rename-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-workspace-title"
            aria-describedby="rename-workspace-description"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !workspaceSaving) cancelWorkspaceRename();
            }}
          >
            <p className="eyebrow">Workspace settings</p>
            <h2 id="rename-workspace-title">Rename workspace</h2>
            <p id="rename-workspace-description">
              The books and notes inside this workspace will not change.
            </p>
            <form className="workspace-rename-form" onSubmit={renameWorkspace}>
              <label htmlFor="workspace-name">Workspace name</label>
              <input
                id="workspace-name"
                value={workspaceDraft}
                onChange={(event) => setWorkspaceDraft(event.target.value)}
                minLength={2}
                maxLength={100}
                autoFocus
                required
              />
              {workspaceError && <span role="alert">{workspaceError}</span>}
              <div>
                <button type="button" onClick={cancelWorkspaceRename} disabled={workspaceSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={workspaceSaving}>
                  {workspaceSaving ? "Saving…" : "Save workspace name"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

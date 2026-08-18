"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FeedbackButton } from "@/components/FeedbackButton";
import { ProductWordmark } from "@/components/ProductWordmark";
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
type AiJobStatus = "queued" | "processing" | "completed" | "failed" | "applied";
type BookCardJobStatus = Exclude<AiJobStatus, "applied">;
type AiJobNotification = {
  id: string;
  type: "organize-note" | "summarize-book-cards";
  noteId: string | null;
  bookId: string;
  title: string;
  noteTitle: string | null;
  bookName: string;
  status: AiJobStatus;
  error: string | null;
  proposalId: string | null;
  createdAt: string;
  updatedAt: string;
};
type BookCardsState = "idle" | "loading" | "ready" | "empty" | "error";
type NoteSummaryState = "idle" | "loading" | "ready" | "empty" | "error";
type NoteSummaryFacets = {
  authors: string[];
  references: string[];
  people: string[];
  topics: string[];
  places: string[];
  dates: string[];
  sources: Array<{ label: string; url: string }>;
};
type SummaryFacetKind = "author" | "source" | "person" | "topic" | "place" | "date";
type BookCardDeck = {
  id: string;
  bookId: string;
  overview: string;
  cards: Array<{
    title: string;
    kind: "overview" | "concept" | "person" | "timeline" | "comparison" | "argument" | "event";
    summary: string;
    points: Array<{ text: string; sourceNoteIds: string[] }>;
  }>;
  sourceNotes: Array<{ id: string; title: string }>;
  model: string;
  generatedAt: string;
  stale: boolean;
};

type UiIconName = "library" | "capture" | "book" | "note" | "edit" | "move" | "trash" | "plus" | "sparkles" | "bell" | "cards";

function UiIcon({ name }: { name: UiIconName }) {
  const paths: Record<UiIconName, React.ReactNode> = {
    library: <><path d="M4 5h16" /><path d="M6 5v14h12V5" /><path d="M9 9v6" /><path d="M15 9v6" /></>,
    capture: <><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M5 19h14" /></>,
    book: <><path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3Z" /><path d="M8 4.5V20" /></>,
    note: <><path d="M6 3.5h8l4 4V20H6Z" /><path d="M14 3.5v4h4" /><path d="M9 12h6" /><path d="M9 16h5" /></>,
    edit: <><path d="m4 20 4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16Z" /><path d="m14.5 6.5 3 3" /></>,
    move: <><path d="M4 12h16" /><path d="m16 8 4 4-4 4" /><path d="M8 8 4 12l4 4" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 3h6l1 4H8Z" /><path d="m6 7 1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3Z" /><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8Z" /><path d="M5 13v4M3 15h4" /></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" /><path d="M10 20h4" /></>,
    cards: <><rect x="4" y="5" width="14" height="15" rx="2" /><path d="M8 2h10a2 2 0 0 1 2 2v12" /><path d="M8 10h6M8 14h4" /></>,
  };

  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

function highlightedSummary(summary: string, facets: NoteSummaryFacets | null): React.ReactNode {
  if (!facets) return summary;
  const terms: Array<{ label: string; kind: SummaryFacetKind }> = [
    ...facets.authors.map((label) => ({ label, kind: "author" as const })),
    ...facets.references.map((label) => ({ label, kind: "source" as const })),
    ...facets.people.map((label) => ({ label, kind: "person" as const })),
    ...facets.topics.map((label) => ({ label, kind: "topic" as const })),
    ...facets.places.map((label) => ({ label, kind: "place" as const })),
    ...facets.dates.map((label) => ({ label, kind: "date" as const })),
  ];
  const byLabel = new Map<string, SummaryFacetKind>();
  for (const term of terms) {
    const key = term.label.toLocaleLowerCase();
    if (!byLabel.has(key)) byLabel.set(key, term.kind);
  }
  const labels = Array.from(byLabel.keys()).sort((left, right) => right.length - left.length);
  if (labels.length === 0) return summary;
  const pattern = new RegExp(
    `(${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})`,
    "giu",
  );
  return summary.split(pattern).map((part, index) => {
    const kind = byLabel.get(part.toLocaleLowerCase());
    return kind
      ? <mark className={`summary-entity ${kind}`} key={`${index}-${part}`}>{part}</mark>
      : part;
  });
}

function SummaryFacetGroup({
  label,
  kind,
  values,
}: {
  label: string;
  kind: SummaryFacetKind;
  values: string[];
}) {
  if (values.length === 0) return null;
  return (
    <div className="summary-facet-group">
      <span>{label}</span>
      <div>{values.map((value) => <span className={`summary-facet ${kind}`} key={value}>{value}</span>)}</div>
    </div>
  );
}

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
  const [renamingBookId, setRenamingBookId] = useState<string | null>(null);
  const [bookRenameDraft, setBookRenameDraft] = useState("");
  const [bookRenameSaving, setBookRenameSaving] = useState(false);
  const [bookRenameError, setBookRenameError] = useState("");
  const [bookActionId, setBookActionId] = useState<string | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropBookId, setDropBookId] = useState<string | null>(null);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);
  const [organizePanelOpen, setOrganizePanelOpen] = useState(false);
  const [organizeState, setOrganizeState] = useState<OrganizeState>("idle");
  const [organizeProposal, setOrganizeProposal] = useState<OrganizeProposal | null>(null);
  const [organizeError, setOrganizeError] = useState("");
  const [aiJobs, setAiJobs] = useState<AiJobNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationSeenAt, setNotificationSeenAt] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = Number(window.localStorage.getItem("epinote:ai-notifications-seen"));
    return Number.isFinite(stored) ? stored : 0;
  });
  const [organizingBookId, setOrganizingBookId] = useState<string | null>(null);
  const [backgroundMessage, setBackgroundMessage] = useState("");
  const [cardsPanelOpen, setCardsPanelOpen] = useState(false);
  const [cardsBookId, setCardsBookId] = useState<string | null>(null);
  const [cardsState, setCardsState] = useState<BookCardsState>("idle");
  const [cardDeck, setCardDeck] = useState<BookCardDeck | null>(null);
  const [cardsError, setCardsError] = useState("");
  const [noteSummaryOpen, setNoteSummaryOpen] = useState(false);
  const [noteSummaryState, setNoteSummaryState] = useState<NoteSummaryState>("idle");
  const [noteSummary, setNoteSummary] = useState("");
  const [noteSummarySource, setNoteSummarySource] = useState<"approved" | "suggested" | null>(null);
  const [noteSummaryError, setNoteSummaryError] = useState("");
  const [noteSummaryFacets, setNoteSummaryFacets] = useState<NoteSummaryFacets | null>(null);
  const [noteSummaryFacetsState, setNoteSummaryFacetsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const notesRef = useRef(notes);
  const savingRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const organizePollRef = useRef<number | null>(null);
  const cardsPollRef = useRef<number | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const loadAiJobs = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/ai/jobs", { cache: "no-store" });
      const data = (await response.json()) as {
        jobs?: AiJobNotification[];
      };
      if (response.ok && data.jobs) setAiJobs(data.jobs);
    } catch {
      // Keep the last known notifications during a temporary connection failure.
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadAiJobs(), 0);
    const interval = window.setInterval(() => void loadAiJobs(), 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [loadAiJobs]);

  useEffect(() => () => {
    if (organizePollRef.current !== null) window.clearTimeout(organizePollRef.current);
    if (cardsPollRef.current !== null) window.clearTimeout(cardsPollRef.current);
  }, []);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes.filter((note) => note.bookId === activeBookId);
    return notes.filter((note) =>
      note.title.toLowerCase().includes(normalized) || note.body.toLowerCase().includes(normalized),
    );
  }, [activeBookId, notes, query]);

  useEffect(() => {
    if (!bookActionId && !noteActionId) return;

    function closeActionMenus(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".book-more-button, .book-actions-menu, .note-more-button, .note-actions-menu")
      ) {
        return;
      }
      setBookActionId(null);
      setNoteActionId(null);
    }

    function closeActionMenusWithKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setBookActionId(null);
      setNoteActionId(null);
    }

    document.addEventListener("pointerdown", closeActionMenus);
    document.addEventListener("keydown", closeActionMenusWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeActionMenus);
      document.removeEventListener("keydown", closeActionMenusWithKeyboard);
    };
  }, [bookActionId, noteActionId]);

  useEffect(() => {
    if (!notificationsOpen) return;
    function closeNotifications(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest(".notification-center")) return;
      setNotificationsOpen(false);
    }
    function closeNotificationsWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationsOpen(false);
    }
    document.addEventListener("pointerdown", closeNotifications);
    document.addEventListener("keydown", closeNotificationsWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeNotifications);
      document.removeEventListener("keydown", closeNotificationsWithKeyboard);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!noteSummaryOpen) return;
    function closeSummary(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest(".note-summary-control")) return;
      setNoteSummaryOpen(false);
    }
    function closeSummaryWithKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setNoteSummaryOpen(false);
    }
    document.addEventListener("pointerdown", closeSummary);
    document.addEventListener("keydown", closeSummaryWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeSummary);
      document.removeEventListener("keydown", closeSummaryWithKeyboard);
    };
  }, [noteSummaryOpen]);

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

  const saveNote = useCallback(async (note: Note): Promise<number | null> => {
    if (savingRef.current) return null;
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
        return null;
      }

      const latest = notesRef.current.find((item) => item.id === note.id);
      const unchangedSinceRequest =
        latest?.title === note.title && latest?.body === note.body;

      setNotes((current) => {
        const next = current.map((item) =>
          item.id === note.id
            ? { ...item, revision: data.note!.revision, updatedAt: data.note!.updatedAt }
            : item,
        );
        notesRef.current = next;
        return next;
      });

      if (unchangedSinceRequest) {
        window.localStorage.removeItem(`epinote:draft:${note.id}`);
        setDirty(false);
        setSaveState("Saved");
      } else {
        setSaveState("Unsaved changes");
      }
      return data.note.revision;
    } catch {
      setError("EpiNote is unreachable. Your draft is still in this browser.");
      setSaveState("Save failed");
      return null;
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
    if (noteSummaryOpen) closeNoteSummary();
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
    if (noteId === selectedId) {
      if (cardsPanelOpen) closeCardsPanel();
      if (noteSummaryOpen) closeNoteSummary();
      return;
    }
    if (dirty && selected && !(await saveNote(selected))) return;
    const nextNote = notesRef.current.find((note) => note.id === noteId);
    if (nextNote) setActiveBookId(nextNote.bookId);
    setSelectedId(noteId);
    setDirty(false);
    setError("");
    setPreview(false);
    closeOrganizePanel();
    closeCardsPanel();
    closeNoteSummary();
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
      closeCardsPanel();
      closeNoteSummary();
      window.setTimeout(() => editorRef.current?.focus(), 0);
    } catch {
      setError("EpiNote is unreachable. Try again when your connection returns.");
    } finally {
      setCreating(false);
    }
  }

  async function chooseBook(bookId: string) {
    closeBookCreator();
    setBookActionId(null);
    if (bookId === activeBookId) {
      if (cardsPanelOpen) closeCardsPanel();
      if (noteSummaryOpen) closeNoteSummary();
      return;
    }
    if (dirty && selected && !(await saveNote(selected))) return;
    closeCardsPanel();
    closeNoteSummary();
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

  function beginBookRename(book: WorkspacePayload["books"][number]) {
    if (book.systemKey === "unsorted" || bookRenameSaving) return;
    setBookActionId(null);
    closeBookCreator();
    setBookRenameDraft(book.name);
    setBookRenameError("");
    setRenamingBookId(book.id);
  }

  function cancelBookRename() {
    if (bookRenameSaving) return;
    setRenamingBookId(null);
    setBookRenameDraft("");
    setBookRenameError("");
  }

  async function renameBook(
    event: React.FormEvent<HTMLFormElement>,
    book: WorkspacePayload["books"][number],
  ) {
    event.preventDefault();
    const name = bookRenameDraft.trim();
    if (!name || name.length > 100 || bookRenameSaving) return;
    if (name === book.name) {
      cancelBookRename();
      return;
    }

    setBookRenameSaving(true);
    setBookRenameError("");
    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        error?: string;
        book?: { id: string; name: string };
      };
      if (!response.ok || !data.book) {
        setBookRenameError(data.error || "Unable to rename this book.");
        return;
      }

      setBooks((current) =>
        current.map((item) =>
          item.id === data.book!.id ? { ...item, name: data.book!.name } : item,
        ),
      );
      setRenamingBookId(null);
      setBookRenameDraft("");
    } catch {
      setBookRenameError("EpiNote is unreachable. The book was not renamed.");
    } finally {
      setBookRenameSaving(false);
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

  async function moveNote(noteId: string, targetBookId: string) {
    const note = notesRef.current.find((item) => item.id === noteId);
    if (!note || note.bookId === targetBookId || movingNoteId) {
      setDraggedNoteId(null);
      setDropBookId(null);
      return;
    }

    setMovingNoteId(noteId);
    setNoteActionId(null);
    setError("");
    try {
      let expectedRevision = note.revision;
      if (note.id === selectedId && dirty) {
        const savedRevision = await saveNote(note);
        if (!savedRevision) {
          if (savingRef.current) {
            setError("Wait for the current save to finish, then move the note.");
          }
          return;
        }
        expectedRevision = savedRevision;
      }

      const response = await fetch(`/api/notes/${note.id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: targetBookId, expectedRevision }),
      });
      const data = (await response.json()) as {
        error?: string;
        note?: { id: string; bookId: string; revision: number; updatedAt: string };
      };
      if (!response.ok || !data.note) {
        setError(data.error || "Unable to move this note.");
        return;
      }

      setNotes((current) => {
        const next = current.map((item) =>
          item.id === data.note!.id
            ? {
                ...item,
                bookId: data.note!.bookId,
                revision: data.note!.revision,
                updatedAt: data.note!.updatedAt,
              }
            : item,
        );
        notesRef.current = next;
        return next;
      });
      setBooks((current) =>
        current.map((book) => {
          if (book.id === note.bookId) {
            return { ...book, noteCount: Math.max(0, book.noteCount - 1) };
          }
          if (book.id === data.note!.bookId) {
            return { ...book, noteCount: book.noteCount + 1 };
          }
          return book;
        }),
      );
      if (note.id === selectedId) {
        setActiveBookId(data.note.bookId);
        setQuery("");
        setDirty(false);
        setSaveState("Saved");
        closeOrganizePanel();
      }
    } catch {
      setError("EpiNote is unreachable. The note was not moved.");
    } finally {
      setMovingNoteId(null);
      setDraggedNoteId(null);
      setDropBookId(null);
    }
  }

  async function deleteBook(book: WorkspacePayload["books"][number]) {
    setBookActionId(null);
    if (book.systemKey === "unsorted") return;
    if (book.noteCount > 0) {
      setError("Move or delete every note before deleting this book.");
      return;
    }
    if (!window.confirm(`Delete the empty book “${book.name}”?`)) return;

    setDeletingBookId(book.id);
    setError("");
    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok || !data.ok) {
        setError(data.error || "Unable to delete this book.");
        return;
      }

      const remaining = books.filter((item) => item.id !== book.id);
      setBooks(remaining);
      if (activeBookId === book.id) {
        const fallback = remaining.find((item) => item.systemKey === "unsorted") ?? remaining[0];
        setActiveBookId(fallback?.id ?? null);
        setSelectedId(
          fallback
            ? notesRef.current.find((item) => item.bookId === fallback.id)?.id ?? null
            : null,
        );
        setDirty(false);
        setSaveState("Saved");
        setPreview(false);
        closeOrganizePanel();
      }
    } catch {
      setError("EpiNote is unreachable. The book was not deleted.");
    } finally {
      setDeletingBookId(null);
    }
  }

  function closeOrganizePanel() {
    if (organizePollRef.current !== null) {
      window.clearTimeout(organizePollRef.current);
      organizePollRef.current = null;
    }
    setOrganizePanelOpen(false);
    setOrganizeState("idle");
    setOrganizeProposal(null);
    setOrganizeError("");
  }

  function scheduleOrganizePoll(noteId: string) {
    if (organizePollRef.current !== null) window.clearTimeout(organizePollRef.current);
    organizePollRef.current = window.setTimeout(() => void pollOrganization(noteId), 2_500);
  }

  async function pollOrganization(noteId: string) {
    try {
      const response = await fetch(`/api/notes/${noteId}/organize`, { cache: "no-store" });
      const data = (await response.json()) as {
        error?: string;
        proposal?: OrganizeProposal;
        job?: { status: AiJobStatus; error: string | null } | null;
      };
      if (data.proposal) {
        setOrganizeProposal(data.proposal);
        setOrganizeState("ready");
        organizePollRef.current = null;
        void loadAiJobs();
        return;
      }
      if (!response.ok || data.job?.status === "failed") {
        setOrganizeError(data.error || data.job?.error || "Unable to organize this note.");
        setOrganizeState("error");
        organizePollRef.current = null;
        void loadAiJobs();
        return;
      }
      if (data.job === null) {
        setOrganizeError("This note changed after the background job started. Organize it again.");
        setOrganizeState("error");
        organizePollRef.current = null;
        return;
      }
      scheduleOrganizePoll(noteId);
    } catch {
      scheduleOrganizePoll(noteId);
    }
  }

  async function organizeNote() {
    if (!selected || organizeState === "loading" || organizeState === "applying") return;
    if (!selected.body.trim()) {
      setError("Add some text before organizing this note.");
      return;
    }
    if (dirty && !(await saveNote(selected))) return;
    closeNoteSummary();

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
        job?: { status: AiJobStatus; error: string | null };
      };
      if (!response.ok) {
        setOrganizeError(data.error || "Unable to organize this note.");
        setOrganizeState("error");
        return;
      }
      if (data.proposal) {
        setOrganizeProposal(data.proposal);
        setOrganizeState("ready");
      } else if (data.job) {
        scheduleOrganizePoll(selected.id);
        void loadAiJobs();
      } else {
        setOrganizeError("Unable to start organization for this note.");
        setOrganizeState("error");
      }
    } catch {
      setOrganizeError("EpiNote cannot reach the AI service right now.");
      setOrganizeState("error");
    }
  }

  async function organizeBook(book: WorkspacePayload["books"][number]) {
    if (organizingBookId || book.noteCount === 0) return;
    if (dirty && selected && !(await saveNote(selected))) return;
    setBookActionId(null);
    setOrganizingBookId(book.id);
    setBackgroundMessage("");
    setError("");
    try {
      const response = await fetch(`/api/books/${book.id}/organize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as {
        error?: string;
        organization?: { total: number; ready: number; background: number; skipped: number };
      };
      if (!response.ok || !data.organization) {
        setError(data.error || "Unable to organize this book.");
        return;
      }
      setBackgroundMessage(
        data.organization.background > 0
          ? `Organizing ${data.organization.background} notes from ${book.name} and building summary cards in the background${data.organization.skipped ? `; ${data.organization.skipped} could not be queued` : ""}.`
          : `${data.organization.ready} notes from ${book.name} are ready; summary cards are being prepared.`,
      );
      setNotificationsOpen(true);
      void loadAiJobs();
    } catch {
      setError("EpiNote is unreachable. Book organization was not started.");
    } finally {
      setOrganizingBookId(null);
    }
  }

  function closeNoteSummary() {
    setNoteSummaryOpen(false);
    setNoteSummaryState("idle");
    setNoteSummary("");
    setNoteSummarySource(null);
    setNoteSummaryError("");
    setNoteSummaryFacets(null);
    setNoteSummaryFacetsState("idle");
  }

  async function enrichNoteSummary(noteId: string) {
    setNoteSummaryFacetsState("loading");
    try {
      const response = await fetch(`/api/notes/${noteId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as { error?: string; facets?: NoteSummaryFacets };
      if (!response.ok || !data.facets) {
        setNoteSummaryFacetsState("error");
        return;
      }
      setNoteSummaryFacets(data.facets);
      setNoteSummaryFacetsState("ready");
    } catch {
      setNoteSummaryFacetsState("error");
    }
  }

  async function toggleNoteSummary() {
    if (noteSummaryOpen) {
      closeNoteSummary();
      return;
    }
    if (!selected) return;
    if (dirty && !(await saveNote(selected))) return;

    setNoteSummaryOpen(true);
    setNoteSummaryState("loading");
    setNoteSummary("");
    setNoteSummarySource(null);
    setNoteSummaryError("");
    setNoteSummaryFacets(null);
    setNoteSummaryFacetsState("idle");
    try {
      const response = await fetch(`/api/notes/${selected.id}/summary`, { cache: "no-store" });
      const data = (await response.json()) as {
        error?: string;
        summary?: string | null;
        source?: "approved" | "suggested" | null;
        facets?: NoteSummaryFacets | null;
        profiled?: boolean;
      };
      if (!response.ok) {
        setNoteSummaryError(data.error || "Unable to load this summary.");
        setNoteSummaryState("error");
        return;
      }
      if (!data.summary) {
        setNoteSummaryState("empty");
        return;
      }
      setNoteSummary(data.summary);
      setNoteSummarySource(data.source ?? null);
      setNoteSummaryFacets(data.facets ?? null);
      setNoteSummaryFacetsState(data.profiled ? "ready" : "loading");
      setNoteSummaryState("ready");
      if (!data.profiled) void enrichNoteSummary(selected.id);
    } catch {
      setNoteSummaryError("EpiNote cannot load this summary right now.");
      setNoteSummaryState("error");
    }
  }

  function closeCardsPanel() {
    if (cardsPollRef.current !== null) {
      window.clearTimeout(cardsPollRef.current);
      cardsPollRef.current = null;
    }
    setCardsPanelOpen(false);
    setCardsState("idle");
    setCardDeck(null);
    setCardsError("");
    setCardsBookId(null);
  }

  function scheduleCardsPoll(bookId: string) {
    if (cardsPollRef.current !== null) window.clearTimeout(cardsPollRef.current);
    cardsPollRef.current = window.setTimeout(() => void loadBookCards(bookId), 2_500);
  }

  async function loadBookCards(bookId: string) {
    try {
      const response = await fetch(`/api/books/${bookId}/cards`, { cache: "no-store" });
      const data = (await response.json()) as {
        error?: string;
        deck?: BookCardDeck | null;
        job?: { status: BookCardJobStatus; error: string | null } | null;
      };
      if (data.deck) {
        setCardDeck(data.deck);
        setCardsState("ready");
      }
      if (!response.ok && response.status !== 202) {
        setCardsError(data.error || data.job?.error || "Unable to load summary cards.");
        setCardsState(data.deck ? "ready" : "error");
        cardsPollRef.current = null;
        return;
      }
      if (data.job?.status === "failed") {
        setCardsError(data.job.error || "Summary card generation failed.");
        setCardsState(data.deck ? "ready" : "error");
        cardsPollRef.current = null;
        void loadAiJobs();
        return;
      }
      if (data.job?.status === "queued" || data.job?.status === "processing") {
        if (!data.deck) setCardsState("loading");
        scheduleCardsPoll(bookId);
        return;
      }
      cardsPollRef.current = null;
      if (!data.deck) setCardsState("empty");
      void loadAiJobs();
    } catch {
      scheduleCardsPoll(bookId);
    }
  }

  async function openBookCards(book: WorkspacePayload["books"][number]) {
    if (dirty && selected && !(await saveNote(selected))) return;
    setBookActionId(null);
    closeOrganizePanel();
    closeNoteSummary();
    setCardsPanelOpen(true);
    setCardsBookId(book.id);
    setCardsState("loading");
    setCardDeck(null);
    setCardsError("");
    await loadBookCards(book.id);
  }

  async function generateBookCards(bookId: string) {
    setCardsState("loading");
    setCardsError("");
    try {
      const response = await fetch(`/api/books/${bookId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as {
        error?: string;
        deck?: BookCardDeck | null;
        job?: { status: BookCardJobStatus; error: string | null } | null;
      };
      if (!response.ok && response.status !== 202) {
        setCardsError(data.error || "Unable to generate summary cards.");
        setCardsState("error");
        return;
      }
      if (data.deck) {
        setCardDeck(data.deck);
        setCardsState("ready");
        return;
      }
      setBackgroundMessage("Summary cards are being generated in the background.");
      void loadAiJobs();
      scheduleCardsPoll(bookId);
    } catch {
      setCardsError("EpiNote cannot reach the AI service right now.");
      setCardsState("error");
    }
  }

  async function openCardSource(noteId: string) {
    const note = notesRef.current.find((item) => item.id === noteId);
    if (!note) return;
    if (dirty && selected && !(await saveNote(selected))) return;
    closeCardsPanel();
    setActiveBookId(note.bookId);
    setSelectedId(note.id);
    setDirty(false);
    setPreview(true);
    setError("");
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
  const cardsBook = books.find((book) => book.id === cardsBookId) ?? null;
  const activeAiJobCount = aiJobs.filter(
    (job) => job.status === "queued" || job.status === "processing",
  ).length;
  const unreadAiJobCount = aiJobs.filter(
    (job) =>
      (job.status === "completed" || job.status === "failed") &&
      new Date(job.updatedAt).getTime() > notificationSeenAt,
  ).length;
  const notificationBadgeCount = activeAiJobCount + unreadAiJobCount;

  function toggleNotifications() {
    setNotificationsOpen((current) => {
      const next = !current;
      if (next) {
        const seenAt = Date.now();
        setNotificationSeenAt(seenAt);
        window.localStorage.setItem("epinote:ai-notifications-seen", String(seenAt));
      }
      return next;
    });
  }

  async function openAiNotification(job: AiJobNotification) {
    if (job.type === "summarize-book-cards") {
      const book = books.find((item) => item.id === job.bookId);
      if (book) {
        setNotificationsOpen(false);
        await openBookCards(book);
      }
      return;
    }
    if (!job.noteId) return;
    const note = notesRef.current.find((item) => item.id === job.noteId);
    if (!note) return;
    if (dirty && selected && !(await saveNote(selected))) return;
    setNotificationsOpen(false);
    setActiveBookId(note.bookId);
    setSelectedId(note.id);
    setDirty(false);
    setError("");
    setPreview(false);
    if (job.status === "applied") return;
    setOrganizePanelOpen(true);
    setOrganizeProposal(null);
    setOrganizeError("");
    setOrganizeState("loading");
    await pollOrganization(note.id);
  }

  function bookCardTreeState(bookId: string): {
    label: string;
    state: "idle" | "queued" | "processing" | "ready" | "failed";
  } {
    if (cardsBookId === bookId && cardDeck) {
      return { label: `${cardDeck.cards.length} cards`, state: "ready" };
    }
    const job = aiJobs.find(
      (candidate) => candidate.type === "summarize-book-cards" && candidate.bookId === bookId,
    );
    if (!job) return { label: "Quick reference", state: "idle" };
    if (job.status === "completed") return { label: "Ready", state: "ready" };
    if (job.status === "processing") return { label: "Generating…", state: "processing" };
    if (job.status === "queued") return { label: "Waiting…", state: "queued" };
    if (job.status === "failed") return { label: "Try again", state: "failed" };
    return { label: "Ready", state: "ready" };
  }

  function renderNoteRow(note: Note) {
    return (
      <div
        className={`note-row ${note.id === selectedId ? "selected" : ""} ${draggedNoteId === note.id ? "dragging" : ""} ${movingNoteId === note.id ? "moving" : ""}`}
        key={note.id}
        draggable={renamingNoteId !== note.id && movingNoteId !== note.id}
        aria-grabbed={draggedNoteId === note.id}
        onDragStart={(event) => {
          if (renamingNoteId === note.id || movingNoteId === note.id) {
            event.preventDefault();
            return;
          }
          setNoteActionId(null);
          setDraggedNoteId(note.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", note.id);
        }}
        onDragEnd={() => {
          setDraggedNoteId(null);
          setDropBookId(null);
        }}
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
            <UiIcon name="note" />
            <span className="note-row-copy">
              <span className="note-row-title">{note.title || "Untitled note"}</span>
              <span className="note-row-date">
                {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                  new Date(note.updatedAt),
                )}
              </span>
            </span>
          </button>
        )}
        <button
          className="note-more-button"
          type="button"
          aria-label={`Actions for ${note.title || "Untitled note"}`}
          aria-expanded={noteActionId === note.id}
          onClick={() => {
            setBookActionId(null);
            setNoteActionId((current) => (current === note.id ? null : note.id));
          }}
          disabled={deletingNoteId === note.id || movingNoteId === note.id}
        >
          {deletingNoteId === note.id || movingNoteId === note.id ? "…" : "•••"}
        </button>
        {noteActionId === note.id && (
          <div className="note-actions-menu">
            <div className="action-menu-context">
              <UiIcon name="note" />
              <span><small>Note</small><strong>{note.title || "Untitled note"}</strong></span>
            </div>
            <button type="button" onClick={() => void beginNoteRename(note)}>
              <UiIcon name="edit" /> Rename
            </button>
            <label className="note-move-control">
              <span className="action-menu-label"><UiIcon name="move" /> Move to</span>
              <select
                value=""
                aria-label={`Move ${note.title || "Untitled note"} to another book`}
                onChange={(event) => {
                  const targetBookId = event.target.value;
                  if (targetBookId) void moveNote(note.id, targetBookId);
                }}
              >
                <option value="" disabled>Choose a book…</option>
                {books
                  .filter((book) => book.id !== note.bookId)
                  .map((book) => <option value={book.id} key={book.id}>{book.name}</option>)}
              </select>
            </label>
            <button className="danger" type="button" onClick={() => void deleteNote(note)}>
              <UiIcon name="trash" /> Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-identity">
          <ProductWordmark className="workspace-wordmark" />
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
          <FeedbackButton />
          <div className="notification-center">
            <button
              className="notification-bell"
              type="button"
              aria-label={`AI notifications${notificationBadgeCount ? `, ${notificationBadgeCount} new or active` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={toggleNotifications}
            >
              <UiIcon name="bell" />
              {notificationBadgeCount > 0 && (
                <span className="notification-badge">
                  {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="notification-popover" aria-label="AI notifications">
                <header>
                  <div>
                    <p className="account-label">Background intelligence</p>
                    <strong>Notifications</strong>
                  </div>
                  {activeAiJobCount > 0 && <span>{activeAiJobCount} working</span>}
                </header>
                {backgroundMessage && <p className="notification-message">{backgroundMessage}</p>}
                <div className="notification-list">
                  {aiJobs.length === 0 ? (
                    <p className="notification-empty">No AI work yet.</p>
                  ) : (
                    aiJobs.map((job) => (
                      <button
                        className={`notification-item ${job.status}`}
                        type="button"
                        key={job.id}
                        onClick={() => void openAiNotification(job)}
                      >
                        <span className="notification-status" aria-hidden="true" />
                        <span>
                          <strong>{job.title}</strong>
                          <small>{job.bookName}</small>
                          <em>
                            {job.status === "completed"
                              ? job.type === "summarize-book-cards"
                                ? "Summary cards ready"
                                : "Ready to review"
                              : job.status === "applied"
                                ? "Organization applied"
                              : job.status === "failed"
                                ? job.error || (job.type === "summarize-book-cards" ? "Card generation failed" : "Organization failed")
                                : job.status === "processing"
                                  ? job.type === "summarize-book-cards"
                                    ? "Building cards in background"
                                    : "Organizing in background"
                                  : job.type === "summarize-book-cards"
                                    ? "Waiting to build cards"
                                    : "Waiting to organize"}
                          </em>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
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
            <span className="sidebar-heading-label"><UiIcon name="library" /> Library</span>
            <button
              type="button"
              aria-label={addingBook ? "Cancel new book" : "Create book"}
              aria-expanded={addingBook}
              title={addingBook ? "Cancel new book" : "Create book"}
              onClick={toggleBookCreator}
            >{addingBook ? "×" : <UiIcon name="plus" />}</button>
          </div>
          <div className="book-list" aria-label="Library">
            {books.map((book) =>
              renamingBookId === book.id ? (
                <form
                  className="book-inline-rename"
                  key={book.id}
                  onSubmit={(event) => void renameBook(event, book)}
                >
                  <input
                    value={bookRenameDraft}
                    onChange={(event) => setBookRenameDraft(event.target.value)}
                    onBlur={(event) => event.currentTarget.form?.requestSubmit()}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelBookRename();
                      }
                    }}
                    aria-label="Book name"
                    maxLength={100}
                    autoFocus
                    disabled={bookRenameSaving}
                    required
                  />
                  {bookRenameError && <span role="alert">{bookRenameError}</span>}
                </form>
              ) : (
                <div
                  className={`book-row-shell ${dropBookId === book.id ? "drop-target" : ""}`}
                  key={book.id}
                  onDragEnter={(event) => {
                    const dragged = notesRef.current.find((note) => note.id === draggedNoteId);
                    if (!dragged || dragged.bookId === book.id) return;
                    event.preventDefault();
                    setDropBookId(book.id);
                  }}
                  onDragOver={(event) => {
                    const dragged = notesRef.current.find((note) => note.id === draggedNoteId);
                    if (!dragged || dragged.bookId === book.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDropBookId((current) => (current === book.id ? null : current));
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const noteId = event.dataTransfer.getData("text/plain") || draggedNoteId;
                    if (noteId) void moveNote(noteId, book.id);
                  }}
                >
                  <button
                    className={`book-row ${book.id === activeBookId ? "selected" : ""}`}
                    type="button"
                    onClick={() => void chooseBook(book.id)}
                    onDoubleClick={() => beginBookRename(book)}
                    onKeyDown={(event) => {
                      if (event.key === "F2") beginBookRename(book);
                    }}
                    title={book.systemKey === "unsorted" ? "Default place for quick captures" : "Double-click to rename"}
                  >
                    <span aria-hidden="true">{book.id === activeBookId ? "▾" : "›"}</span>
                    <UiIcon name={book.systemKey === "unsorted" ? "capture" : "book"} />
                    <strong>{book.name}</strong>
                    <span className="book-note-count" aria-label={`${book.noteCount} notes`}>
                      {book.noteCount}
                    </span>
                  </button>
                  {book.systemKey !== "unsorted" && (
                    <button
                      className="book-more-button"
                      type="button"
                      aria-label={`Actions for ${book.name}`}
                      aria-expanded={bookActionId === book.id}
                      onClick={() => {
                        setNoteActionId(null);
                        setBookActionId((current) => current === book.id ? null : book.id);
                      }}
                      disabled={deletingBookId === book.id}
                    >
                      {deletingBookId === book.id ? "…" : "•••"}
                    </button>
                  )}
                  {bookActionId === book.id && (
                    <div className="book-actions-menu">
                      <div className="action-menu-context">
                        <UiIcon name="book" />
                        <span><small>Book</small><strong>{book.name}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void organizeBook(book)}
                        disabled={book.noteCount === 0 || organizingBookId !== null}
                        title={book.noteCount === 0 ? "Add text to a note first" : "Organize every note in the background"}
                      >
                        <UiIcon name="sparkles" />
                        {organizingBookId === book.id ? "Starting…" : "Organize notes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openBookCards(book)}
                        disabled={book.noteCount === 0}
                        title={book.noteCount === 0 ? "Add text to a note first" : "Open this book's quick-reference cards"}
                      >
                        <UiIcon name="cards" /> Summary cards
                      </button>
                      <button type="button" onClick={() => beginBookRename(book)}>
                        <UiIcon name="edit" /> Rename
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => void deleteBook(book)}
                        disabled={book.noteCount > 0}
                        title={book.noteCount > 0 ? "Move or delete every note first" : "Delete empty book"}
                      >
                        <UiIcon name="trash" /> Delete
                      </button>
                      {book.noteCount > 0 && <p>Move or delete its notes before deleting this book.</p>}
                    </div>
                  )}
                  {book.id === activeBookId && !query.trim() && (
                    <div className="book-children" aria-label={`${book.name} notes`}>
                      <button
                        className={`book-summary-row ${cardsPanelOpen && cardsBookId === book.id ? "selected" : ""} ${bookCardTreeState(book.id).state}`}
                        type="button"
                        onClick={() => void openBookCards(book)}
                        disabled={book.noteCount === 0}
                        title={book.noteCount === 0 ? "Add notes to create a summary" : `Open ${book.name} summary cards`}
                      >
                        <span className="book-summary-icon"><UiIcon name="cards" /></span>
                        <span className="book-summary-copy">
                          <strong>Summary Cards</strong>
                          <small>{book.noteCount === 0 ? "Add notes first" : bookCardTreeState(book.id).label}</small>
                        </span>
                        <span className="book-summary-ai">AI</span>
                      </button>
                      {filteredNotes.map(renderNoteRow)}
                      {filteredNotes.length === 0 && (
                        <p className="empty-tree-list">No notes here yet.</p>
                      )}
                      <button
                        className="new-note-tree-button"
                        type="button"
                        onClick={createNote}
                        disabled={creating}
                      >
                        <UiIcon name="plus" />{creating ? "Creating…" : "New note"}
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
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
            {query.trim() && (
              <div className="search-results" aria-label="Search results">
                <p>{filteredNotes.length} {filteredNotes.length === 1 ? "result" : "results"}</p>
                {filteredNotes.map(renderNoteRow)}
                {filteredNotes.length === 0 && <p className="empty-tree-list">No notes match.</p>}
              </div>
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
                <div className="note-summary-control">
                  <button
                    type="button"
                    className={noteSummaryOpen ? "active" : ""}
                    aria-expanded={noteSummaryOpen}
                    onClick={() => void toggleNoteSummary()}
                  >
                    Summary
                  </button>
                  {noteSummaryOpen && (
                    <aside className="note-summary-popover" aria-label="Note summary">
                      <header>
                        <span>
                          <small>Quick reference</small>
                          <strong>Note summary</strong>
                        </span>
                        <button type="button" onClick={closeNoteSummary} aria-label="Close note summary">×</button>
                      </header>
                      {noteSummaryState === "loading" && (
                        <p className="note-summary-message" role="status">Loading summary…</p>
                      )}
                      {noteSummaryState === "empty" && (
                        <p className="note-summary-message">Organize this note to create its summary.</p>
                      )}
                      {noteSummaryState === "error" && (
                        <p className="note-summary-message error" role="alert">{noteSummaryError}</p>
                      )}
                      {noteSummaryState === "ready" && (
                        <div className={`note-summary-content ${noteSummarySource === "approved" ? "approved" : "suggested"}`}>
                          <p>{highlightedSummary(noteSummary, noteSummaryFacets)}</p>
                          <span className="note-summary-source-label">
                            {noteSummarySource === "approved" ? "Applied summary" : "AI suggestion"}
                          </span>
                          {noteSummaryFacetsState === "loading" && (
                            <p className="summary-profile-status" role="status">Finding people, topics, and sources…</p>
                          )}
                          {noteSummaryFacetsState === "error" && (
                            <p className="summary-profile-status">Context labels are unavailable right now.</p>
                          )}
                          {noteSummaryFacets && (
                            <div className="summary-profile">
                              <SummaryFacetGroup label="Authors" kind="author" values={noteSummaryFacets.authors} />
                              <SummaryFacetGroup label="Sources" kind="source" values={noteSummaryFacets.references} />
                              <SummaryFacetGroup label="People" kind="person" values={noteSummaryFacets.people} />
                              <SummaryFacetGroup label="Topics" kind="topic" values={noteSummaryFacets.topics} />
                              <SummaryFacetGroup label="Places" kind="place" values={noteSummaryFacets.places} />
                              <SummaryFacetGroup label="Dates" kind="date" values={noteSummaryFacets.dates} />
                              {noteSummaryFacets.sources.length > 0 && (
                                <div className="summary-facet-group">
                                  <span>Links</span>
                                  <div>
                                    {noteSummaryFacets.sources.map((source) => (
                                      <a
                                        className="summary-facet link"
                                        href={source.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        key={source.url}
                                      >
                                        {source.label} ↗
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </aside>
                  )}
                </div>
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
                      <strong>Organizing in the background…</strong>
                      <span>You can close this panel and keep working. The bell will notify you when the proposal is ready.</span>
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
          {cardsPanelOpen && cardsBook && (
            <aside className="cards-panel" aria-label={`${cardsBook.name} summary cards`}>
              <header className="cards-panel-header">
                <div>
                  <p className="eyebrow">Quick reference</p>
                  <h2>{cardsBook.name}</h2>
                  <span>Summary cards</span>
                </div>
                <button type="button" onClick={closeCardsPanel} aria-label="Close summary cards">×</button>
              </header>
              <p className="cards-safety">
                Generated from this book’s notes. Use the source links to verify important details.
              </p>
              {cardsState === "loading" && !cardDeck && (
                <div className="cards-panel-state" role="status">
                  <UiIcon name="cards" />
                  <strong>Building a quick-reference deck…</strong>
                  <span>You can close this view and keep writing. The bell will notify you when the cards are ready.</span>
                </div>
              )}
              {cardsState === "empty" && (
                <div className="cards-panel-state">
                  <UiIcon name="cards" />
                  <strong>No summary cards yet</strong>
                  <span>Generate a concise study deck from the notes in {cardsBook.name}.</span>
                  <button className="button button-small" type="button" onClick={() => void generateBookCards(cardsBook.id)}>
                    Generate cards
                  </button>
                </div>
              )}
              {cardsState === "error" && !cardDeck && (
                <div className="cards-panel-state cards-panel-error" role="alert">
                  <UiIcon name="cards" />
                  <strong>Cards could not be generated</strong>
                  <span>{cardsError}</span>
                  <button className="button button-secondary button-small" type="button" onClick={() => void generateBookCards(cardsBook.id)}>
                    Try again
                  </button>
                </div>
              )}
              {cardDeck && (
                <div className="cards-deck">
                  {(cardDeck.stale || cardsError) && (
                    <div className="cards-notice" role={cardsError ? "alert" : "status"}>
                      <span>{cardsError || "These cards are from an earlier version of this book."}</span>
                      <button type="button" onClick={() => void generateBookCards(cardsBook.id)}>
                        Refresh
                      </button>
                    </div>
                  )}
                  <div className="cards-overview">
                    <span>{cardDeck.cards.length} cards · {cardDeck.sourceNotes.length} source notes</span>
                    <p>{cardDeck.overview}</p>
                  </div>
                  <div className="summary-card-grid">
                    {cardDeck.cards.map((card, cardIndex) => (
                      <article className={`summary-card summary-card-${card.kind}`} key={card.title}>
                        <div className="summary-card-topline">
                          <p className="summary-card-kind">{card.kind}</p>
                          <span>{String(cardIndex + 1).padStart(2, "0")}</span>
                        </div>
                        <h3>{card.title}</h3>
                        <p className="summary-card-summary">{card.summary}</p>
                        <ul>
                          {card.points.map((point, pointIndex) => (
                            <li key={`${card.title}-${pointIndex}`}>
                              <span>{point.text}</span>
                              <span className="summary-card-sources">
                                {point.sourceNoteIds.map((noteId) => {
                                  const source = cardDeck.sourceNotes.find((note) => note.id === noteId);
                                  return source ? (
                                    <button
                                      type="button"
                                      key={noteId}
                                      onClick={() => void openCardSource(noteId)}
                                      title={`Open source note: ${source.title}`}
                                    >
                                      {source.title}
                                    </button>
                                  ) : null;
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                  <footer className="cards-deck-footer">
                    <span>AI study aid · Check the linked notes for context</span>
                    <button className="button button-secondary button-small" type="button" onClick={() => void generateBookCards(cardsBook.id)}>
                      Refresh cards
                    </button>
                  </footer>
                </div>
              )}
            </aside>
          )}
        </section>
      </div>
    </main>
  );
}

# EpiNote intelligence roadmap

Status: first Book Concepts vertical slice deployed; later features remain planned
Last updated: 2026-08-20

This plan turns EpiNote from a place that stores notes into a system that helps a
user understand a growing body of knowledge. It deliberately builds on the
existing hierarchy:

```text
Organization
└── Workspace
    └── Book
        └── Note
            ├── Content blocks
            ├── Images and attachments
            ├── AI metadata
            └── Linked concepts
```

The Note remains the source of truth. Book intelligence is derived, cited, and
refreshable. AI never silently rewrites a note, moves it, or adds external
research to it.

## 1. Product outcome

The target workflow is:

```text
Capture notes
  -> understand each note
  -> see the book's concepts, people, sources, and timeline
  -> ask questions across the book
  -> identify gaps and research them
  -> approve useful findings into new or existing notes
  -> retain citations back to the original evidence
```

This is not an AI dashboard. Intelligence appears inside the active Book and
Note where it is useful.

## 2. Existing foundation to reuse

EpiNote already has:

- canonical saved Notes with revisions and content hashes;
- explicit user-approved note organization;
- durable MongoDB-backed AI jobs and UI notifications;
- immutable, source-hashed Book Summary Card decks;
- note summaries with grounded people, authors, works, topics, places, dates,
  and validated source links;
- reserved `concepts` and `noteConceptLinks` storage contracts;
- a proven audio-only batch POC with timestamped evidence validation.

New features should extend those patterns rather than introduce another queue,
agent service, graph database, or vector database.

## 3. Intelligence rules

All intelligence features follow these rules:

1. Save user content before analysis starts.
2. Treat notes, webpages, transcripts, and model output as untrusted data, never
   as instructions.
3. Record the exact Note revision and content hash used by every result.
4. Require every derived claim, relationship, or answer to cite accessible
   evidence.
5. Validate model output against strict server-side schemas.
6. Mark results stale when source Notes change.
7. Distinguish `suggested`, `accepted`, and `user-created` information.
8. Let users rename, merge, accept, reject, and refresh AI proposals.
9. Keep provider, model, prompt version, latency, and cost for each job.
10. AI failure must never block ordinary writing, saving, search, or export.

## 4. Feature 1: Book Concepts

This is the recommended next vertical slice.

### Shipped first slice (2026-08-20)

The first useful slice is live on the development/test deployment. Each Book has
an evidence-first `Concepts` entry. A user can generate or refresh a compact map
as a background job, see differently colored ideas, people, organizations,
places, works, and events, inspect explicit relationships, and open every cited
source Note. Results are immutable snapshots keyed by the Book's current Note
revisions/content hashes and visibly become stale after the Book changes.

This slice intentionally uses one bounded Book prompt and a simple card/index
view. It rejects unknown Note IDs, unsupported relationship kinds,
self-relations, duplicate concepts/relations, and relationships whose cited
Notes do not support both endpoint concepts. Empty Books and Books above the
current safe prompt size fail with a useful message without changing Notes.

Canonical workspace concepts, user accept/reject/rename/merge controls,
per-Note aggregation for arbitrarily large Books, and the optional visual Map
are not part of this first slice. They remain gated on real use of the grounded
index rather than being presented as already delivered.

### User experience

Each expanded Book gains a highlighted `Concepts` collection near Summary Cards.
Opening it shows:

- the strongest concepts in the Book;
- people, organizations, places, works, events, and ideas as visibly different
  kinds;
- a one-sentence description grounded in the Book;
- the number of supporting Notes;
- related concepts and a clear relationship label;
- the exact Notes and blocks supporting each concept or relationship;
- a stale indicator when the Book has changed since generation.

The default should be an evidence-first concept index, because it remains useful
on small screens and with keyboard navigation. A `Map` toggle can then draw the
same accepted data as a visual graph. The graph is a view, not a separate source
of truth.

The first visual map should remain restrained:

- concepts are nodes;
- optional small Note nodes appear only when requested;
- edges use a small relationship vocabulary such as `related to`, `supports`,
  `contrasts with`, `influences`, `part of`, and `occurs before`;
- selecting a node opens its evidence panel;
- no decorative physics, endless canvas, or unexplained confidence lines.

### Generation workflow

1. The user selects `Generate concepts` or `Refresh concepts` for a Book.
2. EpiNote snapshots every active Note ID, revision, and content hash.
3. Existing note-level facets are reused where current.
4. Missing Notes receive bounded concept-extraction jobs.
5. Deterministic normalization groups exact spelling/case variants.
6. AI may propose merges for semantic duplicates, but does not perform them
   silently.
7. Book relationships are generated only from cited Note/block evidence.
8. The server rejects unknown Note IDs, missing evidence, invalid relationship
   kinds, and self-referential edges.
9. The completed result appears in the notification bell.

Large Books are processed per Note and aggregated. EpiNote should not send an
entire arbitrarily large Book to one prompt.

### Storage

Reuse ordinary MongoDB collections:

- `concepts`: workspace-level canonical identity so the same concept can later
  connect multiple Books;
- `noteConceptLinks`: the Note evidence for a concept;
- `conceptRelations`: accepted or proposed relationships with evidence Note and
  block IDs;
- `aiJobs`: durable execution;
- one immutable Book concept snapshot keyed by the Book source hash and prompt
  version.

The Book map is filtered through the Book's active Notes. A concept is not
duplicated merely because it appears in two Books. No graph database is needed;
the expected queries are bounded two-hop MongoDB lookups.

### User control

- User-created concepts are accepted immediately and visibly marked as manual.
- AI-created concepts start as suggested unless the view explicitly labels them
  as generated.
- Rename preserves stable identity.
- Merge requires confirmation and preserves aliases and provenance.
- Reject prevents the same suggestion from immediately reappearing for the same
  source version.
- Removing a link never changes Note content.

### Acceptance criteria

- Every displayed concept opens at least one supporting Note location.
- Every relationship cites evidence containing both endpoint concepts or an
  explicit supported relation.
- Cross-organization and cross-workspace evidence is impossible.
- A Note edit makes affected generated results stale.
- Empty, tiny, very large, duplicate-heavy, and contradictory Books behave
  sensibly.
- AI/provider failure leaves the Book and Notes unchanged.

## 5. Feature 2: Book Index and coherent views

Summary Cards remain the fast recall view. A separate `Book Index` organizes the
whole collection for deeper navigation.

The index contains only sections supported by the material:

- Overview.
- Concepts and glossary.
- People and organizations.
- Sources and named works.
- Places.
- Timeline.
- Main arguments or claims.
- Agreements and contradictions.
- Open questions and missing context.

Every row links to the supporting Note or Notes. Sections with no evidence are
omitted instead of filled artificially.

Generation is asynchronous and source-hashed like Summary Cards. The index does
not become a giant generated Note. It is a derived Book view that can be
refreshed, inspected, and discarded without touching canonical Notes.

## 6. Feature 3: Ask the Book

`Ask` lets a user ask a question against the active Book.

First implementation:

1. Search titles, plain text, accepted concepts, people, sources, and dates using
   MongoDB.
2. Select a bounded set of relevant Note blocks.
3. Ask the model to answer only from those blocks.
4. Validate every citation.
5. Render the answer with clickable Note/block citations.
6. Say `The notes do not contain enough evidence` when retrieval is insufficient.

An answer is temporary unless the user explicitly chooses `Save as note` or
`Append to note`. The approval screen shows exactly what will be written.

Do not add embeddings first. Build a real evaluation set from user questions,
measure keyword plus concept retrieval, and add vector search only if it fixes
documented failures.

## 7. Feature 4: Research Assistant

Research is a user-directed workflow, not an autonomous crawler.

### Stage A: find research gaps

EpiNote examines the current Book and proposes:

- important unanswered questions;
- claims that need verification;
- missing dates or context;
- conflicting statements across Notes;
- thin concepts supported by only one source;
- useful comparison questions.

This stage uses only the user's Notes and costs one bounded Book job.

### Stage B: run one research task

The user selects or writes one question, then approves a small research scope:

- search query;
- optional date range;
- optional preferred or excluded domains;
- maximum sources and spending limit.

The assistant then:

1. retrieves a bounded set of sources;
2. records URL, title, publisher, author when available, publication date,
   retrieval time, and a content hash;
3. extracts only the sections relevant to the question;
4. treats page instructions as untrusted content;
5. separates source claims from the assistant's synthesis;
6. shows supporting and conflicting evidence;
7. produces a cited research brief;
8. lets the user approve selected findings into a new Research Note.

### Source and copyright boundaries

- Do not bypass paywalls, login requirements, robots restrictions, or technical
  access controls.
- Store source metadata, necessary short evidence excerpts, hashes, and citations;
  do not mirror entire webpages by default.
- Preserve attribution and direct links.
- Record when a source has changed or disappeared.
- Never present one source's assertion as independently verified fact.
- Never silently mix web research into a user's existing Note.

### Reliability

- Search and page failures are visible per source.
- Unsupported claims are removed or labeled before a brief is offered.
- Research runs are immutable snapshots so later source changes do not rewrite
  history.
- Users can report a bad citation or exclude a source.
- Jobs have hard limits on searches, pages, tokens, duration, and cost.

## 8. Feature 5: Source and contradiction intelligence

Once concepts and research sources exist, EpiNote can provide two useful views
without another model call:

- `Source coverage`: which Notes and Book claims depend on which sources.
- `Needs review`: stale links, unsupported claims, one-source claims, conflicting
  dates, and contradictory assertions.

AI may propose that two statements conflict, but the UI must show both quoted
Note excerpts and let the user decide. It must not choose a winner silently.

## 9. Feature 6: Study and recall

Build on existing Summary Cards rather than creating a separate learning
dashboard:

- turn a Book card into a question-and-answer card;
- generate a short self-test from accepted concepts;
- reveal the supporting Note after answering;
- let the user mark `Know`, `Unsure`, or `Review`;
- regenerate only when the Book source hash changes.

Spaced repetition scheduling is deferred until real users repeatedly use the
basic review workflow.

## 10. Native audio and video intelligence

The existing `yt-dlp` POC proved transcription, timestamps, structured analysis,
cost measurement, and evidence validation. It also exposed the wrong production
dependency: downloading third-party YouTube media using exported browser cookies.

YouTube's current API policies say API clients must not download, import, back
up, cache, or store YouTube audiovisual content without prior written approval.
YouTube's official captions download API also requires the authenticated user to
have permission to edit the video. Copyright exceptions vary by jurisdiction and
are case-specific, so EpiNote must not assume that an educational purpose grants
permission.

References:

- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [YouTube captions download authorization](https://developers.google.com/youtube/v3/docs/captions/download)
- [YouTube copyright guidance](https://support.google.com/youtube/answer/2797466)
- [YouTube fair-use guidance](https://support.google.com/youtube/answer/9783148)

### Supported production inputs

| Input | Production approach | Store full transcript? | Store source media? |
| --- | --- | --- | --- |
| User-uploaded audio/video they own or may process | Upload directly; transcribe and analyze | Yes, with user control | Optional; private and deletable |
| User-recorded meeting/lecture | Upload with consent reminder | Yes | Optional; private and deletable |
| User-pasted transcript or captions | Analyze supplied text | Yes | No media exists |
| Public YouTube URL | Send the URL directly to Gemini's official video-understanding API | No by default; retain structured findings and short timestamp evidence | No |
| User's own YouTube video | OAuth plus official caption API when the user has edit permission | Yes | No |
| Arbitrary third-party YouTube download | Not a production feature | No | No |

Gemini's official API currently accepts public YouTube URLs directly and analyzes
both audio and visual streams. That capability is in preview, so it must be
feature-flagged, monitored for policy/API changes, and have a clear unsupported
state rather than falling back to cookie-based downloading.

Reference:

- [Gemini video understanding and public YouTube URL input](https://ai.google.dev/gemini-api/docs/video-understanding)

### Media job output

A successful media job may create:

- source title, URL or attachment, duration, language, and processing method;
- concise summary;
- timestamped chapters;
- concepts, people, organizations, places, dates, and named works;
- attributed claims with timestamp evidence;
- visual observations clearly distinguished from spoken claims;
- key quotations only when short, necessary, and permitted;
- limitations such as inaudible speech, missing visuals, or uncertain speakers;
- a proposed EpiNote Note that the user reviews before saving into a Book.

For URL-based public media, store timestamps and compact evidence, not the media
or a complete transcript. The original player/link remains the authoritative
source.

### Upload privacy and retention

- Require the user to confirm they own the media or have permission to process it.
- Warn users to obtain participant consent for meetings and recordings.
- Keep uploads private and tenant-scoped.
- Offer `Delete source after processing` as the default for one-time analysis.
- Document provider retention before enabling a provider in production.
- Deleting a source must not silently delete the user's approved derived Note;
  it should remove the attachment and mark source playback unavailable.

### POC disposition

Keep `tools/audio-intelligence/` as a private engineering POC and evidence of the
validated output contract. Do not expose it through the EpiNote UI, accept user
cookies, or operate it as the production path. Remove the protected server cookie
when the POC no longer needs additional tests.

## 11. Model strategy

Do not design product features around whichever model name is fashionable.
Define task profiles:

- `extract-fast`: note concepts, entities, dates, and source metadata;
- `synthesize-book`: Book index, contradictions, and research briefs;
- `answer-grounded`: cited Ask responses;
- `media-multimodal`: audio/video understanding;
- `transcribe`: user-owned audio when no trusted transcript exists.

Each profile has:

- a primary and bounded fallback model;
- input/output limits;
- strict response schema;
- timeout and retry policy;
- per-job cost ceiling;
- a small evaluation set built from real EpiNote Books;
- recorded quality, latency, and cost.

Use direct Gemini access for official public-YouTube URL handling. Other text
tasks may continue through the current OpenRouter boundary while models are
evaluated. Provider changes must not change stored result contracts.

## 12. Delivery order

### Slice 1: evidence-backed Book Concepts

Deliver:

- concept extraction and deterministic validation;
- Concepts row in each Book;
- concept index with Note evidence;
- accept, reject, rename, and merge;
- stale detection and background notification;
- restrained Map toggle over the same accepted data.

Exit when one real large Book produces a useful, navigable map and every edge can
be traced back to evidence.

### Slice 2: Book Index and Ask

Deliver:

- cited Book Index sections;
- keyword/concept retrieval;
- grounded Book questions with Note citations;
- evaluation set from real questions.

Exit when unsupported questions reliably say evidence is insufficient.

### Slice 3: Research Assistant

Deliver:

- gap suggestions;
- one bounded, user-approved research run;
- cited brief with source inspection;
- explicit approval into a Research Note;
- injection, failure, budget, and authorization tests.

Exit when a user can verify every useful statement without trusting the model
blindly.

### Slice 4: safe media intelligence

Deliver in this order:

1. pasted transcript;
2. user-owned audio upload;
3. user-owned video upload with audio plus visual analysis;
4. public YouTube URL through the official Gemini URL input behind a feature flag;
5. creator-authorized YouTube captions only if users need channel integration.

Exit when media is processed without exported browser cookies, source retention
is explicit, and timestamp evidence survives a realistic end-to-end test.

### Slice 5: source review and study tools

Deliver only after usage shows that concepts, Ask, research, and media results are
actually being revisited.

## 13. Do not build yet

- A dedicated graph database.
- A separate vector database without measured retrieval failures.
- An autonomous research agent that browses indefinitely.
- A global AI dashboard or activity feed.
- Silent background rewriting or moving of Notes.
- Automatic acceptance of concepts, relationships, or web findings.
- A general-purpose third-party media downloader.
- A permanent store of third-party videos or complete copied transcripts.
- Continuous reprocessing on every keystroke.
- Provider-specific schemas spread across the application.

## 14. Product measures

Track only measures that reveal usefulness and reliability:

- percentage of generated concepts opened or accepted;
- percentage of proposed merges accepted;
- Ask answers whose citations users open;
- unsupported-citation and invalid-edge rejection rate;
- research findings approved into Notes;
- stale intelligence awaiting refresh;
- model failure, latency, and exact cost per feature/job;
- media jobs completed, rejected for rights/input reasons, or failed by provider;
- user-reported bad citations or misleading outputs.

Do not optimize for number of AI calls, graph size, or time spent in an AI
dashboard.

## 15. Immediate next design task

When implementation resumes, design only Slice 1 in executable detail:

1. inspect one real Book and its Note sizes;
2. define the concept and relation JSON schemas;
3. define evidence validation and stale behavior;
4. sketch the Concepts index and Map interaction inside the current Book UI;
5. choose one model profile through a small real-data evaluation;
6. implement one Book end to end;
7. measure usefulness before expanding scope.

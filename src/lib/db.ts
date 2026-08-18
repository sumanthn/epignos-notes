import { Db, MongoClient } from "mongodb";

import { getEnv } from "@/lib/env";

declare global {
  var epinoteMongoClient: MongoClient | undefined;
  var epinoteIndexPromise: Promise<void> | undefined;
}

export async function getDb(): Promise<Db> {
  const env = getEnv();

  if (!global.epinoteMongoClient) {
    global.epinoteMongoClient = new MongoClient(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5_000,
    });
  }

  await global.epinoteMongoClient.connect();
  return global.epinoteMongoClient.db(env.MONGODB_DB);
}

export async function ensureDbIndexes(): Promise<void> {
  if (!global.epinoteIndexPromise) {
    global.epinoteIndexPromise = createIndexes().catch((error) => {
      global.epinoteIndexPromise = undefined;
      throw error;
    });
  }

  return global.epinoteIndexPromise;
}

async function createIndexes(): Promise<void> {
  const db = await getDb();

  await Promise.all([
    db.collection("users").createIndexes([
      { key: { emailNormalized: 1 }, name: "users_email_unique", unique: true },
      { key: { status: 1, updatedAt: -1 }, name: "users_status_updated" },
      {
        key: { systemRole: 1 },
        name: "users_single_superadmin",
        unique: true,
        partialFilterExpression: { systemRole: "superadmin" },
      },
    ]),
    db.collection("sessions").createIndexes([
      { key: { tokenHash: 1 }, name: "sessions_token_unique", unique: true },
      {
        key: { expiresAt: 1 },
        name: "sessions_expiry_ttl",
        expireAfterSeconds: 0,
      },
      {
        key: { userId: 1, status: 1, expiresAt: 1 },
        name: "sessions_user_status_expiry",
      },
    ]),
    db.collection("organizations").createIndex(
      { slug: 1 },
      { name: "organizations_slug_unique", unique: true },
    ),
    db.collection("memberships").createIndexes([
      {
        key: { organizationId: 1, userId: 1 },
        name: "memberships_org_user_unique",
        unique: true,
      },
      {
        key: { userId: 1, status: 1, updatedAt: -1 },
        name: "memberships_user_status_updated",
      },
    ]),
    db.collection("workspaces").createIndexes([
      {
        key: { organizationId: 1, slug: 1 },
        name: "workspaces_org_slug_unique",
        unique: true,
      },
      {
        key: { organizationId: 1, status: 1, updatedAt: -1 },
        name: "workspaces_org_status_updated",
      },
    ]),
    db.collection("books").createIndexes([
      {
        key: { organizationId: 1, workspaceId: 1, status: 1, position: 1 },
        name: "books_navigation",
      },
      {
        key: { organizationId: 1, workspaceId: 1, systemKey: 1 },
        name: "books_system_unique",
        unique: true,
        partialFilterExpression: { systemKey: { $type: "string" } },
      },
    ]),
    db.collection("notes").createIndexes([
      {
        key: {
          organizationId: 1,
          workspaceId: 1,
          bookId: 1,
          status: 1,
          updatedAt: -1,
        },
        name: "notes_book_navigation",
      },
      {
        key: { organizationId: 1, workspaceId: 1, status: 1, updatedAt: -1 },
        name: "notes_workspace_navigation",
      },
    ]),
    db.collection("aiProposals").createIndexes([
      {
        key: {
          organizationId: 1,
          workspaceId: 1,
          noteId: 1,
          type: 1,
          status: 1,
          sourceRevision: 1,
        },
        name: "ai_proposals_note_revision",
      },
      {
        key: { status: 1, createdAt: -1 },
        name: "ai_proposals_status_created",
      },
    ]),
    db.collection("aiJobs").createIndexes([
      {
        key: {
          organizationId: 1,
          workspaceId: 1,
          noteId: 1,
          type: 1,
          sourceRevision: 1,
          sourceHash: 1,
          promptVersion: 1,
          model: 1,
        },
        name: "ai_jobs_note_revision_unique",
        unique: true,
      },
      {
        key: { organizationId: 1, workspaceId: 1, updatedAt: -1 },
        name: "ai_jobs_workspace_activity",
      },
      {
        key: { status: 1, updatedAt: 1 },
        name: "ai_jobs_status_updated",
      },
      {
        key: { organizationId: 1, workspaceId: 1, status: 1 },
        name: "ai_jobs_one_processing_per_workspace",
        unique: true,
        partialFilterExpression: { status: "processing" },
      },
    ]),
    db.collection("bookCardDecks").createIndexes([
      {
        key: {
          organizationId: 1,
          workspaceId: 1,
          bookId: 1,
          sourceHash: 1,
          promptVersion: 1,
        },
        name: "book_card_decks_source_unique",
        unique: true,
      },
      {
        key: { organizationId: 1, workspaceId: 1, bookId: 1, createdAt: -1 },
        name: "book_card_decks_navigation",
      },
    ]),
    db.collection("noteSummaryProfiles").createIndexes([
      {
        key: {
          organizationId: 1,
          workspaceId: 1,
          noteId: 1,
          summaryHash: 1,
          promptVersion: 1,
        },
        name: "note_summary_profiles_source_unique",
        unique: true,
      },
      {
        key: { organizationId: 1, workspaceId: 1, noteId: 1, createdAt: -1 },
        name: "note_summary_profiles_navigation",
      },
    ]),
    db.collection("noteRevisions").createIndexes([
      {
        key: { noteId: 1, revision: 1 },
        name: "note_revisions_note_revision_unique",
        unique: true,
      },
      {
        key: { organizationId: 1, workspaceId: 1, noteId: 1, createdAt: -1 },
        name: "note_revisions_navigation",
      },
    ]),
    db.collection("feedbackRequests").createIndexes([
      {
        key: { status: 1, updatedAt: -1 },
        name: "feedback_status_updated",
      },
      {
        key: { userId: 1, createdAt: -1 },
        name: "feedback_user_created",
      },
      {
        key: { organizationId: 1, workspaceId: 1, createdAt: -1 },
        name: "feedback_workspace_created",
      },
    ]),
  ]);
}

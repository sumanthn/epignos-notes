import { ObjectId } from "mongodb";

import { ensureDbIndexes, getDb } from "@/lib/db";
import { textFromContent } from "@/lib/note-content";
import type { SessionUser } from "@/lib/session";

export interface WorkspaceIdentity {
  organizationId: ObjectId;
  workspaceId: ObjectId;
  bookId: ObjectId;
}

export interface WorkspacePayload {
  organization: { id: string; name: string };
  workspace: { id: string; name: string };
  books: Array<{ id: string; name: string }>;
  notes: Array<{
    id: string;
    bookId: string;
    title: string;
    body: string;
    revision: number;
    updatedAt: string;
  }>;
}

export async function ensurePersonalHierarchy(
  userId: ObjectId,
  displayName: string,
  organizationName?: string,
): Promise<WorkspaceIdentity> {
  await ensureDbIndexes();
  const db = await getDb();
  const now = new Date();
  const suffix = userId.toHexString();

  const organization = await db.collection("organizations").findOneAndUpdate(
    { slug: `personal-${suffix}` },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        schemaVersion: 1,
        name: organizationName ?? `${displayName}'s organization`,
        slug: `personal-${suffix}`,
        status: "active",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!organization) throw new Error("Unable to create organization");

  await db.collection("memberships").updateOne(
    { organizationId: organization._id, userId },
    {
      $setOnInsert: {
        schemaVersion: 1,
        organizationId: organization._id,
        userId,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
        disabledAt: null,
      },
    },
    { upsert: true },
  );

  const workspace = await db.collection("workspaces").findOneAndUpdate(
    { organizationId: organization._id, slug: "my-workspace" },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        schemaVersion: 1,
        organizationId: organization._id,
        name: "My Workspace",
        slug: "my-workspace",
        status: "active",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!workspace) throw new Error("Unable to create workspace");

  const book = await db.collection("books").findOneAndUpdate(
    {
      organizationId: organization._id,
      workspaceId: workspace._id,
      systemKey: "unsorted",
    },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        schemaVersion: 1,
        organizationId: organization._id,
        workspaceId: workspace._id,
        name: "Unsorted",
        normalizedName: "unsorted",
        description: "Quickly captured notes",
        position: 0,
        systemKey: "unsorted",
        status: "active",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!book) throw new Error("Unable to create default book");

  return {
    organizationId: organization._id,
    workspaceId: workspace._id,
    bookId: book._id,
  };
}

export async function getWorkspacePayload(user: SessionUser): Promise<WorkspacePayload> {
  const identity = await ensurePersonalHierarchy(user.id, user.displayName);
  const db = await getDb();

  const [organization, workspace, books, notes] = await Promise.all([
    db.collection("organizations").findOne({
      _id: identity.organizationId,
      status: "active",
    }),
    db.collection("workspaces").findOne({
      _id: identity.workspaceId,
      organizationId: identity.organizationId,
      status: "active",
    }),
    db
      .collection("books")
      .find({
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        status: "active",
      })
      .sort({ position: 1 })
      .toArray(),
    db
      .collection("notes")
      .find({
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        status: "active",
      })
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray(),
  ]);

  if (!organization || !workspace) throw new Error("Workspace is unavailable");

  return {
    organization: { id: organization._id.toHexString(), name: organization.name },
    workspace: { id: workspace._id.toHexString(), name: workspace.name },
    books: books.map((book) => ({ id: book._id.toHexString(), name: book.name })),
    notes: notes.map((note) => ({
      id: note._id.toHexString(),
      bookId: note.bookId.toHexString(),
      title: note.title,
      body: textFromContent(note.content),
      revision: note.revision,
      updatedAt: note.updatedAt.toISOString(),
    })),
  };
}

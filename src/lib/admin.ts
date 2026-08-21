import { ensureDbIndexes, getDb } from "@/lib/db";
import {
  normalizedDatabaseFootprint,
  type DatabaseFootprint,
} from "./admin-values";
import {
  isFeedbackStatus,
  isFeedbackType,
  type AdminFeedbackItem,
} from "./feedback";
import {
  PRIVACY_NOTICE_VERSION,
  TERMS_VERSION,
  legalAcceptanceVersionKey,
} from "./legal";

export type AdminDashboard = {
  generatedAt: string;
  users: {
    total: number;
    active: number;
    disabled: number;
    newLast7Days: number;
  };
  legal: {
    pendingAcceptance: number;
    notifiedPendingUsers: number;
  };
  activeSessions: number;
  content: {
    organizations: number;
    workspaces: number;
    books: number;
    activeNotes: number;
    archivedNotes: number;
    notesLast7Days: number;
    notesLast30Days: number;
  };
  ai: {
    totalJobs: number;
    jobsLast30Days: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  feedback: {
    total: number;
    pending: number;
    recent: AdminFeedbackItem[];
  };
  database: DatabaseFootprint | null;
  recentUsers: Array<{
    id: string;
    displayName: string;
    email: string;
    status: string;
    systemRole: "superadmin" | null;
    createdAt: string;
    lastLoginAt: string | null;
  }>;
};

function dateValue(value: unknown): string | null {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString()
    : null;
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  await ensureDbIndexes();
  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);

  const databaseStats = db
    .command({ dbStats: 1, scale: 1 })
    .then(normalizedDatabaseFootprint)
    .catch(() => null);

  const [
    totalUsers,
    activeUsers,
    disabledUsers,
    newUsers,
    pendingLegalAcceptance,
    notifiedPendingUsers,
    activeSessions,
    organizations,
    workspaces,
    books,
    activeNotes,
    archivedNotes,
    notesLast7Days,
    notesLast30Days,
    totalAiJobs,
    aiJobsLast30Days,
    aiStatusCounts,
    totalFeedback,
    pendingFeedback,
    recentFeedback,
    recentUsers,
    database,
  ] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("users").countDocuments({ status: "active" }),
    db.collection("users").countDocuments({ status: "disabled" }),
    db.collection("users").countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    db.collection("users").countDocuments({
      status: "active",
      $or: [
        { termsVersion: { $ne: TERMS_VERSION } },
        { privacyNoticeVersion: { $ne: PRIVACY_NOTICE_VERSION } },
        { termsAcceptedAt: { $not: { $type: "date" } } },
        { privacyAcknowledgedAt: { $not: { $type: "date" } } },
      ],
    }),
    db.collection("users").countDocuments({
      status: "active",
      legalNoticeVersion: legalAcceptanceVersionKey(),
      $or: [
        { termsVersion: { $ne: TERMS_VERSION } },
        { privacyNoticeVersion: { $ne: PRIVACY_NOTICE_VERSION } },
        { termsAcceptedAt: { $not: { $type: "date" } } },
        { privacyAcknowledgedAt: { $not: { $type: "date" } } },
      ],
    }),
    db.collection("sessions").countDocuments({
      status: "active",
      expiresAt: { $gt: now },
      absoluteExpiresAt: { $gt: now },
    }),
    db.collection("organizations").countDocuments({ status: "active" }),
    db.collection("workspaces").countDocuments({ status: "active" }),
    db.collection("books").countDocuments({ status: "active" }),
    db.collection("notes").countDocuments({ status: "active" }),
    db.collection("notes").countDocuments({ status: "archived" }),
    db.collection("notes").countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    db.collection("notes").countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    db.collection("aiJobs").countDocuments(),
    db.collection("aiJobs").countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    db
      .collection("aiJobs")
      .aggregate<{ _id: unknown; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ])
      .toArray(),
    db.collection("feedbackRequests").countDocuments(),
    db.collection("feedbackRequests").countDocuments({
      status: { $in: ["open", "in_progress"] },
    }),
    db.collection("feedbackRequests").aggregate<{
      _id: import("mongodb").ObjectId;
      type: unknown;
      status: unknown;
      title: unknown;
      description: unknown;
      contextPath: unknown;
      createdAt: unknown;
      updatedAt: unknown;
      reporterName?: unknown;
      organizationName?: unknown;
      workspaceName?: unknown;
    }>([
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: "users",
          let: { reporterId: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$reporterId"] } } },
            { $project: { _id: 0, displayName: 1 } },
          ],
          as: "reporterRows",
        },
      },
      {
        $lookup: {
          from: "organizations",
          let: { tenantId: "$organizationId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$tenantId"] } } },
            { $project: { _id: 0, name: 1 } },
          ],
          as: "organizationRows",
        },
      },
      {
        $lookup: {
          from: "workspaces",
          let: { tenantWorkspaceId: "$workspaceId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$tenantWorkspaceId"] } } },
            { $project: { _id: 0, name: 1 } },
          ],
          as: "workspaceRows",
        },
      },
      {
        $set: {
          reporterName: { $getField: { field: "displayName", input: { $first: "$reporterRows" } } },
          organizationName: { $getField: { field: "name", input: { $first: "$organizationRows" } } },
          workspaceName: { $getField: { field: "name", input: { $first: "$workspaceRows" } } },
        },
      },
      {
        $project: {
          type: 1,
          status: 1,
          title: 1,
          description: 1,
          contextPath: 1,
          createdAt: 1,
          updatedAt: 1,
          reporterName: 1,
          organizationName: 1,
          workspaceName: 1,
        },
      },
    ]).toArray(),
    db
      .collection("users")
      .find({})
      .project({
        _id: 1,
        displayName: 1,
        email: 1,
        status: 1,
        systemRole: 1,
        createdAt: 1,
        lastLoginAt: 1,
      })
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray(),
    databaseStats,
  ]);

  return {
    generatedAt: now.toISOString(),
    users: {
      total: totalUsers,
      active: activeUsers,
      disabled: disabledUsers,
      newLast7Days: newUsers,
    },
    legal: {
      pendingAcceptance: pendingLegalAcceptance,
      notifiedPendingUsers,
    },
    activeSessions,
    content: {
      organizations,
      workspaces,
      books,
      activeNotes,
      archivedNotes,
      notesLast7Days,
      notesLast30Days,
    },
    ai: {
      totalJobs: totalAiJobs,
      jobsLast30Days: aiJobsLast30Days,
      byStatus: aiStatusCounts.map((item) => ({
        status: typeof item._id === "string" ? item._id : "unknown",
        count: item.count,
      })),
    },
    feedback: {
      total: totalFeedback,
      pending: pendingFeedback,
      recent: recentFeedback.map((item) => ({
        id: item._id.toHexString(),
        type: isFeedbackType(item.type) ? item.type : "bug",
        status: isFeedbackStatus(item.status) ? item.status : "open",
        title: typeof item.title === "string" ? item.title : "Untitled report",
        description: typeof item.description === "string" ? item.description : "No description supplied.",
        contextPath: typeof item.contextPath === "string" ? item.contextPath : "/workspace",
        reporterName: typeof item.reporterName === "string" ? item.reporterName : "Unknown user",
        organizationName: typeof item.organizationName === "string" ? item.organizationName : "Unknown organization",
        workspaceName: typeof item.workspaceName === "string" ? item.workspaceName : "Unknown workspace",
        createdAt: dateValue(item.createdAt) ?? now.toISOString(),
        updatedAt: dateValue(item.updatedAt) ?? now.toISOString(),
      })),
    },
    database,
    recentUsers: recentUsers.map((user) => ({
      id: user._id.toHexString(),
      displayName: typeof user.displayName === "string" ? user.displayName : "Unnamed user",
      email: typeof user.email === "string" ? user.email : "Unknown email",
      status: typeof user.status === "string" ? user.status : "unknown",
      systemRole: user.systemRole === "superadmin" ? "superadmin" : null,
      createdAt: dateValue(user.createdAt) ?? now.toISOString(),
      lastLoginAt: dateValue(user.lastLoginAt),
    })),
  };
}

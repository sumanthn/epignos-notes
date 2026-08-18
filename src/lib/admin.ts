import { ensureDbIndexes, getDb } from "@/lib/db";
import {
  normalizedDatabaseFootprint,
  type DatabaseFootprint,
} from "./admin-values";

export type AdminDashboard = {
  generatedAt: string;
  users: {
    total: number;
    active: number;
    disabled: number;
    newLast7Days: number;
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
    recentUsers,
    database,
  ] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("users").countDocuments({ status: "active" }),
    db.collection("users").countDocuments({ status: "disabled" }),
    db.collection("users").countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
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

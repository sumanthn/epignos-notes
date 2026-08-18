import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AdminSignOutButton } from "@/components/AdminSignOutButton";
import { ProductWordmark } from "@/components/ProductWordmark";
import { getAdminDashboard } from "@/lib/admin";
import {
  getSessionUserByToken,
  isSuperAdminUser,
  sessionCookieName,
} from "@/lib/session";

import styles from "./admin.module.css";

export const metadata: Metadata = { title: "System overview" };
export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatBytes(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value < 1_024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1_024;
  let unit = units[0];
  for (let index = 1; index < units.length && amount >= 1_024; index += 1) {
    amount /= 1_024;
    unit = units[index];
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : "Never";
}

function formatUtcDate(value: string | null): string {
  return value ? `${formatDate(value)} UTC` : "Never";
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const user = await getSessionUserByToken(cookieStore.get(sessionCookieName())?.value);
  if (!user) redirect("/login");
  if (!isSuperAdminUser(user)) notFound();

  const dashboard = await getAdminDashboard();
  const database = dashboard.database;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <ProductWordmark href="/" />
        <div className={styles.topbarActions}>
          <span>Super admin</span>
          <AdminSignOutButton />
        </div>
      </header>

      <div className={styles.page}>
        <section className={styles.intro}>
          <div>
            <p>Operations</p>
            <h1>System overview</h1>
            <span>Private aggregate health for EpiNote Beta. No note contents are shown.</span>
          </div>
          <time dateTime={dashboard.generatedAt}>Updated {formatUtcDate(dashboard.generatedAt)}</time>
        </section>

        <section className={styles.metricGrid} aria-label="Key metrics">
          <MetricCard
            label="Users"
            value={formatNumber(dashboard.users.total)}
            detail={`${formatNumber(dashboard.users.newLast7Days)} joined in 7 days`}
          />
          <MetricCard
            label="Active notes"
            value={formatNumber(dashboard.content.activeNotes)}
            detail={`${formatNumber(dashboard.content.notesLast7Days)} created in 7 days`}
          />
          <MetricCard
            label="Active sessions"
            value={formatNumber(dashboard.activeSessions)}
            detail={`${formatNumber(dashboard.users.active)} active accounts`}
          />
          <MetricCard
            label="AI jobs"
            value={formatNumber(dashboard.ai.totalJobs)}
            detail={`${formatNumber(dashboard.ai.jobsLast30Days)} started in 30 days`}
          />
        </section>

        <div className={styles.twoColumn}>
          <section className={styles.panel}>
            <header>
              <div><p>Storage</p><h2>Database footprint</h2></div>
              <span>{database ? "MongoDB reporting" : "Stats unavailable"}</span>
            </header>
            <dl className={styles.detailGrid}>
              <div><dt>Data</dt><dd>{formatBytes(database?.dataSizeBytes ?? null)}</dd></div>
              <div><dt>Allocated storage</dt><dd>{formatBytes(database?.storageSizeBytes ?? null)}</dd></div>
              <div><dt>Indexes</dt><dd>{formatBytes(database?.indexSizeBytes ?? null)}</dd></div>
              <div><dt>Total footprint</dt><dd>{formatBytes(database?.totalSizeBytes ?? null)}</dd></div>
              <div><dt>Collections</dt><dd>{database?.collections ?? "—"}</dd></div>
              <div><dt>Documents</dt><dd>{database?.objects !== null && database?.objects !== undefined ? formatNumber(database.objects) : "—"}</dd></div>
            </dl>
          </section>

          <section className={styles.panel}>
            <header>
              <div><p>Content</p><h2>Knowledge structure</h2></div>
              <span>Active records</span>
            </header>
            <dl className={styles.detailGrid}>
              <div><dt>Organizations</dt><dd>{formatNumber(dashboard.content.organizations)}</dd></div>
              <div><dt>Workspaces</dt><dd>{formatNumber(dashboard.content.workspaces)}</dd></div>
              <div><dt>Books</dt><dd>{formatNumber(dashboard.content.books)}</dd></div>
              <div><dt>Notes</dt><dd>{formatNumber(dashboard.content.activeNotes)}</dd></div>
              <div><dt>Archived notes</dt><dd>{formatNumber(dashboard.content.archivedNotes)}</dd></div>
              <div><dt>Notes in 30 days</dt><dd>{formatNumber(dashboard.content.notesLast30Days)}</dd></div>
            </dl>
          </section>
        </div>

        <div className={styles.twoColumn}>
          <section className={styles.panel}>
            <header><div><p>Accounts</p><h2>User status</h2></div></header>
            <dl className={styles.statusList}>
              <div><dt><i aria-hidden="true" className={styles.successDot} />Active</dt><dd>{formatNumber(dashboard.users.active)}</dd></div>
              <div><dt><i aria-hidden="true" className={styles.neutralDot} />Disabled</dt><dd>{formatNumber(dashboard.users.disabled)}</dd></div>
            </dl>
          </section>

          <section className={styles.panel}>
            <header><div><p>Intelligence</p><h2>AI job status</h2></div></header>
            {dashboard.ai.byStatus.length ? (
              <dl className={styles.statusList}>
                {dashboard.ai.byStatus.map((item) => (
                  <div key={item.status}>
                    <dt><i aria-hidden="true" className={styles.aiDot} />{item.status}</dt>
                    <dd>{formatNumber(item.count)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.empty}>No AI jobs have run yet.</p>
            )}
          </section>
        </div>

        <section className={`${styles.panel} ${styles.usersPanel}`}>
          <header>
            <div><p>Accounts</p><h2>Recent users</h2></div>
            <span>Latest 12 registrations</span>
          </header>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr><th>User</th><th>Status</th><th>Joined</th><th>Last login</th></tr>
              </thead>
              <tbody>
                {dashboard.recentUsers.map((recentUser) => (
                  <tr key={recentUser.id}>
                    <td><strong>{recentUser.displayName}</strong><span>{recentUser.email}</span></td>
                    <td>
                      <span className={styles.statusPill}>
                        {recentUser.systemRole === "superadmin" ? "Super admin" : recentUser.status}
                      </span>
                    </td>
                    <td>{formatUtcDate(recentUser.createdAt)}</td>
                    <td>{formatUtcDate(recentUser.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

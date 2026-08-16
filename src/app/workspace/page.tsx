import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceApp } from "@/components/WorkspaceApp";
import { getSessionUserByToken, sessionCookieName } from "@/lib/session";
import { getWorkspacePayload } from "@/lib/workspace";

export const metadata: Metadata = { title: "Workspace" };
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const cookieStore = await cookies();
  const user = await getSessionUserByToken(cookieStore.get(sessionCookieName())?.value);

  if (!user) redirect("/login");

  const workspace = await getWorkspacePayload(user);
  return <WorkspaceApp initialWorkspace={workspace} userName={user.displayName} />;
}

import type { Metadata } from "next";

import { GroupsManager } from "@/components/groups-manager";
import { listGroupsWithCounts } from "@/lib/groups";

export const metadata: Metadata = { title: "Группы" };

// Rendered on every request: the groups live in the database, which isn't there at build time.
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = await listGroupsWithCounts();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-4 pb-16 lg:pt-6">
      <h1 className="mb-7 font-display text-title font-semibold lg:text-title-lg">Группы</h1>
      <GroupsManager initialGroups={groups} />
    </main>
  );
}

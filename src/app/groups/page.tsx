import type { Metadata } from "next";

import { GroupsManager } from "@/components/groups-manager";
import { listGroupsWithCounts } from "@/lib/groups";

export const metadata: Metadata = { title: "Группы" };

export default async function GroupsPage() {
  const groups = await listGroupsWithCounts();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-4 pb-16 lg:pt-6">
      <h1 className="mb-7 font-display text-title font-semibold lg:text-title-lg">Группы</h1>
      <GroupsManager initialGroups={groups} />
    </main>
  );
}

import { TeamManager } from "@/app/_components/TeamManager";
import { getAllMembers } from "@/lib/queries";
import type { MemberView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const members = await getAllMembers();

  const memberViews: MemberView[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    active: m.active,
  }));

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Team</h1>
      <TeamManager members={memberViews} />
    </div>
  );
}

// Plain shapes handed from server components to client components. Keeping
// these free of Date objects and Prisma types avoids serialization surprises
// across the boundary.

import type { Priority } from "@/lib/priority";

export type MemberView = {
  id: string;
  name: string;
  active: boolean;
};

export type TaskView = {
  id: string;
  text: string;
  status: "open" | "done";
  priority: Priority;
  carriedCount: number;
  owners: { id: string; name: string }[];
};

"use client";

import { useRouter } from "next/navigation";
import { formatMonth } from "@/lib/dates";

export function MonthPicker({
  months,
  selected,
}: {
  months: string[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/reports?month=${e.target.value}`)}
      className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
    >
      {months.map((month) => (
        <option key={month} value={month}>
          {formatMonth(month)}
        </option>
      ))}
    </select>
  );
}

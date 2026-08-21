"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Validated as a categorical pair against a light surface: CVD separation
// ΔE 13.7 (deutan), normal-vision ΔE 27.1, both above the 3:1 contrast floor.
// The UI's own green (#2f6f5e) failed the chroma floor — it reads gray as a
// large fill — so the chart uses its own higher-chroma teal.
const COMPLETED = "#0d9488";
const MISSED = "#c2410c";

export type ChartRow = {
  name: string;
  completed: number;
  missed: number;
};

export function MonthChart({ data }: { data: ChartRow[] }) {
  if (data.length === 0) return null;

  // Horizontal bars: names read left-to-right, and both series share a common
  // baseline so "completed" and "missed" stay comparable across people.
  const height = data.length * 52 + 24;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-4">
        <LegendKey color={COMPLETED} label="Completed" />
        <LegendKey color={MISSED} label="Missed" />
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
          barGap={2}
          barCategoryGap={16}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6f6f6b", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "#f7f7f6" }}
            contentStyle={{
              border: "1px solid #e6e6e2",
              borderRadius: 8,
              fontSize: 12,
              color: "#1a1a19",
              boxShadow: "none",
            }}
          />
          <Bar dataKey="completed" name="Completed" radius={[0, 4, 4, 0]} barSize={12}>
            {data.map((row) => (
              <Cell key={row.name} fill={COMPLETED} />
            ))}
            <LabelList
              dataKey="completed"
              position="right"
              style={{ fill: "#6f6f6b", fontSize: 11 }}
            />
          </Bar>
          <Bar dataKey="missed" name="Missed" radius={[0, 4, 4, 0]} barSize={12}>
            {data.map((row) => (
              <Cell key={row.name} fill={MISSED} />
            ))}
            <LabelList
              dataKey="missed"
              position="right"
              style={{ fill: "#6f6f6b", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span
        aria-hidden
        className="size-2.5 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

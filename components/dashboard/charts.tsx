"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  MonthFlowRow,
  PlatformSlice,
  QuarterRow,
  TopProductRow,
} from "@/lib/reporting";

// Diagramme lesen ihre Farben aus CSS-Variablen → funktionieren automatisch
// in hell UND dunkel. Achsen/Grid/Tooltip nutzen die semantischen Tokens.

const AXIS = { fill: "var(--muted-foreground)", fontSize: 12 };
const GRID = "var(--border)";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const;

function euro(value: number): string {
  return `${value.toLocaleString("de-DE")} €`;
}

function tooltipEuro(value: unknown): string {
  return euro(Number(value ?? 0));
}

const PIE_COLORS = [
  "var(--transit-teal)",
  "var(--cargo-amber)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--customs-red)",
  "var(--slate)",
  "var(--chart-2)",
];

export function QuarterlyChart({
  rows,
  currentYear,
  lastYear,
}: {
  rows: QuarterRow[];
  currentYear: number;
  lastYear: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="quartal" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={euro} />
        <Tooltip contentStyle={tooltipStyle} formatter={tooltipEuro} cursor={{ fill: "var(--accent)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="vorjahr" name={String(lastYear)} fill="var(--slate)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="aktuell" name={String(currentYear)} fill="var(--transit-teal)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FlowChart({ rows }: { rows: MonthFlowRow[] }) {
  if (rows.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={euro} />
        <Tooltip contentStyle={tooltipStyle} formatter={tooltipEuro} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="einkauf" name="Einkauf" stroke="var(--cargo-amber)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="verkauf" name="Verkauf" stroke="var(--transit-teal)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PlatformPie({ slices }: { slices: PlatformSlice[] }) {
  if (slices.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
          stroke="var(--card)"
        >
          {slices.map((slice, index) => (
            <Cell key={slice.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={tooltipEuro} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopProductsChart({ rows }: { rows: TopProductRow[] }) {
  if (rows.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={euro} />
        <YAxis
          type="category"
          dataKey="model"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={tooltipEuro} cursor={{ fill: "var(--accent)" }} />
        <Bar dataKey="profit" name="Gewinn" radius={[0, 4, 4, 0]}>
          {rows.map((row) => (
            <Cell
              key={row.model}
              fill={row.profit < 0 ? "var(--customs-red)" : "var(--transit-teal)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      Keine Daten im gewählten Zeitraum.
    </div>
  );
}

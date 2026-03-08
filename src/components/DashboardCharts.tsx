"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RevenuePoint } from "@/lib/site-data";

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="name" stroke="rgba(255,255,255,0.35)" />
        <YAxis stroke="rgba(255,255,255,0.35)" />
        <Tooltip />
        <Line type="monotone" dataKey="revenue" stroke="#F7931A" strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function UsageChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="name" stroke="rgba(255,255,255,0.35)" />
        <YAxis stroke="rgba(255,255,255,0.35)" />
        <Tooltip />
        <Bar dataKey="uses" fill="#f7b15a" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

import "server-only";

import type { NextRequest } from "next/server";

export type DataSourceMode = "local" | "overlay" | "index";

export function parseDataSourceMode(value?: string | null) {
  const fallback = process.env.DATA_SOURCE_MODE || (process.env.OPNET_LIVE_READS === "1" ? "index" : "overlay");
  const mode = (value || fallback).toLowerCase();

  if (mode === "local" || mode === "overlay" || mode === "index") {
    return mode as DataSourceMode;
  }

  return "overlay" satisfies DataSourceMode;
}

export function resolveDataSourceMode(req?: NextRequest) {
  const requested = req ? new URL(req.url).searchParams.get("source") : null;
  return parseDataSourceMode(requested);
}

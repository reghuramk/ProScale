// backend/src/scripts/exportFleetCpuDataset.ts
import fs from "node:fs";
import path from "node:path";

import { getEc2CpuHistory } from "../services/cloudwatch.service";
import * as InfrastructureService from "../services/infrastructure.service";
import { logger } from "../utils/logger";
import { CpuDatapoint, TagsType } from "../utils/types";

const MANAGED_TAG_KEY = process.env.MANAGED_TAG_KEY ?? "ProScale";
const MANAGED_TAG_VALUE = process.env.MANAGED_TAG_VALUE ?? "true";

// ✅ You chose 5-min period
const PERIOD_SEC = 300;

// How much history to export for training.
// For dissertation MVP, 1–3 days is already enough.
// You can increase later to 7 days.
const DAYS_BACK = Number(process.env.DATA_DAYS_BACK ?? "3");

// We'll fetch in 24h chunks to avoid CloudWatch datapoint limits.
const CHUNK_MINUTES = 24 * 60;

export interface FleetRow {
  fleet_avg: number;
  fleet_p95: number;
  sample_count: number;
  timestamp: string; // ISO
}

export async function exportFleetCpuDataset(): Promise<void> {
  // 1) List managed instances (tag filter)
  const instances = (await InfrastructureService.listInstances()) ?? [];

  const managed = instances.filter(
    (i) =>
      Array.isArray(i.tags) &&
      i.tags.some(
        (t: TagsType) =>
          t.Key === MANAGED_TAG_KEY && t.Value === MANAGED_TAG_VALUE,
      ) &&
      i.id,
  );

  if (!managed.length) {
    logger.error(
      { MANAGED_TAG_KEY, MANAGED_TAG_VALUE },
      "No managed instances found. Tag your EC2s first.",
    );
    process.exit(1);
  }

  const instanceIds = managed.map((m) => m.id).filter(Boolean);

  logger.info(
    { DAYS_BACK, instanceIds, PERIOD_SEC },
    "Exporting fleet CPU dataset",
  );

  // 2) Fetch CPU history for each instance and build timestamp->values map
  // We'll fetch progressively: 24h, 48h, ... DAYS_BACK days
  // CloudWatch returns datapoints up to `minutesBack`, so we’ll fetch max range once per instance for simplicity.
  // With PERIOD 300s: 3 days = 864 datapoints per instance (fine).
  const minutesBack = DAYS_BACK * CHUNK_MINUTES;

  const perInstanceSeries: Record<string, CpuDatapoint[]> = {};

  for (const id of instanceIds) {
    logger.info({ id, minutesBack }, "Fetching CPU history for instance");
    const points = await fetchInstanceCpuChunk(id, minutesBack);
    perInstanceSeries[id] = points;
    logger.info({ count: points.length, id }, "Fetched points");
  }

  // 3) Align by timestamp (ISO) and compute fleet aggregates
  const timestampToValues = new Map<string, number[]>();

  for (const [id, points] of Object.entries(perInstanceSeries)) {
    for (const dp of points) {
      // Normalize to ISO string so different instances align.
      // CloudWatch timestamps are typically already aligned to 5-min boundaries.
      const ts = dp.timestamp.toISOString();
      const arr = timestampToValues.get(ts) ?? [];
      arr.push(dp.average);
      timestampToValues.set(ts, arr);
    }
    logger.info({ id }, "Added instance points to fleet map");
  }

  const rows: FleetRow[] = [];
  for (const [ts, values] of timestampToValues.entries()) {
    rows.push({
      fleet_avg: mean(values),
      fleet_p95: percentile(values, 95),
      sample_count: values.length,
      timestamp: ts,
    });
  }

  // sort time ascending
  rows.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // 4) Write CSV
  const outDir = path.resolve(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(
    outDir,
    `fleet_cpu_${DAYS_BACK.toString()}d_p${PERIOD_SEC.toString()}.csv`,
  );

  const header = "timestamp,fleet_avg,fleet_p95,sample_count\n";
  const body = rows
    .map(
      (r) =>
        `${r.timestamp},${r.fleet_avg.toFixed(4)},${r.fleet_p95.toFixed(4)},${r.sample_count.toString()}`,
    )
    .join("\n");

  fs.writeFileSync(outPath, header + body + "\n", "utf8");

  logger.info({ outPath, rowCount: rows.length }, "✅ Fleet dataset exported");
}

async function fetchInstanceCpuChunk(
  instanceId: string,
  minutesBack: number,
): Promise<CpuDatapoint[]> {
  // getEc2CpuHistory uses minutesBack relative to now.
  // We'll call it multiple times and stitch results.
  return getEc2CpuHistory(instanceId, minutesBack, PERIOD_SEC);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0;
}

// Allow running via node
if (require.main === module) {
  void exportFleetCpuDataset().then(() => process.exit(0));
}

// // backend/src/scripts/exportFleetCpuDataset.ts
// import fs from "node:fs";
// import path from "node:path";

// import { getEc2CpuHistoryRange } from "../services/cloudwatch.service";
// import * as InfrastructureService from "../services/infrastructure.service";
// import { logger } from "../utils/logger";
// import { CpuDatapoint, TagsType } from "../utils/types";

// const MANAGED_TAG_KEY = process.env.MANAGED_TAG_KEY ?? "ProScale";
// const MANAGED_TAG_VALUE = process.env.MANAGED_TAG_VALUE ?? "true";

// const PERIOD_SEC = 300;
// const MAX_POINTS = 1440;
// const MAX_RANGE_MS = MAX_POINTS * PERIOD_SEC * 1000;

// const DAYS_BACK = Number(process.env.DATA_DAYS_BACK ?? "3");

// const CHUNK_MINUTES = 24 * 60;

// export interface FleetRow {
//   fleet_avg: number;
//   fleet_p95: number;
//   sample_count: number;
//   timestamp: string; // ISO
// }

// export async function exportFleetCpuDataset(): Promise<void> {
//   const instances = (await InfrastructureService.listInstances()) ?? [];

//   const managed = instances.filter(
//     (i) =>
//       Array.isArray(i.tags) &&
//       i.tags.some(
//         (t: TagsType) =>
//           t.Key === MANAGED_TAG_KEY && t.Value === MANAGED_TAG_VALUE,
//       ) &&
//       i.id,
//   );

//   if (!managed.length) {
//     logger.error(
//       { MANAGED_TAG_KEY, MANAGED_TAG_VALUE },
//       "No managed instances found. Tag your EC2s first.",
//     );
//     process.exit(1);
//   }

//   const instanceIds = managed.map((m) => m.id).filter(Boolean);

//   logger.info(
//     { DAYS_BACK, instanceIds, PERIOD_SEC },
//     "Exporting fleet CPU dataset",
//   );

//   const minutesBack = DAYS_BACK * CHUNK_MINUTES;

//   const perInstanceSeries: Record<string, CpuDatapoint[]> = {};

//   for (const id of instanceIds) {
//     logger.info({ id, minutesBack }, "Fetching CPU history for instance");
//     const points = await fetchCpuInChunks(id, minutesBack);
//     perInstanceSeries[id] = points;
//     logger.info({ count: points.length, id }, "Fetched points");
//   }

//   const timestampToValues = new Map<string, number[]>();

//   for (const [id, points] of Object.entries(perInstanceSeries)) {
//     for (const dp of points) {
//       const ts = dp.timestamp.toISOString();
//       const arr = timestampToValues.get(ts) ?? [];
//       arr.push(dp.average);
//       timestampToValues.set(ts, arr);
//     }
//     logger.info({ id }, "Added instance points to fleet map");
//   }

//   const rows: FleetRow[] = [];
//   for (const [ts, values] of timestampToValues.entries()) {
//     rows.push({
//       fleet_avg: mean(values),
//       fleet_p95: percentile(values, 95),
//       sample_count: values.length,
//       timestamp: ts,
//     });
//   }

//   rows.sort(
//     (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
//   );

//   const outDir = path.resolve(process.cwd(), "data");
//   fs.mkdirSync(outDir, { recursive: true });

//   const outPath = path.join(
//     outDir,
//     `fleet_cpu_${DAYS_BACK.toString()}d_p${PERIOD_SEC.toString()}.csv`,
//   );

//   const header = "timestamp,fleet_avg,fleet_p95,sample_count\n";
//   const body = rows
//     .map(
//       (r) =>
//         `${r.timestamp},${r.fleet_avg.toFixed(4)},${r.fleet_p95.toFixed(4)},${r.sample_count.toString()}`,
//     )
//     .join("\n");

//   fs.writeFileSync(outPath, header + body + "\n", "utf8");

//   logger.info({ outPath, rowCount: rows.length }, "✅ Fleet dataset exported");
// }

// async function fetchCpuInChunks(instanceId: string, daysBack: number) {
//   const endGlobal = new Date();
//   const startGlobal = new Date(
//     endGlobal.getTime() - daysBack * 24 * 60 * 60 * 1000,
//   );

//   const all: { average: number; timestamp: Date }[] = [];

//   let chunkEnd = endGlobal;

//   while (chunkEnd.getTime() > startGlobal.getTime()) {
//     const chunkStart = new Date(
//       Math.max(startGlobal.getTime(), chunkEnd.getTime() - MAX_RANGE_MS),
//     );

//     const chunk = await getEc2CpuHistoryRange(
//       instanceId,
//       chunkStart,
//       chunkEnd,
//       PERIOD_SEC,
//     );
//     all.push(...chunk);

//     // move backwards
//     chunkEnd = chunkStart;
//   }

//   // Deduplicate by timestamp (chunks can overlap at boundaries)
//   const dedup = new Map<number, number>();
//   for (const p of all) dedup.set(p.timestamp.getTime(), p.average);

//   return [...dedup.entries()]
//     .map(([ts, avg]) => ({ average: avg, timestamp: new Date(ts) }))
//     .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
// }

// function mean(values: number[]): number {
//   if (!values.length) return 0;
//   return values.reduce((s, v) => s + v, 0) / values.length;
// }

// // Allow running via node
// if (require.main === module) {
//   void exportFleetCpuDataset().then(() => process.exit(0));
// }

// function percentile(values: number[], p: number): number {
//   if (!values.length) return 0;
//   const sorted = [...values].sort((a, b) => a - b);
//   const idx = Math.ceil((p / 100) * sorted.length) - 1;
//   return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0;
// }

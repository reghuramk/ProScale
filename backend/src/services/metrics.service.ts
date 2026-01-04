import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const desiredInstancesGauge = new client.Gauge({
  help: "Desired instance count decided by autoscaler",
  name: "proscale_desired_instances",
});
export const runningInstancesGauge = new client.Gauge({
  help: "Current running instance count (managed only)",
  name: "proscale_running_instances",
});
export const ec2CpuGauge = new client.Gauge({
  help: "Latest EC2 CPU average used as ML input",
  name: "proscale_ec2_cpu_latest",
});

export const ticksTotal = new client.Counter({
  help: "Number of autoscaler ticks executed",
  labelNames: ["mode"] as const,
  name: "proscale_ticks_total",
});

export const scaleActionsTotal = new client.Counter({
  help: "Number of scaling actions executed by autoscaler",
  labelNames: ["mode", "action", "result"] as const,
  name: "proscale_scale_actions_total",
  // action: "start" | "stop" | "noop"
  // result: "success" | "error"
});

export const tickDurationMs = new client.Histogram({
  buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
  help: "Duration of autoscaler tick in milliseconds",
  labelNames: ["mode"] as const,
  name: "proscale_tick_duration_ms",
});

register.registerMetric(desiredInstancesGauge);
register.registerMetric(runningInstancesGauge);
register.registerMetric(ec2CpuGauge);

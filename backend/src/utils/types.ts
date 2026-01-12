export interface CpuDatapoint {
  average: number;
  timestamp: Date;
}
export interface FleetFeaturesPayload {
  avg_lag_1: number;
  avg_lag_2: number;
  avg_lag_3: number;

  avg_lag_4: number;
  avg_lag_5: number;
  avg_lag_6: number;
  avg_roll_mean_30m: number;
  avg_roll_mean_60m: number;
  avg_roll_std_30m: number;

  avg_slope_30m: number;
  dow: number;
  fleet_avg: number;
  fleet_p95: number;
  hour: number;
  p95_lag_1: number;

  p95_lag_2: number;
  p95_lag_3: number;
  p95_lag_4: number;
  p95_lag_5: number;

  p95_lag_6: number;
  p95_roll_mean_30m: number;

  p95_roll_mean_60m: number;
  p95_roll_std_30m: number;

  p95_slope_30m: number;
  sample_count: number;
}

export interface GoogleSigninResponseType {
  email: string;
  googleId: string;
  name: string;
  picture: string;
}
export interface InstanceIdType {
  instanceId: string;
}

export interface InstanceInfoType {
  id: string;
  launchTime?: Date;
  state?: string;
  tags?: TagsType;
  type?: string;
}

export interface MlPrediction {
  desired_instances: number;
  reason: string;
}

export interface MlPredictionResponse {
  action: "none" | "scale_down" | "scale_up";
  predicted_cpu_5m: number;
  reason: string;
  recommended_instances: number;
}

export interface options {
  colorize?: boolean;
  resourceAttributes: resourceAttribute;
  translateTime?: string;
}

export interface PinoOptionsType {
  level: string;
  transport?: transportType;
}

export interface PrometheusResponse {
  data?: {
    result?: {
      value?: [number, string];
    }[];
  };
}

export interface RegisterResponseType {
  accessToken: string;
  refreshToken: string;
  user: UserType;
}

export type resourceAttribute = Record<string, string>;
export interface TagsType {
  Key?: string;
  Value?: string;
}
export interface transportType {
  options?: options;
  target: string;
}

export interface UserType {
  email: string;
  id?: string;
  idToken?: string;
  name?: string;
  password?: string;
  provider?: string;
  sex?: "female" | "male" | "other";
}

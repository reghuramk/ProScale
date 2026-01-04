export interface CpuDatapoint {
  average: number;
  timestamp: Date;
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
  predicted_cpu: number;
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

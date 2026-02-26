import {
  ListTopicsCommandOutput,
  ListSubscriptionsCommandOutput,
  CreateTopicCommandOutput,
  PublishCommandOutput,
} from "@aws-sdk/client-sns";

export type IDebug = (msg: unknown, stack?: unknown) => void;

export interface ILambdaContext {
  done: (err: Error | null, result?: unknown) => void;
  succeed: (result: unknown) => void;
  fail: (err: Error) => void;
  getRemainingTimeInMillis: () => number;
  functionName: string;
  memoryLimitInMB: number;
  functionVersion: string;
  invokedFunctionArn: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  identity: Record<string, unknown>;
  clientContext: Record<string, unknown>;
}

export type LambdaCallback = (err: Error | null, result?: unknown) => void;

export type SLSHandler = (
  event: unknown,
  ctx: ILambdaContext,
  cb: LambdaCallback
) => unknown;

export type SnsEventConfig =
  | string
  | {
      topicName?: string;
      arn?: string;
      rawMessageDelivery?: string;
      filterPolicy?: Record<string, unknown[]>;
      protocol?: string;
      queueName?: string;
    };

export interface IServerlessFunction {
  name?: string;
  handler?: string;
  runtime?: string;
  timeout?: number;
  memorySize?: number;
  environment?: Record<string, string>;
  events: Array<{ sns?: SnsEventConfig } | Record<string, unknown>>;
}

export interface IServerless {
  service: {
    service?: string;
    provider: {
      region: string;
      stage?: string;
      runtime?: string;
      environment?: Record<string, string>;
    };
    functions: Record<string, IServerlessFunction>;
    custom: Record<string, unknown>;
    resources?: {
      Resources?: Record<string, Record<string, unknown>>;
    };
  };
  config: {
    servicePath?: string;
  };
  cli: {
    log: (msg: string) => void;
  };
}

export interface IServerlessOptions {
  location?: string;
  host?: string;
  s?: string;
  stage?: string;
  b?: string;
  binPath?: string;
  [key: string]: string | undefined;
}

export interface ServerlessOfflineSnsConfig {
  port?: number;
  localPort?: number;
  remotePort?: number;
  accountId?: string;
  servicesDirectory?: string;
  location?: string;
  host?: string;
  debug?: boolean;
  autoSubscribe?: boolean;
  "sns-endpoint"?: string;
  "sns-subscribe-endpoint"?: string;
  "sqsEndpoint"?: string;
  lambdaPort?: number;
  subscriptions?: Array<{ queue: string; topic: string }>;
  retry?: number;
  "retry-interval"?: number;
}

export interface ISNSAdapter {
  listTopics(): Promise<ListTopicsCommandOutput>;
  listSubscriptions(): Promise<ListSubscriptionsCommandOutput>;
  unsubscribe(arn: string): Promise<void>;
  createTopic(topicName: string): Promise<CreateTopicCommandOutput>;
  subscribe(
    fn: IServerlessFunction,
    handler: SLSHandler,
    arn: string,
    snsConfig: SnsEventConfig
  ): Promise<void>;
  subscribeQueue(queueUrl: string, arn: string, snsConfig: SnsEventConfig): Promise<void>;
  publish(
    topicArn: string,
    message: string
  ): Promise<PublishCommandOutput>;
}

export type ISNSAdapterConstructable = new (
  endpoint: string,
  port: number,
  region: string,
  debug: IDebug
) => ISNSAdapter;

export interface ISNSServer {
  routes(): void;
}

export type MessageAttributes = Record<string, IMessageAttribute>;

export interface IMessageAttribute {
  Type: string;
  Value: string;
}

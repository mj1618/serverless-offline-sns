import { SNSAdapter } from "./sns-adapter.js";
import express, { type Application } from "express";
import type { Server } from "http";
import cors from "cors";
import { ISNSAdapter, IServerless, IServerlessFunction, IServerlessOptions, ServerlessOfflineSnsConfig, SLSHandler, SnsEventConfig } from "./types.js";
import { SNSServer } from "./sns-server.js";
import _ from "lodash";
import { topicNameFromArn } from "./helpers.js";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import lodashfp from 'lodash/fp.js';
const { get, has } = lodashfp;

interface ResourceSubscription {
  fnName: string | undefined;
  options: {
    topicName: string;
    protocol: string;
    rawMessageDelivery: string;
    filterPolicy: Record<string, unknown[]> | undefined;
    filterPolicyScope?: string;
    queueName?: string;
  };
}

class ServerlessOfflineSns {
  private config: ServerlessOfflineSnsConfig = {};
  private serverless: IServerless;
  public commands: object;
  private localPort: number = 4002;
  private remotePort: number = 4002;
  public hooks: object;
  private _snsAdapter: ISNSAdapter | undefined;
  private app: Application;
  private server: Server | undefined;
  private options: IServerlessOptions;
  private location: string = "";
  private region: string = "";
  private accountId: string = "123456789012";
  private autoSubscribe: boolean = true;

  private get adapter(): ISNSAdapter {
    if (!this._snsAdapter) {
      throw new Error("SNS adapter not initialised — call start() first");
    }
    return this._snsAdapter;
  }

  constructor(serverless: IServerless, options: IServerlessOptions = {}) {
    this.app = express();
    this.app.use(cors());
    this.app.use((req, res, next) => {
      // fix for https://github.com/s12v/sns/issues/45 not sending content-type
      req.headers["content-type"] = req.headers["content-type"] || "text/plain";
      next();
    });
    this.app.use(express.json({ type: ["application/json", "text/plain"], limit: "10mb" }));
    this.options = options;
    this.serverless = serverless;

    this.commands = {
      "offline-sns": {
        usage:
          "Listens to offline SNS events and passes them to configured Lambda fns",
        lifecycleEvents: ["start", "cleanup"],
        commands: {
          start: {
            lifecycleEvents: ["init", "end"],
          },
          cleanup: {
            lifecycleEvents: ["init"],
          },
        },
      },
    };

    this.hooks = {
      "before:offline:start": () => this.start(),
      "before:offline:start:init": () => this.start(),
      "after:offline:start:end": () => this.stop(),
      "offline-sns:start:init": () => {
        this.start();
        return this.waitForSigint();
      },
      "offline-sns:cleanup:init": async () => {
        this.init();
        this.setupSnsAdapter();
        return this.unsubscribeAll();
      },
      "offline-sns:start:end": () => this.stop(),
    };
  }

  public init() {
    process.env = _.extend(
      {},
      process.env,
      this.serverless.service.provider.environment
    );
    this.config =
      (this.serverless.service.custom["serverless-offline-sns"] as ServerlessOfflineSnsConfig) || {};
    this.localPort = this.config.port || this.config.localPort || 4002;
    this.remotePort = this.config.port || this.config.remotePort || 4002;
    this.accountId = this.config.accountId || "123456789012";
    const offlineConfig =
      (this.serverless.service.custom["serverless-offline"] || {}) as { location?: string };
    this.location = process.cwd();
    const locationRelativeToCwd =
      this.options.location || this.config.location || offlineConfig.location;
    if (locationRelativeToCwd) {
      this.location = process.cwd() + "/" + locationRelativeToCwd;
    } else if (this.serverless.config.servicePath) {
      this.location = this.serverless.config.servicePath;
    }
    if (this.serverless.service.provider.region) {
      this.region = this.serverless.service.provider.region;
    } else {
      this.region = "us-east-1";
    }
    this.autoSubscribe = this.config.autoSubscribe === undefined ? true : this.config.autoSubscribe;
  }

  public async start() {
    this.init();
    await this.listen();
    await this.serve();
    await this.subscribeAll();
    return this.adapter;
  }

  public async waitForSigint() {
    return new Promise((res) => {
      process.on("SIGINT", () => {
        this.log("Halting offline-sns server");
        res(true);
      });
    });
  }

  public async serve() {
    new SNSServer(
      (msg, ctx) => this.debug(msg, ctx),
      this.app,
      this.region,
      this.accountId,
      this.config.retry ?? 0,
      this.config["retry-interval"] ?? 0
    );
  }

  private getFunctionName(name: string): string | undefined {
    let result: string | undefined;
    Object.entries(this.serverless.service.functions).forEach(
      ([funcName, funcValue]) => {
        const events = get(["events"], funcValue);
        if (events) events.forEach((event: Record<string, unknown>) => {
            const attribute = get(["sqs", "arn"], event);
            if (!has("Fn::GetAtt", attribute)) return;
            const [resourceName, value] = attribute["Fn::GetAtt"];
            if (value !== "Arn") return;
            if (name !== resourceName) return;
            result = funcName;
          });
      }
    );
    return result;
  }

  private getResourceSubscriptions(serverless: IServerless): ResourceSubscription[] {
    const resources = serverless.service.resources?.Resources;
    const subscriptions: ResourceSubscription[] = [];
    if (!resources) return subscriptions;
    new Map(Object.entries(resources)).forEach((value, key) => {
      let type = get(["Type"], value);
      if (type !== "AWS::SNS::Subscription") return;

      const endPoint = get(["Properties", "Endpoint"], value);
      if (!has("Fn::GetAtt", endPoint)) return;

      const [resourceName, attribute] = endPoint["Fn::GetAtt"];
      type = get(["Type"], resources[resourceName]);
      if (attribute !== "Arn") return;
      if (type !== "AWS::SQS::Queue") return;

      const queueName = get(["Properties", "QueueName"], resources[resourceName]) as string | undefined;
      const filterPolicy = get(["Properties", "FilterPolicy"], value) as Record<string, unknown[]> | undefined;
      const filterPolicyScope = get(["Properties", "FilterPolicyScope"], value) as string | undefined;
      const protocol = get(["Properties", "Protocol"], value) as string;
      const rawMessageDelivery = get(
        ["Properties", "RawMessageDelivery"],
        value
      ) as string;
      const topicArn = get(["Properties", "TopicArn", "Ref"], value) as string;
      const topicName = get(["Properties", "TopicName"], resources[topicArn]) as string;
      const fnName = this.getFunctionName(resourceName as string);

      if(!topicName){
        this.log(`${key} does not have a topic name, skipping`);
        return;
      }

      // SQS-protocol subscriptions don't require a direct Lambda function —
      // the Lambda is triggered by SQS separately.
      if(protocol?.toLowerCase() !== "sqs" && !fnName){
        this.log(`${topicName} does not have a function, skipping`);
        return;
      }
      subscriptions.push({
        fnName,
        options: {
          topicName,
          protocol,
          queueName,
          rawMessageDelivery,
          filterPolicy,
          filterPolicyScope,
        },
      });
    });
    return subscriptions;
  }

  public async subscribeAll() {
    this.setupSnsAdapter();
    await this.unsubscribeAll();
    this.debug("subscribing functions");
    const subscribePromises: Array<Promise<unknown>> = [];
    if (this.autoSubscribe) {
      const subscriptions = this.getResourceSubscriptions(this.serverless);
      subscriptions.forEach((subscription) =>
        subscribePromises.push(
          this.subscribeFromResource(subscription, this.location)
        )
      );
      Object.keys(this.serverless.service.functions).map((fnName) => {
        const fn = this.serverless.service.functions[fnName];
        subscribePromises.push(
          Promise.all(
            fn.events
              .filter((event): event is { sns: SnsEventConfig } => event.sns != null)
              .map((event) => {
                return this.subscribe(
                  this.serverless,
                  fnName,
                  event.sns,
                  this.location
                );
              })
          )
        );
      });
    }
    await this.subscribeAllQueues(subscribePromises);
  }

  private async subscribeAllQueues(subscribePromises: Array<Promise<unknown>>) {
    await Promise.all(subscribePromises);
    this.debug("subscribing queues");
    await Promise.all(
      (this.config.subscriptions || []).map((sub) => {
        return this.subscribeQueue(sub.queue, sub.topic);
      })
    );
  }

  private async subscribeFromResource(subscription: ResourceSubscription, location: string) {
    this.debug("subscribe: " + subscription.fnName);
    this.log(
      `Creating topic: "${subscription.options.topicName}" for fn "${subscription.fnName ?? "(sqs)"}"`
    );
    const data = await this.adapter.createTopic(
      subscription.options.topicName
    );
    this.debug("topic: " + JSON.stringify(data));
    if (!data.TopicArn) {
      throw new Error(`createTopic did not return a TopicArn for "${subscription.options.topicName}"`);
    }

    if (subscription.options.protocol?.toLowerCase() === "sqs") {
      const sqsBase = this.config["sqsEndpoint"] || `http://127.0.0.1:${this.localPort}`;
      const queueUrl = subscription.options.queueName
        ? `${sqsBase}/queue/${subscription.options.queueName}`
        : sqsBase;
      await this.adapter.subscribeQueue(queueUrl, data.TopicArn, subscription.options);
    } else {
      const fn = this.serverless.service.functions[subscription.fnName!];
      const handler = await this.createHandler(subscription.fnName!, fn, location);
      await this.adapter.subscribe(fn, handler, data.TopicArn, subscription.options);
    }
  }

  public async unsubscribeAll() {
    const subs = await this.adapter.listSubscriptions();
    this.debug("subs!: " + JSON.stringify(subs));
    await Promise.all(
      (subs.Subscriptions ?? [])
        .filter((sub) => sub.Endpoint != null && sub.Endpoint.indexOf(":" + this.remotePort) > -1)
        .filter((sub): sub is typeof sub & { SubscriptionArn: string } =>
          sub.SubscriptionArn != null && sub.SubscriptionArn !== "PendingConfirmation"
        )
        .map((sub) => this.adapter.unsubscribe(sub.SubscriptionArn))
    );
  }

  public async subscribe(serverless: IServerless, fnName: string, snsConfig: SnsEventConfig, lambdasLocation: string) {
    this.debug("subscribe: " + fnName);
    const fn = serverless.service.functions[fnName];

    if (!fn.runtime) {
      fn.runtime = serverless.service.provider.runtime;
    }

    let topicName = "";

    // https://serverless.com/framework/docs/providers/aws/events/sns#using-a-pre-existing-topic
    if (typeof snsConfig === "string") {
      if (snsConfig.indexOf("arn:aws:sns") === 0) {
        topicName = topicNameFromArn(snsConfig);
      } else {
        topicName = snsConfig;
      }
    } else if (snsConfig.topicName && typeof snsConfig.topicName === "string") {
      topicName = snsConfig.topicName;
    } else if (snsConfig.arn && typeof snsConfig.arn === "string") {
      topicName = topicNameFromArn(snsConfig.arn);
    }

    if (!topicName) {
      this.log(
        `Unable to create topic for "${fnName}". Please ensure the sns configuration is correct.`
      );
      return Promise.resolve(
        `Unable to create topic for "${fnName}". Please ensure the sns configuration is correct.`
      );
    }

    this.log(`Creating topic: "${topicName}" for fn "${fnName}"`);
    const data = await this.adapter.createTopic(topicName);
    this.debug("topic: " + JSON.stringify(data));
    if (!data.TopicArn) {
      throw new Error(`createTopic did not return a TopicArn for "${topicName}"`);
    }
    const handler = await this.createHandler(fnName, fn, lambdasLocation);
    await this.adapter.subscribe(
      fn,
      handler,
      data.TopicArn,
      snsConfig
    );
  }

  public async subscribeQueue(queueUrl: string, snsConfig: SnsEventConfig) {
    this.debug("subscribe: " + queueUrl);
    let topicName = "";

    // https://serverless.com/framework/docs/providers/aws/events/sns#using-a-pre-existing-topic
    if (typeof snsConfig === "string") {
      if (snsConfig.indexOf("arn:aws:sns") === 0) {
        topicName = topicNameFromArn(snsConfig);
      } else {
        topicName = snsConfig;
      }
    } else if (snsConfig.topicName && typeof snsConfig.topicName === "string") {
      topicName = snsConfig.topicName;
    } else if (snsConfig.arn && typeof snsConfig.arn === "string") {
      topicName = topicNameFromArn(snsConfig.arn);
    }

    if (!topicName) {
      this.log(
        `Unable to create topic for "${queueUrl}". Please ensure the sns configuration is correct.`
      );
      return Promise.resolve(
        `Unable to create topic for "${queueUrl}". Please ensure the sns configuration is correct.`
      );
    }

    this.log(`Creating topic: "${topicName}" for queue "${queueUrl}"`);
    const data = await this.adapter.createTopic(topicName);
    this.debug("topic: " + JSON.stringify(data));
    if (!data.TopicArn) {
      throw new Error(`createTopic did not return a TopicArn for "${topicName}"`);
    }
    await this.adapter.subscribeQueue(queueUrl, data.TopicArn, snsConfig);
  }

  public async createHandler(fnName: string, fn: IServerlessFunction, _location: string): Promise<SLSHandler> {
    return this.createInvokeCommandHandler(fnName);
  }

  public createInvokeCommandHandler(fnName: string): SLSHandler {
    const lambdaPort = this.config.lambdaPort ?? 3002;
    const service = this.serverless.service.service ?? "";
    const stage = this.serverless.service.provider.stage ?? "dev";
    const functionName = `${service}-${stage}-${fnName}`;
    const client = new LambdaClient({
      endpoint: `http://127.0.0.1:${lambdaPort}`,
      region: this.region,
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    });

    return (event: unknown, _ctx: unknown, cb: (err: Error | null, result?: unknown) => void) => {
      const payload = new TextEncoder().encode(JSON.stringify(event));
      client.send(new InvokeCommand({ FunctionName: functionName, Payload: payload }))
        .then((response) => {
          const result = response.Payload ? JSON.parse(new TextDecoder().decode(response.Payload)) : null;
          cb(null, result);
        })
        .catch((err: Error) => {
          this.log(`ERROR invoking ${functionName}: ${err.message}`, "ERROR[serverless-offline-sns]: ");
          cb(err);
        });
    };
  }

  public log(msg: string, prefix = "INFO[serverless-offline-sns]: ") {
    this.serverless.cli.log.call(this.serverless.cli, prefix + msg);
  }

  public debug(msg: unknown, context?: unknown) {
    if (this.config.debug) {
      if (context) {
        this.log(String(msg), `DEBUG[serverless-offline-sns][${context}]: `);
      } else {
        this.log(String(msg), "DEBUG[serverless-offline-sns]: ");
      }
    }
  }

  public async listen() {
    this.debug("starting plugin");
    let host = "127.0.0.1";
    if (this.config.host) {
      this.debug(`using specified host ${this.config.host}`);
      host = this.config.host;
    } else if (this.options.host) {
      this.debug(`using offline specified host ${this.options.host}`);
      host = this.options.host;
    }
    return new Promise((res) => {
      this.server = this.app.listen(this.localPort, host, () => {
        this.debug(`listening on ${host}:${this.localPort}`);
        res(true);
      });
      this.server.setTimeout(0);
    });
  }

  public async stop() {
    this.init();
    this.debug("stopping plugin");
    if (this.server) {
      const server = this.server;
      await new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    }
  }

  private setupSnsAdapter() {
    this._snsAdapter = new SNSAdapter(
      this.localPort,
      this.remotePort,
      this.serverless.service.provider.region,
      this.config["sns-endpoint"] || "",
      (msg, ctx) => this.debug(msg, ctx),
      this.app,
      this.serverless.service.service || "",
      this.serverless.service.provider.stage || "",
      this.accountId,
      this.config.host || "",
      this.config["sns-subscribe-endpoint"] || "",
      this.config["sqsEndpoint"] || ""
    );
  }
}

export default ServerlessOfflineSns;

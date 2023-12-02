import * as shell from "shelljs";

import { SNSAdapter } from "./sns-adapter.js";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ISNSAdapter } from "./types.js";
import { SNSServer } from "./sns-server.js";
import _ from "lodash";
import AWS from "aws-sdk";
import { topicNameFromArn } from "./helpers.js";

import lodashfp from 'lodash/fp.js';
const { get, has } = lodashfp;

import { loadServerlessConfig } from "./sls-config-parser.js";

class ServerlessOfflineSns {
  private config: any;
  private serverless: any;
  public commands: object;
  private localPort: number;
  private remotePort: number;
  public hooks: object;
  private snsAdapter: ISNSAdapter;
  private app: any;
  private snsServer: any;
  private server: any;
  private options: any;
  private location: string;
  private region: string;
  private accountId: string;
  private servicesDirectory: string;
  private autoSubscribe: boolean;

  constructor(serverless: any, options: any = {}) {
    this.app = express();
    this.app.use(cors());
    this.app.use((req, res, next) => {
      // fix for https://github.com/s12v/sns/issues/45 not sending content-type
      req.headers["content-type"] = req.headers["content-type"] || "text/plain";
      next();
    });
    this.app.use(
      bodyParser.json({
        type: ["application/json", "text/plain"],
        limit: "10mb",
      })
    );
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
      this.serverless.service.custom["serverless-offline-sns"] || {};
    this.localPort = this.config.port || this.config.localPort || 4002;
    this.remotePort = this.config.port || this.config.remotePort || 4002;
    this.accountId = this.config.accountId || "123456789012";
    const offlineConfig =
      this.serverless.service.custom["serverless-offline"] || {};
    this.servicesDirectory = this.config.servicesDirectory || "";
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
    // Congure SNS client to be able to find us.
    AWS.config.sns = {
      endpoint: "http://127.0.0.1:" + this.localPort,
      region: this.region,
    };
  }

  public async start() {
    this.init();
    await this.listen();
    await this.serve();
    await this.subscribeAll();
    return this.snsAdapter;
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
    this.snsServer = new SNSServer(
      (msg, ctx) => this.debug(msg, ctx),
      this.app,
      this.region,
      this.accountId
    );
  }
  
  private getFunctionName(name) {
    let result;
    Object.entries(this.serverless.service.functions).forEach(
      ([funcName, funcValue]) => {
        const events = get(["events"], funcValue);
        events &&
          events.forEach((event) => {
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

  private getResourceSubscriptions(serverless) {
    const resources = serverless.service.resources?.Resources;
    const subscriptions = [];
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

      const filterPolicy = get(["Properties", "FilterPolicy"], value);
      const protocol = get(["Properties", "Protocol"], value);
      const rawMessageDelivery = get(
        ["Properties", "RawMessageDelivery"],
        value
      );
      const topicArn = get(["Properties", "TopicArn", "Ref"], value);
      const topicName = get(["Properties", "TopicName"], resources[topicArn]);
      const fnName = this.getFunctionName(resourceName);

      if(!topicName){
        this.log(`${fnName} does not have a topic name, skipping`);
        return;
      }

      if(!fnName){
        this.log(`${topicName} does not have a function, skipping`);
        return;
      }
      subscriptions.push({
        fnName,
        options: {
          topicName,
          protocol,
          rawMessageDelivery,
          filterPolicy,
        },
      });
    });
    return subscriptions;
  }
  public async subscribeAll() {
    this.setupSnsAdapter();
    await this.unsubscribeAll();
    this.debug("subscribing functions");
    const subscribePromises: Array<Promise<any>> = [];
    if (this.autoSubscribe) {
      if (this.servicesDirectory) {
        shell.cd(this.servicesDirectory);
        for (const directory of shell.ls("-d", "*/")) {
          shell.cd(directory);
          const service = directory.split("/")[0];
          const serverless = await loadServerlessConfig(shell.pwd().toString(), this.debug);
          this.debug("Processing subscriptions for ", service);
          this.debug("shell.pwd()", shell.pwd());
          this.debug("serverless functions", JSON.stringify(serverless.service.functions));
          const subscriptions = this.getResourceSubscriptions(serverless);
          subscriptions.forEach((subscription) =>
            subscribePromises.push(
              this.subscribeFromResource(subscription, this.location)
            )
          );
          Object.keys(serverless.service.functions).map((fnName) => {
            const fn = serverless.service.functions[fnName];
            subscribePromises.push(
              Promise.all(
                fn.events
                  .filter((event) => event.sns != null)
                  .map((event) => {
                    return this.subscribe(
                      serverless,
                      fnName,
                      event.sns,
                      shell.pwd()
                    );
                  })
              )
            );
          });
          shell.cd("../");
        }
      } else {
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
                .filter((event) => event.sns != null)
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
    }
    await this.subscribeAllQueues(subscribePromises);
  }

  private async subscribeAllQueues(subscribePromises) {
    await Promise.all(subscribePromises);
    this.debug("subscribing queues");
    await Promise.all(
      (this.config.subscriptions || []).map((sub) => {
        return this.subscribeQueue(sub.queue, sub.topic);
      })
    );
  }

  private async subscribeFromResource(subscription, location) {
    this.debug("subscribe: " + subscription.fnName);
    this.log(
      `Creating topic: "${subscription.options.topicName}" for fn "${subscription.fnName}"`
    );
    const data = await this.snsAdapter.createTopic(
      subscription.options.topicName
    );
    this.debug("topic: " + JSON.stringify(data));
    const fn = this.serverless.service.functions[subscription.fnName];
    await this.snsAdapter.subscribe(
      fn, location,
      data.TopicArn,
      subscription.options
    );
  }
  public async unsubscribeAll() {
    const subs = await this.snsAdapter.listSubscriptions();
    this.debug("subs!: " + JSON.stringify(subs));
    await Promise.all(
      subs.Subscriptions.filter(
        (sub) => sub.Endpoint.indexOf(":" + this.remotePort) > -1
      )
        .filter((sub) => sub.SubscriptionArn !== "PendingConfirmation")
        .map((sub) => this.snsAdapter.unsubscribe(sub.SubscriptionArn))
    );
  }

  public async subscribe(serverless, fnName, snsConfig, lambdasLocation) {
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
    const data = await this.snsAdapter.createTopic(topicName);
    this.debug("topic: " + JSON.stringify(data));
    await this.snsAdapter.subscribe(
      fn, lambdasLocation,
      data.TopicArn,
      snsConfig
    );
  }

  public async subscribeQueue(queueUrl, snsConfig) {
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
    const data = await this.snsAdapter.createTopic(topicName);
    this.debug("topic: " + JSON.stringify(data));
    await this.snsAdapter.subscribeQueue(queueUrl, data.TopicArn, snsConfig);
  }

  public log(msg, prefix = "INFO[serverless-offline-sns]: ") {
    this.serverless.cli.log.call(this.serverless.cli, prefix + msg);
  }

  public debug(msg, context?: string) {
    if (this.config.debug) {
      if (context) {
        this.log(msg, `DEBUG[serverless-offline-sns][${context}]: `);
      } else {
        this.log(msg, "DEBUG[serverless-offline-sns]: ");
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
      this.server.close();
    }
  }

  private setupSnsAdapter() {
    this.snsAdapter = new SNSAdapter(
      this.localPort,
      this.remotePort,
      this.serverless.service.provider.region,
      this.config["sns-endpoint"],
      (msg, ctx) => this.debug(msg, ctx),
      this.app,
      this.serverless.service.service,
      this.serverless.service.provider.stage,
      this.accountId,
      this.config.host,
      this.config["sns-subscribe-endpoint"]
    );
  }
}

export default ServerlessOfflineSns;
import { ListTopicsCommandOutput, ListSubscriptionsCommandOutput, CreateTopicCommandOutput, PublishCommandOutput, MessageAttributeValue, SNSClient, SNSClientConfig, ListTopicsCommand, ListSubscriptionsCommand, UnsubscribeCommand, CreateTopicCommand, SubscribeCommand, PublishCommand } from "@aws-sdk/client-sns";
import type { Application } from "express";
import _ from "lodash";
import fetch from "node-fetch";
import { createMessageId, createSnsLambdaEvent } from "./helpers.js";
import { IDebug, ILambdaContext, IServerlessFunction, ISNSAdapter, LambdaCallback, MessageAttributes, SLSHandler, SnsEventConfig } from "./types.js";

export class SNSAdapter implements ISNSAdapter {
  private sns: SNSClient;
  private pluginDebug: IDebug;
  private app: Application;
  private serviceName: string;
  private stage: string;
  private endpoint: string;
  private adapterEndpoint: string;
  private baseSubscribeEndpoint: string;
  private accountId: string;
  private sqsEndpoint: string;
  private region: string;

  constructor(
    localPort: number,
    remotePort: number,
    region: string,
    snsEndpoint: string,
    debug: IDebug,
    app: Application,
    serviceName: string,
    stage: string,
    accountId: string,
    host: string,
    subscribeEndpoint: string,
    sqsEndpoint: string
  ) {
    this.pluginDebug = debug;
    this.app = app;
    this.serviceName = serviceName;
    this.stage = stage;
    this.adapterEndpoint = `http://${host || "127.0.0.1"}:${localPort}`;
    this.baseSubscribeEndpoint = subscribeEndpoint
      ? `http://${subscribeEndpoint}:${remotePort}`
      : this.adapterEndpoint;
    this.endpoint = snsEndpoint || `http://127.0.0.1:${localPort}`;
    this.sqsEndpoint = sqsEndpoint || `http://127.0.0.1:${localPort}`;
    this.region = region;
    this.debug("using endpoint: " + this.endpoint);
    this.accountId = accountId;
    this.sns = new SNSClient({
      credentials: {
        accessKeyId: "AKID",
        secretAccessKey: "SECRET",
      },
      endpoint: this.endpoint,
      region,
    } as SNSClientConfig);
  }

  public async listTopics(): Promise<ListTopicsCommandOutput> {
    this.debug("listing topics");
    const req = new ListTopicsCommand({});
    this.debug(JSON.stringify(req.input));

    return await new Promise<ListTopicsCommandOutput>((res, rej) => {
      this.sns.send(req, (err, topics) => {
        if (err) {
          this.debug(err, err.stack);
          rej(err);
        } else {
          this.debug(JSON.stringify(topics));
          res(topics!);
        }
      });
    });
  }

  public async listSubscriptions(): Promise<ListSubscriptionsCommandOutput> {
    this.debug("listing subs");
    const req = new ListSubscriptionsCommand({});
    this.debug(JSON.stringify(req.input));

    return await new Promise<ListSubscriptionsCommandOutput>((res, rej) => {
      this.sns.send(req, (err, subs) => {
        if (err) {
          this.debug(err, err.stack);
          rej(err);
        } else {
          this.debug(JSON.stringify(subs));
          res(subs!);
        }
      });
    });
  }

  public async unsubscribe(arn: string) {
    this.debug("unsubscribing: " + arn);
    const unsubscribeReq = new UnsubscribeCommand({ SubscriptionArn: arn });
    await new Promise((res) => {
      this.sns.send(
        unsubscribeReq,
        (err, data) => {
          if (err) {
            this.debug(err, err.stack);
          } else {
            this.debug("unsubscribed: " + JSON.stringify(data));
          }
          res(true);
        }
      );
    });
  }

  public async createTopic(topicName: string): Promise<CreateTopicCommandOutput> {
    const createTopicReq = new CreateTopicCommand({ Name: topicName });
    return new Promise<CreateTopicCommandOutput>((res, rej) =>
      this.sns.send(createTopicReq, (err, data) => {
        if (err) {
          this.debug(err, err.stack);
          rej(err);
        } else {
          this.debug("arn: " + JSON.stringify(data));
          res(data!);
        }
      })
    );
  }

  private sent: (data: unknown) => void = () => {};
  public Deferred = new Promise((res) => (this.sent = res));

  public async subscribe(fn: IServerlessFunction, getHandler: SLSHandler, arn: string, snsConfig: SnsEventConfig) {
    arn = this.convertPseudoParams(arn);
    const fnName = String(fn.name);
    const subscribeEndpoint = (typeof snsConfig === "object" && snsConfig.queueName)
      ? this.sqsEndpoint
      : this.baseSubscribeEndpoint + "/" + fnName;
    this.debug("subscribe: " + fnName + " " + arn);
    this.debug("subscribeEndpoint: " + subscribeEndpoint);
    this.app.post("/" + fnName, (req, res) => {
      this.debug("calling fn: " + fnName + " 1");
      const oldEnv = _.extend({}, process.env);
      process.env = _.extend({}, process.env, fn.environment);

      type SnsNotificationBody = {
        TopicArn?: string;
        Message?: string;
        MessageStructure?: string;
        MessageId?: string;
        MessageGroupId?: string;
        Subject?: string;
        MessageAttributes?: MessageAttributes;
        SubscribeURL?: string;
      };
      const body = req.body as SnsNotificationBody;

      let event: unknown = req.body;
      if (req.is("text/plain") && req.get("x-amz-sns-rawdelivery") !== "true") {
        const msg =
          body.MessageStructure === "json"
            ? JSON.parse(body.Message ?? "{}").default
            : body.Message ?? "";
        event = createSnsLambdaEvent(
          body.TopicArn ?? "",
          "EXAMPLE",
          body.Subject || "",
          msg,
          body.MessageId || createMessageId(),
          body.MessageAttributes,
          body.MessageGroupId
        );
      }

      if (body.SubscribeURL) {
        this.debug("Visiting subscribe url: " + body.SubscribeURL);
        return fetch(body.SubscribeURL, {
          method: "GET"
        }).then((fetchResponse) => {
          this.debug("Subscribed: " + fetchResponse)
          res.status(200).send();
        });
      }

      const sendIt: LambdaCallback = (err, response) => {
        process.env = oldEnv;
        if (err) {
          res.status(500).send(err);
          this.sent(err);
        } else {
          res.send(response);
          this.sent(response);
        }
      };
      const maybePromise = getHandler(
        event,
        this.createLambdaContext(fn, sendIt),
        sendIt
      );
      if (maybePromise instanceof Promise) {
        maybePromise
          .then((response) => sendIt(null, response))
          .catch((error) => sendIt(error instanceof Error ? error : new Error(String(error)), null));
      }
    });
    const params: {
      Protocol: string;
      TopicArn: string;
      Endpoint: string;
      Attributes: Record<string, string>;
    } = {
      Protocol: typeof snsConfig === "object" ? (snsConfig.protocol || "http") : "http",
      TopicArn: arn,
      Endpoint: subscribeEndpoint,
      Attributes: {},
    };

    if (typeof snsConfig === "object" && snsConfig.rawMessageDelivery === "true") {
      params.Attributes["RawMessageDelivery"] = "true";
    }
    if (typeof snsConfig === "object" && snsConfig.filterPolicy) {
      params.Attributes["FilterPolicy"] = JSON.stringify(
        snsConfig.filterPolicy
      );
    }
    if (typeof snsConfig === "object" && snsConfig.queueName) {
      params.Attributes["QueueName"] = snsConfig.queueName;
    }

    const subscribeRequest = new SubscribeCommand(params);
    await new Promise((res) => {
      this.sns.send(subscribeRequest, (err, data) => {
        if (err) {
          this.debug(err, err.stack);
        } else {
          this.debug(
            `successfully subscribed fn "${fnName}" to topic: "${arn}"`
          );
        }
        res(true);
      });
    });
  }

  public async subscribeQueue(queueUrl: string, arn: string, snsConfig: SnsEventConfig) {
    arn = this.convertPseudoParams(arn);
    this.debug("subscribe: " + queueUrl + " " + arn);
    const params: {
      Protocol: string;
      TopicArn: string;
      Endpoint: string;
      Attributes: Record<string, string>;
    } = {
      Protocol: typeof snsConfig === "object" ? (snsConfig.protocol || "sqs") : "sqs",
      TopicArn: arn,
      Endpoint: queueUrl,
      Attributes: {},
    };

    if (typeof snsConfig === "object" && snsConfig.rawMessageDelivery === "true") {
      params.Attributes["RawMessageDelivery"] = "true";
    }
    if (typeof snsConfig === "object" && snsConfig.filterPolicy) {
      params.Attributes["FilterPolicy"] = JSON.stringify(
        snsConfig.filterPolicy
      );
    }

    const subscribeRequest = new SubscribeCommand(params);
    await new Promise((res) => {
      this.sns.send(subscribeRequest, (err, data) => {
        if (err) {
          this.debug(err, err.stack);
        } else {
          this.debug(
            `successfully subscribed queue "${queueUrl}" to topic: "${arn}"`
          );
        }
        res(true);
      });
    });
  }

  public convertPseudoParams(topicArn: string): string {
    const awsRegex = /#{AWS::([a-zA-Z]+)}/g;
    return topicArn.replace(awsRegex, this.accountId);
  }

  public async publish(
    topicArn: string,
    message: string,
    type: string = "",
    messageAttributes: Record<string, MessageAttributeValue> = {},
    subject: string = "",
    messageGroupId?: string
  ): Promise<PublishCommandOutput> {
    topicArn = this.convertPseudoParams(topicArn);
    const publishReq = new PublishCommand({
      Message: message,
      Subject: subject,
      MessageStructure: type,
      TopicArn: topicArn,
      MessageAttributes: messageAttributes,
      ...(messageGroupId && { MessageGroupId: messageGroupId }),
    });
    return await new Promise<PublishCommandOutput>((resolve, reject) =>
      this.sns.send(publishReq, (err, result) => {
        if (err) {
          this.debug(err, err.stack);
          reject(err);
        } else {
          resolve(result!);
        }
      })
    );
  }

  public async publishToTargetArn(
    targetArn: string,
    message: string,
    type: string = "",
    messageAttributes: Record<string, MessageAttributeValue> = {},
    messageGroupId?: string
  ): Promise<PublishCommandOutput> {
    targetArn = this.convertPseudoParams(targetArn);
    const publishReq = new PublishCommand({
      Message: message,
      MessageStructure: type,
      TargetArn: targetArn,
      MessageAttributes: messageAttributes,
      ...(messageGroupId && { MessageGroupId: messageGroupId }),
    });
    return await new Promise<PublishCommandOutput>((resolve, reject) =>
      this.sns.send(publishReq, (err, result) => {
        if (err) {
          this.debug(err, err.stack);
          reject(err);
        } else {
          resolve(result!);
        }
      })
    );
  }

  public async publishToPhoneNumber(
    phoneNumber: string,
    message: string,
    type: string = "",
    messageAttributes: Record<string, MessageAttributeValue> = {},
    messageGroupId?: string
  ): Promise<PublishCommandOutput> {
    const publishReq = new PublishCommand({
      Message: message,
      MessageStructure: type,
      PhoneNumber: phoneNumber,
      MessageAttributes: messageAttributes,
      ...(messageGroupId && { MessageGroupId: messageGroupId }),
    });
    return await new Promise<PublishCommandOutput>((resolve, reject) =>
      this.sns.send(publishReq, (err, result) => {
        if (err) {
          this.debug(err, err.stack);
          reject(err);
        } else {
          resolve(result!);
        }
      })
    );
  }

  public debug(msg: unknown, stack?: unknown) {
    this.pluginDebug(msg, "adapter");
  }

  private createLambdaContext(fun: IServerlessFunction, cb?: LambdaCallback): ILambdaContext {
    const functionName = `${this.serviceName}-${this.stage}-${fun.name}`;
    const endTime =
      new Date().getTime() + (fun.timeout ? fun.timeout * 1000 : 6000);
    const done: LambdaCallback = typeof cb === "function" ? cb : (x, y) => x || y;

    return {
      /* Methods */
      done,
      succeed: (res) => done(null, res),
      fail: (err) => done(err, null),
      getRemainingTimeInMillis: () => endTime - new Date().getTime(),

      /* Properties */
      functionName,
      memoryLimitInMB: fun.memorySize || 1536,
      functionVersion: `offline_functionVersion_for_${functionName}`,
      invokedFunctionArn: `offline_invokedFunctionArn_for_${functionName}`,
      awsRequestId: `offline_awsRequestId_${Math.random()
        .toString(10)
        .slice(2)}`,
      logGroupName: `offline_logGroupName_for_${functionName}`,
      logStreamName: `offline_logStreamName_for_${functionName}`,
      identity: {},
      clientContext: {},
    };
  }
}

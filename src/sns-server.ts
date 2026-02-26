import express, { type Application } from "express";
import fetch from "node-fetch";
import { URL } from "url";
import { IDebug, ISNSServer, MessageAttributes } from "./types.js";
import _ from "lodash";
import xml from "xml";
import {
  arrayify,
  createAttr,
  createMetadata,
  createSnsTopicEvent,
  parseMessageAttributes,
  parseAttributes,
  createMessageId,
  validatePhoneNumber,
  topicArnFromName,
  formatMessageAttributes,
} from "./helpers.js";
import { SQSClient, SendMessageCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";

type Topic = { TopicArn: string };

type Subscription = {
  SubscriptionArn: string;
  Protocol: string;
  TopicArn: string;
  Endpoint: string;
  Owner: string;
  Attributes: Record<string, string>;
  Policies: Record<string, unknown[]> | undefined;
  filterPolicyScope?: string;
  queueName?: string;
};

export class SNSServer implements ISNSServer {
  private topics: Topic[];
  private subscriptions: Subscription[];
  private pluginDebug: IDebug;
  private app: Application;
  private region: string;
  private accountId: string;
  private retry: number;
  private retryInterval: number;

  constructor(debug: IDebug, app: Application, region: string, accountId: string, retry = 0, retryInterval = 0) {
    this.pluginDebug = debug;
    this.topics = [];
    this.subscriptions = [];
    this.app = app;
    this.region = region;
    this.routes();
    this.accountId = accountId;
    this.retry = retry;
    this.retryInterval = retryInterval;
  }

  public routes() {
    this.debug("configuring route");
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      next();
    });
    this.app.all("/", (req, res) => {
      this.debug("hello request");
      this.debug(JSON.stringify(req.body));
      this.debug(JSON.stringify(this.subscriptions));
      const body = req.body as Record<string, string>;
      if (!body) {
        res.status(200).send();
        return;
      }
      if (body.Action === "ListSubscriptions") {
        this.debug(
          "sending: " + xml(this.listSubscriptions(), { indent: "\t" })
        );
        res.send(xml(this.listSubscriptions()));
      } else if (body.Action === "ListTopics") {
        this.debug("sending: " + xml(this.listTopics(), { indent: "\t" }));
        res.send(xml(this.listTopics()));
      } else if (body.Action === "CreateTopic") {
        res.send(xml(this.createTopic(body.Name)));
      } else if (body.Action === "Subscribe") {
        res.send(
          xml(
            this.subscribe(
              body.Endpoint,
              body.Protocol,
              body.TopicArn,
              body
            )
          )
        );
      } else if (body.Action === "PublishBatch") {
        res.send(xml(this.publishBatch(body)));
      } else if (body.Action === "Publish") {
        const target = this.extractTarget(body);
        if (body.MessageStructure === "json") {
          const json = JSON.parse(body.Message) as { default?: unknown };
          if (typeof json.default !== "string") {
            throw new Error("Messages must have default key");
          }
        }

        res.send(
          xml(
            this.publish(
              target,
              body.Subject,
              body.Message,
              body.MessageStructure,
              parseMessageAttributes(body),
              body.MessageGroupId
            )
          )
        );
      } else if (body.Action === "Unsubscribe") {
        res.send(xml(this.unsubscribe(body.SubscriptionArn)));
      } else {
        res.send(
          xml({
            NotImplementedResponse: [createAttr(), createMetadata()],
          })
        );
      }
      this.debug(JSON.stringify(this.subscriptions));
    });
  }

  public listTopics() {
    this.debug("Topics: " + JSON.stringify(this.topics));
    return {
      ListTopicsResponse: [
        createAttr(),
        createMetadata(),
        {
          ListTopicsResult: [
            {
              Topics: this.topics.map((topic) => {
                return {
                  member: arrayify({
                    TopicArn: topic.TopicArn,
                  }),
                };
              }),
            },
          ],
        },
      ],
    };
  }

  public listSubscriptions() {
    this.debug(
      this.subscriptions.map((sub) => {
        return {
          member: [sub],
        };
      })
    );
    return {
      ListSubscriptionsResponse: [
        createAttr(),
        createMetadata(),
        {
          ListSubscriptionsResult: [
            {
              Subscriptions: this.subscriptions.map((sub) => {
                return {
                  member: arrayify({
                    Endpoint: sub.Endpoint,
                    TopicArn: sub.TopicArn,
                    Owner: sub.Owner,
                    Protocol: sub.Protocol,
                    SubscriptionArn: sub.SubscriptionArn,
                  }),
                };
              }),
            },
          ],
        },
      ],
    };
  }

  public unsubscribe(arn: string) {
    this.debug(JSON.stringify(this.subscriptions));
    this.debug("unsubscribing: " + arn);
    this.subscriptions = this.subscriptions.filter(
      (sub) => sub.SubscriptionArn !== arn
    );
    return {
      UnsubscribeResponse: [createAttr(), createMetadata()],
    };
  }

  public createTopic(topicName: string) {
    const topicArn = topicArnFromName(topicName, this.region, this.accountId);
    const topic = {
      TopicArn: topicArn,
    };
    if (!this.topics.find(({ TopicArn }) => TopicArn === topicArn)) {
      this.topics.push(topic);
    }
    return {
      CreateTopicResponse: [
        createAttr(),
        createMetadata(),
        {
          CreateTopicResult: [
            {
              TopicArn: topicArn,
            },
          ],
        },
      ],
    };
  }

  public subscribe(endpoint: string, protocol: string, arn: string, body: Record<string, string>) {
    const attributes = parseAttributes(body);
    const filterPolicies = attributes["FilterPolicy"]
      ? (JSON.parse(attributes["FilterPolicy"]) as Record<string, unknown[]>)
      : undefined;
    arn = this.convertPseudoParams(arn);
    const existingSubscription = this.subscriptions.find((subscription) => {
      if (protocol === "sqs") {
        return (
          attributes["QueueName"] === subscription["Attributes"]["QueueName"] &&
          subscription.Endpoint === endpoint &&
          subscription.TopicArn === arn
        );
      }
      return (
        subscription.Endpoint === endpoint && subscription.TopicArn === arn
      );
    });
    let subscriptionArn;
    if (!existingSubscription) {
      const sub: Subscription = {
        SubscriptionArn: arn + ":" + Math.floor(Math.random() * (1000000 - 1)),
        Protocol: protocol,
        TopicArn: arn,
        Endpoint: endpoint,
        queueName: attributes["QueueName"],
        Owner: "",
        Attributes: attributes,
        Policies: filterPolicies,
        filterPolicyScope: attributes["FilterPolicyScope"],
      };
      this.subscriptions.push(sub);
      subscriptionArn = sub.SubscriptionArn;
    } else {
      subscriptionArn = existingSubscription.SubscriptionArn;
    }
    return {
      SubscribeResponse: [
        createAttr(),
        createMetadata(),
        {
          SubscribeResult: [
            {
              SubscriptionArn: subscriptionArn,
            },
          ],
        },
      ],
    };
  }

  private evaluatePolicies(policies: Record<string, unknown[]>, messageAttrs: MessageAttributes, message: string, filterPolicyScope?: string): boolean {
    if (filterPolicyScope === "MessageBody") {
      return this.evaluatePoliciesOnBody(policies, message);
    }
    return this.evaluatePoliciesOnAttributes(policies, messageAttrs);
  }

  private evaluatePoliciesOnAttributes(policies: Record<string, unknown[]>, messageAttrs: MessageAttributes): boolean {
    let shouldSend: boolean = false;
    for (const [k, v] of Object.entries(policies)) {
      if (!messageAttrs[k]) {
        shouldSend = false;
        break;
      }
      let attrs: unknown[];
      if (messageAttrs[k].Type.endsWith(".Array")) {
        attrs = JSON.parse(messageAttrs[k].Value) as unknown[];
      } else {
        attrs = [messageAttrs[k].Value];
      }
      if (_.intersection(v, attrs).length > 0) {
        this.debug("filterPolicy Passed: " + JSON.stringify(v) + " matched message attrs: " + JSON.stringify(attrs));
        shouldSend = true;
      } else {
        shouldSend = false;
        break;
      }
    }
    if (!shouldSend) {
      this.debug("filterPolicy Failed: " + JSON.stringify(policies) + " did not match message attrs: " + JSON.stringify(messageAttrs));
    }
    return shouldSend;
  }

  private evaluatePoliciesOnBody(policies: Record<string, unknown[]>, message: string): boolean {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(message) as Record<string, unknown>;
    } catch {
      this.debug("filterPolicy (MessageBody) Failed: message is not valid JSON");
      return false;
    }
    for (const [k, v] of Object.entries(policies)) {
      const bodyValue = body[k];
      if (bodyValue === undefined) {
        this.debug("filterPolicy (MessageBody) Failed: key " + k + " not found in message body");
        return false;
      }
      if (_.intersection(v, [bodyValue]).length === 0) {
        this.debug("filterPolicy (MessageBody) Failed: " + JSON.stringify(v) + " did not match body value: " + JSON.stringify(bodyValue));
        return false;
      }
    }
    this.debug("filterPolicy (MessageBody) Passed: " + JSON.stringify(policies));
    return true;
  }

  private async publishHttp(event: string, sub: Subscription, raw: boolean) {
    const doFetch = () => fetch(sub.Endpoint, {
      method: "POST",
      body: event,
      headers: {
        "x-amz-sns-rawdelivery": "" + raw,
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Length": Buffer.byteLength(event).toString(),
      },
    });

    for (let attempt = 0; attempt <= this.retry; attempt++) {
      try {
        const res = await doFetch();
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        this.debug(res);
        return;
      } catch (ex) {
        this.debug(`HTTP delivery failed (attempt ${attempt + 1}/${this.retry + 1}): ${String(ex)}`);
        if (attempt < this.retry && this.retryInterval > 0) {
          await new Promise((res) => setTimeout(res, this.retryInterval));
        }
      }
    }
  }

  private async publishSqs(event: string, sub: Subscription, messageAttributes: MessageAttributes, messageGroupId: string | undefined) {
    const subEndpointUrl = new URL(sub.Endpoint);
    const sqsEndpoint = `${subEndpointUrl.protocol}//${subEndpointUrl.host}/`;
    const sqs = new SQSClient({ endpoint: sqsEndpoint, region: this.region });

    let QueueUrl: string;
    if (sub.queueName) {
      const getQueueUrlResult = await sqs.send(
        new GetQueueUrlCommand({ QueueName: sub.queueName })
      );
      QueueUrl = getQueueUrlResult.QueueUrl ?? sub.Endpoint;
    } else {
      QueueUrl = sub.Endpoint;
    }

    const sendMsgReq = new SendMessageCommand({
      QueueUrl,
      MessageBody: event,
      MessageAttributes: formatMessageAttributes(messageAttributes),
      ...(messageGroupId && { MessageGroupId: messageGroupId }),
    });
    return new Promise<void>((resolve) => {
      void sqs.send(sendMsgReq).then(() => resolve());
    });
  }

  public publishBatch(body: Record<string, string>) {
    const topicArn = body.TopicArn;
    const prefix = "PublishBatchRequestEntries.member.";

    const indices = Object.keys(body)
      .filter((key) => key.startsWith(prefix))
      .reduce<string[]>((prev, key) => {
        const idx = key.replace(prefix, "").match(/.*?(?=\.|$)/i)![0];
        return prev.includes(idx) ? prev : [...prev, idx];
      }, []);

    const successful: Array<{ Id: string; MessageId: string }> = [];
    const failed: Array<{ Id: string; Code: string; SenderFault: string; Message: string }> = [];

    for (const idx of indices) {
      const ep = `${prefix}${idx}.`;
      const id = body[`${ep}Id`];
      const message = body[`${ep}Message`] || "";
      const subject = body[`${ep}Subject`] || "";
      const messageStructure = body[`${ep}MessageStructure`] || "";
      const messageGroupId = body[`${ep}MessageGroupId`];

      const entryBody: Record<string, string> = { MessageStructure: messageStructure };
      Object.keys(body)
        .filter((key) => key.startsWith(`${ep}MessageAttributes.`))
        .forEach((key) => { entryBody[key.replace(ep, "")] = body[key]; });
      const messageAttributes = parseMessageAttributes(entryBody);

      try {
        const result = this.publish(topicArn, subject, message, messageStructure, messageAttributes, messageGroupId);
        const messageId = (result.PublishResponse[1] as { PublishResult: [{ MessageId: string }] }).PublishResult[0].MessageId;
        successful.push({ Id: id, MessageId: messageId });
      } catch (err) {
        failed.push({ Id: id, Code: "InternalError", SenderFault: "false", Message: String(err) });
      }
    }

    return {
      PublishBatchResponse: [
        createAttr(),
        {
          PublishBatchResult: [
            { Successful: successful.map(({ Id, MessageId }) => ({ member: [{ Id }, { MessageId }] })) },
            { Failed: failed.map(({ Id, Code, SenderFault, Message }) => ({ member: [{ Id }, { Code }, { SenderFault }, { Message }] })) },
          ],
        },
        createMetadata(),
      ],
    };
  }

  public publish(
    topicArn: string,
    subject: string,
    message: string,
    messageStructure: string,
    messageAttributes: MessageAttributes,
    messageGroupId: string | undefined
  ) {
    const messageId = createMessageId();
    void Promise.all(
      this.subscriptions
        .filter((sub) => sub.TopicArn === topicArn)
        .map((sub): Promise<void> => {
          const isRaw = sub.Attributes["RawMessageDelivery"] === "true";
          if (
            sub.Policies &&
            !this.evaluatePolicies(sub.Policies, messageAttributes, message, sub.filterPolicyScope)
          ) {
            this.debug(
              "Filter policies failed. Skipping subscription: " + sub.Endpoint
            );
            return Promise.resolve();
          }
          this.debug("fetching: " + sub.Endpoint);
          let event;
          if (isRaw) {
            event = message;
          } else {
            event = JSON.stringify(
              createSnsTopicEvent(
                topicArn,
                sub.SubscriptionArn,
                subject,
                message,
                messageId,
                messageStructure,
                messageAttributes,
                messageGroupId
              )
            );
          }
          this.debug("event: " + event);
          if (!sub.Protocol) {
            sub.Protocol = "http";
          }
          const protocol = sub.Protocol.toLowerCase();
          if (protocol === "http" || protocol === "lambda") {
            return this.publishHttp(event, sub, isRaw);
          }
          if (protocol === "sqs") {
            return this.publishSqs(
              event,
              sub,
              messageAttributes,
              messageGroupId
            );
          }
          throw new Error(
            `Protocol '${protocol}' is not supported by serverless-offline-sns`
          );
        })
    );
    return {
      PublishResponse: [
        createAttr(),
        {
          PublishResult: [
            {
              MessageId: messageId,
            },
          ],
        },
        createMetadata(),
      ],
    };
  }

  public extractTarget(body: Record<string, string>): string {
    if (!body.PhoneNumber) {
      const target = body.TopicArn || body.TargetArn;
      if (!target) {
        throw new Error("TopicArn or TargetArn is missing");
      }
      return this.convertPseudoParams(target);
    } else {
      return validatePhoneNumber(body.PhoneNumber);
    }
  }

  public convertPseudoParams(topicArn: string): string {
    const awsRegex = /#{AWS::([a-zA-Z]+)}/g;
    return topicArn.replace(awsRegex, this.accountId);
  }

  public debug(msg: unknown) {
    if (msg instanceof Object) {
      try {
        msg = JSON.stringify(msg);
      } catch (ex) { }
    }
    this.pluginDebug(msg, "server");
  }
}

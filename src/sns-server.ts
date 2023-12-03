import { TopicsList, Subscription } from "aws-sdk/clients/sns.js";
import fetch from "node-fetch";
import { URL } from "url";
import { IDebug, ISNSServer } from "./types.js";
import bodyParser from "body-parser";
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
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

export class SNSServer implements ISNSServer {
  private topics: TopicsList;
  private subscriptions: Subscription[];
  private pluginDebug: IDebug;
  private port: number;
  private server: any;
  private app: any;
  private region: string;
  private accountId: string;

  constructor(debug, app, region, accountId) {
    this.pluginDebug = debug;
    this.topics = [];
    this.subscriptions = [];
    this.app = app;
    this.region = region;
    this.routes();
    this.accountId = accountId;
  }

  public routes() {
    this.debug("configuring route");
    this.app.use(bodyParser.json({ limit: "10mb" })); // for parsing application/json
    this.app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" })); // for parsing application/x-www-form-urlencoded
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
      if (req.body.Action === "ListSubscriptions") {
        this.debug(
          "sending: " + xml(this.listSubscriptions(), { indent: "\t" })
        );
        res.send(xml(this.listSubscriptions()));
      } else if (req.body.Action === "ListTopics") {
        this.debug("sending: " + xml(this.listTopics(), { indent: "\t" }));
        res.send(xml(this.listTopics()));
      } else if (req.body.Action === "CreateTopic") {
        res.send(xml(this.createTopic(req.body.Name)));
      } else if (req.body.Action === "Subscribe") {
        res.send(
          xml(
            this.subscribe(
              req.body.Endpoint,
              req.body.Protocol,
              req.body.TopicArn,
              req.body
            )
          )
        );
      } else if (req.body.Action === "Publish") {
        const target = this.extractTarget(req.body);
        if (req.body.MessageStructure === "json") {
          const json = JSON.parse(req.body.Message);
          if (typeof json.default !== "string") {
            throw new Error("Messages must have default key");
          }
        }

        res.send(
          xml(
            this.publish(
              target,
              req.body.Subject,
              req.body.Message,
              req.body.MessageStructure,
              parseMessageAttributes(req.body),
              req.body.MessageGroupId
            )
          )
        );
      } else if (req.body.Action === "Unsubscribe") {
        res.send(xml(this.unsubscribe(req.body.SubscriptionArn)));
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

  public unsubscribe(arn) {
    this.debug(JSON.stringify(this.subscriptions));
    this.debug("unsubscribing: " + arn);
    this.subscriptions = this.subscriptions.filter(
      (sub) => sub.SubscriptionArn !== arn
    );
    return {
      UnsubscribeResponse: [createAttr(), createMetadata()],
    };
  }

  public createTopic(topicName) {
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

  public subscribe(endpoint: string, protocol, arn: string, body) {
    const attributes = parseAttributes(body);
    const filterPolicies =
      attributes["FilterPolicy"] && JSON.parse(attributes["FilterPolicy"]);
    arn = this.convertPseudoParams(arn);
    const existingSubscription = this.subscriptions.find((subscription) => {
      return (
        subscription.Endpoint === endpoint && subscription.TopicArn === arn
      );
    });
    let subscriptionArn;
    if (!existingSubscription) {
      const sub = {
        SubscriptionArn: arn + ":" + Math.floor(Math.random() * (1000000 - 1)),
        Protocol: protocol,
        TopicArn: arn,
        Endpoint: endpoint,
        Owner: "",
        Attributes: attributes,
        Policies: filterPolicies,
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

  private evaluatePolicies(policies: any, messageAttrs: any): boolean {
    let shouldSend: boolean = false;
    for (const [k, v] of Object.entries(policies)) {
      if (!messageAttrs[k]) {
        shouldSend = false;
        break;
      }
      let attrs;
      if (messageAttrs[k].Type.endsWith(".Array")) {
        attrs = JSON.parse(messageAttrs[k].Value);
      } else {
        attrs = [messageAttrs[k].Value];
      }
      if (_.intersection(v as unknown[], attrs).length > 0) {
        this.debug(
          "filterPolicy Passed: " +
          v +
          " matched message attrs: " +
          JSON.stringify(attrs)
        );
        shouldSend = true;
      } else {
        shouldSend = false;
        break;
      }
    }
    if (!shouldSend) {
      this.debug(
        "filterPolicy Failed: " +
        JSON.stringify(policies) +
        " did not match message attrs: " +
        JSON.stringify(messageAttrs)
      );
    }

    return shouldSend;
  }

  private publishHttp(event, sub, raw) {
    return fetch(sub.Endpoint, {
      method: "POST",
      body: event,
      headers: {
        "x-amz-sns-rawdelivery": "" + raw,
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Length": Buffer.byteLength(event).toString(),
      },
    })
      .then((res) => this.debug(res))
      .catch((ex) => this.debug(ex));
  }

  private publishSqs(event, sub, messageAttributes, messageGroupId) {
    const subEndpointUrl = new URL(sub.Endpoint);
    const sqsEndpoint = `${subEndpointUrl.protocol}//${subEndpointUrl.host}/`;
    const sqs = new SQSClient({ endpoint: sqsEndpoint, region: this.region });

    if (sub["Attributes"]["RawMessageDelivery"] === "true") {
      const sendMsgReq = new SendMessageCommand({
        QueueUrl: sub.Endpoint,
        MessageBody: event,
        MessageAttributes: formatMessageAttributes(messageAttributes),
        ...(messageGroupId && { MessageGroupId: messageGroupId }),
      });
      return new Promise<void>((resolve, reject) => {
        sqs
          .send(sendMsgReq).then(() => {
            resolve();
          });
      });
    } else {
      const records = JSON.parse(event).Records ?? [];
      const messagePromises = records.map((record) => {
        const sendMsgReq = new SendMessageCommand({
          QueueUrl: sub.Endpoint,
          MessageBody: JSON.stringify(record.Sns),
          MessageAttributes: formatMessageAttributes(messageAttributes),
          ...(messageGroupId && { MessageGroupId: messageGroupId }),
        });
        return new Promise<void>((resolve, reject) => {
          sqs
            .send(sendMsgReq).then(() => {
              resolve();
            });
        });
      });
      return new Promise<void>((resolve, reject) => {
        Promise.all(messagePromises).then(() => resolve());
      });
    }
  }

  public publish(
    topicArn,
    subject,
    message,
    messageStructure,
    messageAttributes,
    messageGroupId
  ) {
    const messageId = createMessageId();
    Promise.all(
      this.subscriptions
        .filter((sub) => sub.TopicArn === topicArn)
        .map((sub) => {
          const isRaw = sub["Attributes"]["RawMessageDelivery"] === "true";
          if (
            sub["Policies"] &&
            !this.evaluatePolicies(sub["Policies"], messageAttributes)
          ) {
            this.debug(
              "Filter policies failed. Skipping subscription: " + sub.Endpoint
            );
            return;
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
          if (protocol === "http") {
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

  public extractTarget(body): string {
    if (!body.PhoneNumber) {
      const target: string = body.TopicArn || body.TargetArn;
      if (!target) {
        throw new Error("TopicArn or TargetArn is missing");
      }
      return this.convertPseudoParams(target);
    } else {
      return validatePhoneNumber(body.PhoneNumber);
    }
  }

  public convertPseudoParams(topicArn: string) {
    const awsRegex = /#{AWS::([a-zA-Z]+)}/g;
    return topicArn.replace(awsRegex, this.accountId);
  }

  public debug(msg) {
    if (msg instanceof Object) {
      try {
        msg = JSON.stringify(msg);
      } catch (ex) { }
    }
    this.pluginDebug(msg, "server");
  }
}

import ServerlessOfflineSns from "../../src/index.js";
import { expect } from "chai";
import * as handler from "../mock/handler.js";
import * as multiDotHandler from "../mock/multi.dot.handler.js";
import * as state from "../mock/mock.state.js";
import { SQSClient, SendMessageCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { mockClient } from 'aws-sdk-client-mock';

let plugin;

const lambdaMock = mockClient(LambdaClient);

let functionRegistry: Map<string, (...args: unknown[]) => unknown> = new Map();

function buildFunctionRegistry(sl: any, handlerFn: (...args: unknown[]) => unknown) {
  const registry = new Map<string, (...args: unknown[]) => unknown>();
  const service: string = sl.service.service ?? "";
  const stage: string = sl.service.provider.stage ?? "dev";
  for (const fnKey of Object.keys(sl.service.functions)) {
    registry.set(`${service}-${stage}-${fnKey}`, handlerFn);
  }
  return registry;
}

function createPlugin(sl: any, handlerFn: (...args: unknown[]) => unknown = handler.pongHandler) {
  functionRegistry = buildFunctionRegistry(sl, handlerFn);
  return new ServerlessOfflineSns(sl, {});
}

describe("test", () => {
  let accountId;
  beforeEach(() => {
    accountId = Math.floor(Math.random() * (100000000 - 1));
    handler.resetPongs();
    state.resetEvent();
    state.resetResult();
    functionRegistry = new Map();
    lambdaMock.reset();
    lambdaMock.on(InvokeCommand).callsFake(async (input: { FunctionName?: string; Payload?: Uint8Array }) => {
      const event = input.Payload ? JSON.parse(new TextDecoder().decode(input.Payload)) : {};
      const handlerFn = functionRegistry.get(input.FunctionName ?? "");
      let handlerResult: unknown = null;
      if (handlerFn) {
        handlerResult = await new Promise((resolve) => {
          const maybePromise = handlerFn(event, {}, (_err: unknown, result: unknown) => resolve(result));
          if (maybePromise instanceof Promise) maybePromise.then(resolve).catch(() => resolve(null));
        });
      }
      return { Payload: new TextEncoder().encode(JSON.stringify(handlerResult)), StatusCode: 200 };
    });
  });

  afterEach(async () => {
    await plugin.stop();
  });

  it("should start on offline start", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
    });
    await plugin.hooks["before:offline:start:init"]();
    await plugin.hooks["after:offline:start:end"]();
  });

  it("should start on command start", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
    });
    plugin.hooks["offline-sns:start:init"]();
    await new Promise((res) => setTimeout(res, 100));
    await plugin.hooks["offline-sns:start:end"]();
  });

  it('should send event to topic ARN', async () => {
    plugin = createPlugin(createServerless(accountId));
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(2);
  });

  it("should send event to target ARN", async () => {
    plugin = createPlugin(createServerless(accountId));
    const snsAdapter = await plugin.start();
    await snsAdapter.publishToTargetArn(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(2);
  });

  it("should send event with pseudo parameters", async () => {
    plugin = createPlugin(createServerless(accountId));
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      "arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic",
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(2);
  });

  it("should send event with MessageAttributes and subject", async () => {
    plugin = createPlugin(createServerless(accountId));
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "message with attributes",
      "raw",
      {
        with: { DataType: "String", StringValue: "attributes" },
      },
      "subject"
    );
    await new Promise((res) => setTimeout(res, 100));
    const event = state.getEvent();
    expect(event.Records[0].Sns).to.have.property(
      "Message",
      "message with attributes"
    );
    expect(event.Records[0].Sns).to.have.property("Subject", "subject");
    expect(event.Records[0].Sns).to.have.deep.property("MessageAttributes", {
      with: {
        Type: "String",
        Value: "attributes",
      },
    });
  });

  it("should return a valid response to publish", async () => {
    plugin = createPlugin(createServerless(accountId));
    const snsAdapter = await plugin.start();
    const snsResponse = await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "'a simple message'"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(snsResponse).to.have.property("$metadata");
    expect(snsResponse.$metadata).to.have.property("requestId");
  });

  it("should send a message to a E.164 phone number", async () => {
    plugin = createPlugin(createServerless(accountId));
    const snsAdapter = await plugin.start();
    const snsResponse = await snsAdapter.publishToPhoneNumber(
      `+10000000000`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(snsResponse).to.have.property("$metadata");
    expect(snsResponse.$metadata).to.have.property("requestId");
  });

  it("should error", async () => {
    plugin = createPlugin(createServerlessBad(accountId));
    const snsAdapter = await plugin.start();
    const err = await plugin.subscribe(
      plugin.serverless,
      "badPong",
      createServerlessBad(accountId).service.functions.badPong,
      plugin.location
    );
    expect(
      err.indexOf("Please ensure the sns configuration is correct")
    ).to.be.greaterThan(-1);
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(0);
  });

  it("should use the custom host for subscription urls", async () => {
    plugin = createPlugin(
      createServerless(accountId, "pongHandler", "0.0.0.0")
    );
    const snsAdapter = await plugin.start();
    const response = await snsAdapter.listSubscriptions();

    response.Subscriptions
      .filter((sub) => sub.Protocol === "http")
      .forEach((sub) => {
        expect(sub.Endpoint.startsWith("http://0.0.0.0:4002")).to.be.true;
      });
  });

  it("should use the custom subscribe endpoint for subscription urls", async () => {
    plugin = createPlugin(
      createServerless(accountId, "pongHandler", "0.0.0.0", "anotherHost")
    );
    const snsAdapter = await plugin.start();
    const response = await snsAdapter.listSubscriptions();

    response.Subscriptions
      .filter((sub) => sub.Protocol === "http")
      .forEach((sub) => {
        expect(sub.Endpoint.startsWith("http://anotherHost:4002")).to.be.true;
      });
  });

  it("should unsubscribe", async () => {
    plugin = createPlugin(createServerless(accountId));
    const snsAdapter = await plugin.start();
    await plugin.unsubscribeAll();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(0);
  });

  it("should read env variable", async () => {
    plugin = createPlugin(
      createServerless(accountId, "envHandler"),
      handler.envHandler
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    expect(await state.getResult()).to.eq("MY_VAL");
  });

  it("should read env variable for function", async () => {
    plugin = createPlugin(
      createServerless(accountId, "envHandler"),
      handler.envHandler
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-2`,
      "{}"
    );
    expect(await state.getResult()).to.eq("TEST");
  });

  it("should convert pseudo param on load", async () => {
    plugin = createPlugin(
      createServerless(accountId, "pseudoHandler"),
      handler.pseudoHandler
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-3`,
      "{}"
    );
    expect(await state.getResult()).to.eq(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-3`
    );
  });

  it("should send event to handlers with more than one dot in the filename", async () => {
    plugin = createPlugin(createServerlessMultiDot(accountId), multiDotHandler.itsGotDots);
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:multi-dot-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(1);
  });

  it('should support commonjs/default handlers', async () => {
    plugin = createPlugin(
      createServerless(accountId, "defaultExportHandler"),
      handler.default.defaultExportHandler
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(2);
  });

  it('should support async handlers with no callback', async () => {
    plugin = createPlugin(
      createServerless(accountId, "asyncHandler"),
      handler.asyncHandler
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-async`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(await state.getResult()).to.eq(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-async`
    );
    expect(await snsAdapter.Deferred).to.eq("{}");
  });

  it("should not send event when filter policies exist and fail", async () => {
    plugin = createPlugin(
      createServerlessWithFilterPolicies(accountId)
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-policies`,
      "message with filter params",
      "raw",
      {
        foo: { DataType: "String", StringValue: "no" },
      }
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(0);
  });

  it("should send event when filter policies exist and pass", async () => {
    plugin = createPlugin(
      createServerlessWithFilterPolicies(accountId)
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-policies`,
      "message with filter params",
      "raw",
      {
        foo: { DataType: "String", StringValue: "bar" },
      }
    );
    await new Promise((res) => setTimeout(res, 100));
    const event = state.getEvent();
    expect(event.Records[0].Sns.Message).to.not.be.empty;
  });

  it("should not send event when multiple filter policies exist and the message only contains one", async () => {
    plugin = createPlugin(
      createServerlessWithFilterPolicies(accountId)
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-policies-multiple`,
      "message with filter params",
      "raw",
      {
        foo: { DataType: "String", StringValue: "bar" },
      }
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(0);
  });

  it("should not send event when multiple filter policies exist and the message only satisfies one", async () => {
    plugin = createPlugin(
      createServerlessWithFilterPolicies(accountId)
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-policies-multiple`,
      "message with filter params",
      "raw",
      {
        foo: { DataType: "String", StringValue: "bar" },
        second: { DataType: "String", StringValue: "bar" },
      }
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(0);

  });

  it("should not wrap the event when the sub's raw message delivery is true", async () => {
    const serverless = createServerless(accountId);
    serverless.service.functions.pong4.events[0].sns["rawMessageDelivery"] =
      "true";
    plugin = createPlugin(serverless);

    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-3`,
      '{"message":"hello"}'
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getEvent()).to.eql({ message: "hello" });
  });

  it("should list topics", async () => {
    plugin = createPlugin(createServerless(accountId));
    const snsAdapter = await plugin.start();
    const { Topics } = await snsAdapter.listTopics();
    await new Promise((res) => setTimeout(res, 100));
    const topicArns = Topics.map((topic) => topic.TopicArn);
    expect(Topics.length).to.eq(5);
    expect(topicArns).to.include(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`
    );
  });

  it("should subscribe", async () => {
    const sqsMock = mockClient(SQSClient);
    sqsMock.on(GetQueueUrlCommand).resolves({ QueueUrl: "http://127.0.0.1:4002/queue/pong6" });
    plugin = createPlugin(
      createServerless(accountId, "envHandler")
    );
    const snsAdapter = await plugin.start();
    await plugin.subscribeAll();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:topic-pinging`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    const sqsSendArgs = sqsMock.send.args;
    expect(sqsMock.send.calledTwice).to.be.true;
    expect(sqsSendArgs[0][0].input).to.be.deep.equals({
      QueueName: "pong6",
    });
    expect(sqsSendArgs[1][0].input).to.be.deep.equals({
      QueueUrl: "http://127.0.0.1:4002/queue/pong6",
      MessageBody: "{}",
      MessageAttributes: {},
    });
    sqsMock.restore();
  });

  it("should deliver SNS envelope as MessageBody to SQS in non-raw mode", async () => {
    const sqsMock = mockClient(SQSClient);
    sqsMock.on(GetQueueUrlCommand).resolves({ QueueUrl: "http://127.0.0.1:4002/queue/pong6" });
    plugin = createPlugin(
      createServerlessWithNonRawSqsSubscription(accountId)
    );
    const snsAdapter = await plugin.start();
    await plugin.subscribeAll();
    const message = "hello-non-raw";
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:topic-non-raw`,
      message
    );
    await new Promise((res) => setTimeout(res, 100));
    const sqsSendArgs = sqsMock.send.args;
    expect(sqsMock.send.calledTwice).to.be.true;
    const sentBody = JSON.parse((sqsSendArgs[1][0].input as { MessageBody: string }).MessageBody);
    expect(sentBody).to.have.property("Message", message);
    expect(sentBody).to.have.property("Type", "Notification");
    expect(sentBody).to.have.property("TopicArn").that.includes("topic-non-raw");
    sqsMock.restore();
  });

  it("should handle empty resource definition", async () => {
    const serverless = createServerless(accountId);
    serverless.service.resources = undefined;
    plugin = createPlugin(serverless);
    await plugin.start();
  });

  it("should handle messageGroupId", async () => {
    const sqsMock = mockClient(SQSClient);
    sqsMock.on(GetQueueUrlCommand).resolves({ QueueUrl: "http://127.0.0.1:4002/queue/pong6" });
    plugin = createPlugin(
      createServerless(accountId, "envHandler")
    );
    const snsAdapter = await plugin.start();
    await plugin.subscribeAll();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:topic-pinging`,
      "{}",
      "",
      {},
      "",
      "messageGroupId-here"
    );
    await new Promise((res) => setTimeout(res, 100));
    const sqsSendArgs = sqsMock.send.args;
    expect(sqsMock.send.calledTwice).to.be.true;
    expect(sqsSendArgs[0][0].input).to.be.deep.equals({
      QueueName: "pong6",
    });
    expect(sqsSendArgs[1][0].input).to.be.deep.equals({
      QueueUrl: "http://127.0.0.1:4002/queue/pong6",
      MessageBody: "{}",
      MessageAttributes: {},
      MessageGroupId: "messageGroupId-here",
    });
    sqsMock.restore();
  });
});

const createServerless = (
  accountId: number,
  handlerName: string = "pongHandler",
  host: string | null = null,
  subscribeEndpoint: string | null = null
) => {
  return {
    config: {},
    service: {
      custom: {
        "serverless-offline-sns": {
          debug: true,
          port: 4002,
          accountId,
          host,
          "sns-subscribe-endpoint": subscribeEndpoint,
        },
      },
      provider: {
        region: "us-east-1",
        environment: {
          MY_VAR: "MY_VAL",
        },
      },
      functions: {
        pong: {
          name: "queue-one",
          handler: "test/mock/handler." + handlerName,
          events: [
            {
              sns: `arn:aws:sns:us-east-1:${accountId}:test-topic`,
            },
          ],
        },
        pong2: {
          name: "queue-two",
          handler: "test/mock/handler." + handlerName,
          events: [
            {
              sns: {
                arn: `arn:aws:sns:us-east-1:${accountId}:test-topic`,
              },
            },
          ],
        },
        pong3: {
          name: "this-is-auto-created-when-using-serverless",
          handler: "test/mock/handler." + handlerName,
          environment: {
            MY_VAR: "TEST",
          },
          events: [
            {
              sns: {
                arn: `arn:aws:sns:us-east-1:${accountId}:test-topic-2`,
              },
            },
          ],
        },
        pong4: {
          handler: "test/mock/handler." + handlerName,
          events: [
            {
              sns: {
                arn: `arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic-3`,
              },
            },
          ],
        },
        pong5: {
          handler: "test/mock/handler." + handlerName,
          events: [
            {
              sns: {
                arn: `arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic-async`,
              },
            },
          ],
        },
        pong6: {
          handler: "test/mock/handler." + handlerName,
          events: [
            {
              sqs: {
                arn: {
                  "Fn::GetAtt": ["pong6", "Arn"],
                },
              },
            },
          ],
        },
      },
      resources: {
        Resources: {
          pong6QueueSubscription: {
            Type: "AWS::SNS::Subscription",
            Properties: {
              Protocol: "sqs",
              Endpoint: {
                "Fn::GetAtt": ["pong6", "Arn"],
              },
              RawMessageDelivery: "true",
              TopicArn: {
                Ref: "pinging",
              },
            },
          },
          pong6: {
            Type: "AWS::SQS::Queue",
            Properties: {
              QueueName: "pong6",
            },
          },
          pinging: {
            Type: "AWS::SNS::Topic",
            Properties: {
              TopicName: "topic-pinging",
            },
          },
        },
      },
    },
    cli: {
      log: (data) => {
        if (process.env.DEBUG) {
          console.log(data);
        }
      },
    },
  };
};

const createServerlessMultiDot = (
  accountId: number,
  handlerName: string = "pongHandler",
  host = null
) => {
  return {
    config: {},
    service: {
      custom: {
        "serverless-offline-sns": {
          debug: true,
          port: 4002,
          accountId,
          host,
        },
      },
      provider: {
        region: "us-east-1",
        environment: {
          MY_VAR: "MY_VAL",
        },
      },
      functions: {
        multiDot: {
          handler: "test/mock/multi.dot.handler.itsGotDots",
          events: [
            {
              sns: `arn:aws:sns:us-west-2:${accountId}:multi-dot-topic`,
            },
          ],
        },
      },
      resources: {},
    },
    cli: {
      log: (data) => {
        if (process.env.DEBUG) {
          console.log(data);
        }
      },
    },
  };
};

const createServerlessBad = (accountId: number) => {
  return {
    config: {},
    service: {
      custom: {
        "serverless-offline-sns": {
          debug: true,
          port: 4002,
          accountId,
        },
      },
      provider: {
        region: "us-east-1",
      },
      functions: {
        badPong: {
          handler: "test/mock/handler.pongHandler",
          events: [
            {
              sns: {
                topicArn: `arn:aws:sns:us-east-1:${accountId}:test-topic`,
              },
            },
          ],
        },
      },
      resources: {},
    },
    cli: {
      log: (data) => {
        if (process.env.DEBUG) {
          console.log(data);
        }
      },
    },
  };
};

const createServerlessWithNonRawSqsSubscription = (accountId: number) => {
  return {
    config: {},
    service: {
      custom: {
        "serverless-offline-sns": {
          debug: true,
          port: 4002,
          accountId,
        },
      },
      provider: { region: "us-east-1", environment: {} },
      functions: {
        pong6: {
          handler: "test/mock/handler.pongHandler",
          events: [{ sqs: { arn: { "Fn::GetAtt": ["pong6", "Arn"] } } }],
        },
      },
      resources: {
        Resources: {
          pong6QueueSubscription: {
            Type: "AWS::SNS::Subscription",
            Properties: {
              Protocol: "sqs",
              Endpoint: { "Fn::GetAtt": ["pong6", "Arn"] },
              TopicArn: { Ref: "nonRawTopic" },
            },
          },
          pong6: {
            Type: "AWS::SQS::Queue",
            Properties: { QueueName: "pong6" },
          },
          nonRawTopic: {
            Type: "AWS::SNS::Topic",
            Properties: { TopicName: "topic-non-raw" },
          },
        },
      },
    },
    cli: { log: (data) => { if (process.env.DEBUG) console.log(data); } },
  };
};

const createServerlessWithFilterPolicies = (
  accountId: number,
  handlerName: string = "pongHandler",
  host = null,
  subscribeEndpoint = null
) => {
  return {
    config: {},
    service: {
      custom: {
        "serverless-offline-sns": {
          debug: true,
          port: 4002,
          accountId,
          host,
          "sns-subscribe-endpoint": subscribeEndpoint,
        },
      },
      provider: {
        region: "us-east-1",
        environment: {
          MY_VAR: "MY_VAL",
        },
      },
      functions: {
        pong: {
          name: "some-name",
          handler: "test/mock/handler." + handlerName,
          events: [
            {
              sns: {
                topicName: "test-topic-policies",
                displayName: "test-topic-policies",
                filterPolicy: {
                  foo: ["bar", "blah"],
                },
              },
            },
          ],
        },
        pong2: {
          name: "some-name2",
          handler: "test/mock/handler." + handlerName,
          events: [
            {
              sns: {
                topicName: "test-topic-policies-multiple",
                displayName: "test-topic-policies-multiple",
                filterPolicy: {
                  foo: ["bar", "blah"],
                  second: ["policy"],
                },
              },
            },
          ],
        },
      },
      resources: {},
    },
    cli: {
      log: (data) => {
        if (process.env.DEBUG) {
          console.log(data);
        }
      },
    },
  };
};

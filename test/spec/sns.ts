const ServerlessOfflineSns = require("../../src/index");
import { expect } from "chai";
import handler = require("../mock/handler");
import state = require("../mock/mock.state");
import * as multiDotHandler from "../mock/multi.dot.handler";
import * as AWSMock from "aws-sdk-mock";
import * as AWS from "aws-sdk";
import { assert, spy } from "sinon";

let plugin;

describe("test", () => {
  let accountId;
  beforeEach(() => {
    accountId = Math.floor(Math.random() * (100000000 - 1));
    handler.resetPongs();
    state.resetEvent();
    state.resetResult();
  });

  afterEach(() => {
    plugin.stop();
  });

  it("should start on offline start", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
    await plugin.hooks["before:offline:start:init"]();
    await plugin.hooks["after:offline:start:end"]();
  });

  it("should start on command start", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
    plugin.hooks["offline-sns:start:init"]();
    await new Promise((res) => setTimeout(res, 100));
    await plugin.hooks["offline-sns:start:end"]();
  });

  it("should send event to topic ARN", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(2);
  });

  it("should send event to target ARN", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
    const snsAdapter = await plugin.start();
    await snsAdapter.publishToTargetArn(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(2);
  });

  it("should send event with pseudo parameters", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      "arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic",
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(2);
  });

  it("should send event with MessageAttributes and subject", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
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
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
    const snsAdapter = await plugin.start();
    const snsResponse = await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "'a simple message'"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(snsResponse).to.have.property("ResponseMetadata");
    expect(snsResponse.ResponseMetadata).to.have.property("RequestId");
    expect(snsResponse).to.have.property("MessageId");
  });

  it("should send a message to a E.164 phone number", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
    const snsAdapter = await plugin.start();
    const snsResponse = await snsAdapter.publishToPhoneNumber(
      `+10000000000`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(snsResponse).to.have.property("ResponseMetadata");
    expect(snsResponse.ResponseMetadata).to.have.property("RequestId");
    expect(snsResponse).to.have.property("MessageId");
  });

  it("should error", async () => {
    plugin = new ServerlessOfflineSns(createServerlessBad(accountId), {});
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
    plugin = new ServerlessOfflineSns(
      createServerless(accountId, "pongHandler", "0.0.0.0"),
      { skipCacheInvalidation: true }
    );
    const snsAdapter = await plugin.start();
    const response = await snsAdapter.listSubscriptions();

    response.Subscriptions.forEach((sub) => {
      expect(sub.Endpoint.startsWith("http://0.0.0.0:4002")).to.be.true;
    });
  });

  it("should use the custom subscribe endpoint for subscription urls", async () => {
    plugin = new ServerlessOfflineSns(
      createServerless(accountId, "pongHandler", "0.0.0.0", "anotherHost"),
      { skipCacheInvalidation: true }
    );
    const snsAdapter = await plugin.start();
    const response = await snsAdapter.listSubscriptions();

    response.Subscriptions.forEach((sub) => {
      expect(sub.Endpoint.startsWith("http://anotherHost:4002")).to.be.true;
    });
  });

  it("should unsubscribe", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {
      skipCacheInvalidation: true,
    });
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
    plugin = new ServerlessOfflineSns(
      createServerless(accountId, "envHandler"),
      { skipCacheInvalidation: true }
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    expect(await state.getResult()).to.eq("MY_VAL");
  });

  it("should read env variable for function", async () => {
    plugin = new ServerlessOfflineSns(
      createServerless(accountId, "envHandler"),
      { skipCacheInvalidation: true }
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-2`,
      "{}"
    );
    expect(await state.getResult()).to.eq("TEST");
  });

  it("should convert pseudo param on load", async () => {
    plugin = new ServerlessOfflineSns(
      createServerless(accountId, "pseudoHandler"),
      { skipCacheInvalidation: true }
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

  it("should completely reload the module every time if cache invalidation is enabled", async () => {
    plugin = new ServerlessOfflineSns(
      createServerlessCacheInvalidation(accountId),
      { skipCacheInvalidation: [/mock\.state/] }
    );

    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(1, "wrong number of pongs (first check)");

    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs(), "wrong number of pongs (second check)").to.eq(1);
  });

  it("should send event to handlers with more than one dot in the filename", async () => {
    plugin = new ServerlessOfflineSns(createServerlessMultiDot(accountId), {
      skipCacheInvalidation: true,
    });
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:multi-dot-topic`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getPongs()).to.eq(1);
  });

  it("should support async handlers with no callback", async () => {
    plugin = new ServerlessOfflineSns(
      createServerless(accountId, "asyncHandler"),
      { skipCacheInvalidation: true }
    );
    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-async`,
      "{}"
    );
    expect(await state.getResult()).to.eq(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-async`
    );
    expect(await snsAdapter.Deferred).to.eq("{}");
  });

  it("should not send event when filter policies exist and fail", async () => {
    plugin = new ServerlessOfflineSns(
      createServerlessWithFilterPolicies(accountId),
      {}
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
    plugin = new ServerlessOfflineSns(
      createServerlessWithFilterPolicies(accountId),
      { skipCacheInvalidation: true }
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
    plugin = new ServerlessOfflineSns(
      createServerlessWithFilterPolicies(accountId),
      {}
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
    plugin = new ServerlessOfflineSns(
      createServerlessWithFilterPolicies(accountId),
      {}
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
    plugin = new ServerlessOfflineSns(serverless, {
      skipCacheInvalidation: true,
    });

    const snsAdapter = await plugin.start();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:test-topic-3`,
      '{"message":"hello"}'
    );
    await new Promise((res) => setTimeout(res, 100));
    expect(state.getEvent()).to.eql({ message: "hello" });
  });

  it("should list topics", async () => {
    plugin = new ServerlessOfflineSns(createServerless(accountId), {});
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
    const spySendMessage = spy();
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock("SQS", "sendMessage", spySendMessage);
    plugin = new ServerlessOfflineSns(
      createServerless(accountId, "envHandler"),
      { skipCacheInvalidation: true }
    );
    const snsAdapter = await plugin.start();
    await plugin.subscribeAll();
    await snsAdapter.publish(
      `arn:aws:sns:us-east-1:${accountId}:topic-pinging`,
      "{}"
    );
    await new Promise((res) => setTimeout(res, 100));
    assert.calledOnce(spySendMessage);
    assert.calledWith(spySendMessage, {
      QueueUrl: "http://127.0.0.1:4002/undefined",
      MessageBody: "{}",
      MessageAttributes: {},
    });
    AWSMock.restore("SQS", "sendMessage");
  });

  it("should handle empty resource definition", async () => {
    const serverless = createServerless(accountId);
    serverless.service.resources = undefined;
    plugin = new ServerlessOfflineSns(serverless, {
      skipCacheInvalidation: true,
    });
    await plugin.start();
  });

  it("should handle messageGroupId", async () => {
    const spySendMessage = spy();
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock("SQS", "sendMessage", spySendMessage);
    plugin = new ServerlessOfflineSns(
      createServerless(accountId, "envHandler"),
      { skipCacheInvalidation: true }
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
    assert.calledOnce(spySendMessage);
    assert.calledWith(spySendMessage, {
      QueueUrl: "http://127.0.0.1:4002/undefined",
      MessageBody: "{}",
      MessageAttributes: {},
      MessageGroupId: "messageGroupId-here",
    });
    AWSMock.restore("SQS", "sendMessage");
  });
});

const createServerless = (
  accountId: number,
  handlerName: string = "pongHandler",
  host: string = null,
  subscribeEndpoint = null
) => {
  return {
    config: {
      // Since this is not really being used, it should be removed
      skipCacheInvalidation: true,
    },
    service: {
      custom: {
        "serverless-offline-sns": {
          debug: true,
          port: 4002,
          accountId: accountId,
          host: host,
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

const createServerlessCacheInvalidation = (
  accountId: number,
  handlerName: string = "pongHandler",
  host: string = null
) => {
  return {
    config: {
      skipCacheInvalidation: [/mock\.state/],
    },
    service: {
      custom: {
        "serverless-offline-sns": {
          debug: true,
          port: 4002,
          accountId,
          host,
          invalidateCache: true,
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
          handler: "test/mock/handler." + handlerName,
          events: [
            {
              sns: `arn:aws:sns:us-west-2:${accountId}:test-topic`,
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

const createServerlessMultiDot = (
  accountId: number,
  handlerName: string = "pongHandler",
  host: string = null
) => {
  return {
    config: {
      skipCacheInvalidation: true,
    },
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
    config: {
      skipCacheInvalidation: true,
    },
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

const createServerlessWithFilterPolicies = (
  accountId: number,
  handlerName: string = "pongHandler",
  host: string = null,
  subscribeEndpoint = null
) => {
  return {
    config: {
      skipCacheInvalidation: true,
    },
    service: {
      custom: {
        "serverless-offline-sns": {
          debug: true,
          port: 4002,
          accountId: accountId,
          host: host,
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

const ServerlessOfflineSns = require("../../src/index");
import {expect} from "chai";
import handler = require("../mock/handler");
import state = require("../mock/mock.state");
import * as multiDotHandler from "../mock/multi.dot.handler";

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
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        await plugin.hooks["before:offline:start:init"]();
        await plugin.hooks["after:offline:start:end"]();
    });

    it("should start on command start", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        plugin.hooks["offline-sns:start:init"]();
        await new Promise(res => setTimeout(res, 100));
        await plugin.hooks["offline-sns:start:end"]();
    });

    it("should send event", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getPongs()).to.eq(2);
    });

    it("should send event with psuedo parameters", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish("arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic", "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getPongs()).to.eq(2);
    });

    it("should send event with MessageAttributes", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish(
            `arn:aws:sns:us-east-1:${accountId}:test-topic`,
            "message with attributes",
            "raw",
            {
                with: { DataType: "String", StringValue: "attributes" },
            },
        );
        await new Promise(res => setTimeout(res, 100));
        const event = state.getEvent();
        const record = event.Records[0];
        expect(record).to.include.keys("Sns");
        expect(record.Sns).to.have.property("Message", "message with attributes");
        expect(record.Sns).to.have.deep.property(
            "MessageAttributes",
            {
                with: {
                    Type: "String",
                    Value: "attributes",
                },
            },
        );
    });

    it("should return a valid response to publish", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        const snsAdapter = await plugin.start();
        const snsResponse = await snsAdapter.publish(
            `arn:aws:sns:us-east-1:${accountId}:test-topic`,
            "'a simple message'",
        );
        await new Promise(res => setTimeout(res, 100));
        expect(snsResponse).to.have.property("ResponseMetadata");
        expect(snsResponse.ResponseMetadata).to.have.property("RequestId");
        expect(snsResponse).to.have.property("MessageId");
    });

    it("should error", async () => {
        plugin = new ServerlessOfflineSns(createServerlessBad(accountId), {});
        const snsAdapter = await plugin.start();
        const err = await plugin.subscribe("badPong", createServerlessBad(accountId).service.functions.badPong );
        expect(err.indexOf("unsupported config:")).to.be.greaterThan(-1);
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getPongs()).to.eq(0);
    });

    it("should use the custom host for subscription urls", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "pongHandler", "0.0.0.0"), {});
        const snsAdapter = await plugin.start();
        const response = await snsAdapter.listSubscriptions();

        response.Subscriptions.forEach(sub => {
            expect(sub.Endpoint.startsWith("http://0.0.0.0:4002")).to.be.true;
        });
    });

    it("should use the custom subscribe endpoint for subscription urls", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "pongHandler", "0.0.0.0", "anotherHost"), {});
        const snsAdapter = await plugin.start();
        const response = await snsAdapter.listSubscriptions();

        response.Subscriptions.forEach(sub => {
            expect(sub.Endpoint.startsWith("http://anotherHost:4002")).to.be.true;
        });
    });

    it("should unsubscribe", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        const snsAdapter = await plugin.start();
        await plugin.unsubscribeAll();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getPongs()).to.eq(0);
    });

    it("should read env variable", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "envHandler"), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getResult()).to.eq("MY_VAL");
    });

    it("should read env variable for function", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "envHandler"), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic-2`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getResult()).to.eq("TEST");
    });

    it("should convert psuedo param on load", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "psuedoHandler"), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish("arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic-3", "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getResult()).to.eq(`arn:aws:sns:us-east-1:${accountId}:test-topic-3`);
    });

    it("should completely reload the module every time if cache invalidation is enabled", async () => {
        plugin = new ServerlessOfflineSns(createServerlessCacheInvalidation(accountId), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getPongs()).to.eq(1, "wrong number of pongs (first check)");

        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getPongs(), "wrong number of pongs (second check)").to.eq(1);
    });

    it("should send event to handlers with more than one dot in the filename", async () => {
        plugin = new ServerlessOfflineSns(createServerlessMultiDot(accountId), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:multi-dot-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(state.getPongs()).to.eq(1);
    });
});

const createServerless = (accountId: number, handlerName: string = "pongHandler", host: string = null, subscribeEndpoint = null) => {
    return {
        config: {
            skipCacheInvalidation: true,
        },
        service: {
            custom: {
                "serverless-offline-sns": {
                    "debug": true,
                    "port": 4002,
                    "accountId": accountId,
                    "host": host,
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
                    handler: "test/mock/handler." + handlerName,
                    events: [{
                        sns: "test-topic",
                    }],
                },
                pong2: {
                    handler: "test/mock/handler." + handlerName,
                    events: [{
                        sns: {
                            arn: `arn:aws:sns:us-east-1:${accountId}:test-topic`,
                        },
                    }],
                },
                pong3: {
                    name: "this-is-auto-created-when-using-serverless",
                    handler: "test/mock/handler." + handlerName,
                    environment: {
                        MY_VAR: "TEST",
                    },
                    events: [{
                        sns: {
                            arn: `arn:aws:sns:us-east-1:${accountId}:test-topic-2`,
                        },
                    }],
                },
                pong4: {
                    handler: "test/mock/handler." + handlerName,
                    events: [{
                        sns: {
                            arn: `arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic-3`,
                        },
                    }],
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

const createServerlessCacheInvalidation = (accountId: number, handlerName: string = "pongHandler", host: string = null) => {
    return {
        config: {
            skipCacheInvalidation: [
                /mock\.state/,
            ],
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
                    events: [{
                        sns: "test-topic",
                    }],
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

const createServerlessMultiDot = (accountId: number, handlerName: string = "pongHandler", host: string = null) => {
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
                    events: [{
                        sns: `multi-dot-topic`,
                    }],
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
                    events: [{
                        sns: {
                            topicArn: `arn:aws:sns:us-east-1:${accountId}:test-topic`,
                        },
                    }],
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

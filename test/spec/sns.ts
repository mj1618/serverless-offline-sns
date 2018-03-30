const ServerlessOfflineSns = require("../../src/index");
import {expect} from "chai";
import handler = require("../mock/handler");
let plugin;

describe("test", () => {
    let accountId;
    beforeEach(() => {
        accountId = Math.floor(Math.random() * (100000000 - 1));
        handler.resetPongs();
        handler.resetEvent();
        handler.resetResult();
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
        expect(handler.getPongs()).to.eq(2);
    });

    it("should send event with psuedo parameters", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish("arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic", "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getPongs()).to.eq(2);
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
        const event = handler.getEvent();
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

    it("should error", async () => {
        plugin = new ServerlessOfflineSns(createServerlessBad(accountId), {});
        const snsAdapter = await plugin.start();
        const err = await plugin.subscribe("badPong", createServerlessBad(accountId).service.functions.badPong );
        expect(err.indexOf("unsupported config:")).to.be.greaterThan(-1);
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getPongs()).to.eq(0);
    });

    it("should use the custom host for subscription urls", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "pongHandler", "0.0.0.0"), {});
        const snsAdapter = await plugin.start();
        const response = await snsAdapter.listSubscriptions();

        response.Subscriptions.forEach(sub => {
            expect(sub.Endpoint.startsWith("http://0.0.0.0:4002")).to.be.true;
        });
    });

    it("should unsubscribe", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId), {});
        const snsAdapter = await plugin.start();
        await plugin.unsubscribeAll();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getPongs()).to.eq(0);
    });

    it("should read env variable", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "envHandler"), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getResult()).to.eq("MY_VAL");
    });

    it("should read env variable for function", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "envHandler"), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish(`arn:aws:sns:us-east-1:${accountId}:test-topic-2`, "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getResult()).to.eq("TEST");
    });

    it("should convert psuedo param on load", async () => {
        plugin = new ServerlessOfflineSns(createServerless(accountId, "psuedoHandler"), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish("arn:aws:sns:us-east-1:#{AWS::AccountId}:test-topic-3", "{}");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getResult()).to.eq(`arn:aws:sns:us-east-1:${accountId}:test-topic-3`);
    });
});

const createServerless = (accountId: number, handlerName: string = "pongHandler", host: string = null) => {
    return {
        config: {},
        service: {
            custom: {
                "serverless-offline-sns": {
                    debug: true,
                    port: 4002,
                    accountId: accountId,
                    host: host
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
                    name: 'this-is-auto-created-when-using-serverless',
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

const createServerlessBad = (accountId: number) => {
    return {
        config: {},
        service: {
            custom: {
                "serverless-offline-sns": {
                    debug: true,
                    port: 4002,
                    accountId: accountId
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

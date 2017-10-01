const ServerlessOfflineSns = require("../../src/index");
import {expect} from "chai";
import handler = require("../mock/handler");
let plugin;

describe("test", () => {
    beforeEach(() => {
        handler.resetPongs();
    });

    afterEach(() => {
        plugin.stop();
    });

    it("should start on offline start", async () => {
        plugin = new ServerlessOfflineSns(createServerless(), {});
        await plugin.hooks["before:offline:start:init"]();
        await plugin.hooks["after:offline:start:end"]();
    });

    it("should start on command start", async () => {
        plugin = new ServerlessOfflineSns(createServerless(), {});
        plugin.hooks["offline-sns:start:init"]();
        await plugin.hooks["offline-sns:start:end"]();
    });

    it("should send event", async () => {
        plugin = new ServerlessOfflineSns(createServerless(), {});
        const snsAdapter = await plugin.start();
        await snsAdapter.publish("arn:aws:sns:us-east-1:123456789012:test-topic", "hello");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getPongs()).to.eq(2);
    });

    it("should error", async () => {
        plugin = new ServerlessOfflineSns(createServerlessBad(), {});
        const snsAdapter = await plugin.start();
        const err = await plugin.subscribe("badPong", createServerlessBad().service.functions.badPong );
        expect(err.indexOf("unsupported config:")).to.be.greaterThan(-1);
        await snsAdapter.publish("arn:aws:sns:us-east-1:123456789012:test-topic", "hello");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getPongs()).to.eq(0);
    });

    it("should unsubscribe", async () => {
        plugin = new ServerlessOfflineSns(createServerless(), {});
        const snsAdapter = await plugin.start();
        await plugin.unsubscribeAll();
        await snsAdapter.publish("arn:aws:sns:us-east-1:123456789012:test-topic", "hello");
        await new Promise(res => setTimeout(res, 100));
        expect(handler.getPongs()).to.eq(0);
    });
});

const createServerless = () => {
    return {
        service: {
            custom: {
                "serverless-offline-sns": {
                    debug: true,
                    port: 4002,
                },
            },
            provider: {
                region: "us-east-1",
            },
            functions: {
                pong: {
                    handler: "test/mock/handler.pongHandler",
                    events: [{
                        sns: "test-topic",
                    }],
                },
                pong2: {
                    handler: "test/mock/handler.pongHandler",
                    events: [{
                        sns: {
                            arn: "arn:aws:sns:us-east-1:123456789012:test-topic",
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

const createServerlessBad = () => {
    return {
        service: {
            custom: {
                "serverless-offline-sns": {
                    debug: true,
                    port: 4002,
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
                            topicArn: "arn:aws:sns:us-east-1:123456789012:test-topic",
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

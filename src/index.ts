import { SNSAdapter } from "./sns-adapter";
import * as express from "express";
import { ISNSAdapter } from "./types";
import { SNSServer } from "./sns-server";
import * as _ from "lodash";

class ServerlessOfflineSns {
    private config: any;
    private serverless: any;
    public commands: object;
    private port: number;
    public hooks: object;
    private snsAdapter: ISNSAdapter;
    private app: any;
    private snsServer: any;
    private server: any;
    private options: any;
    private location: string;
    private region: string;
    private accountId: string;

    constructor(serverless: any, options: any) {
        this.app = express();
        this.options = options;
        this.serverless = serverless;

        this.commands = {
            "offline-sns": {
                usage: "Listens to offline SNS events and passes them to configured Lambda fns",
                lifecycleEvents: [
                    "start",
                ],
                commands: {
                    start: {
                        lifecycleEvents: [
                            "init",
                            "end",
                        ],
                    },
                },
            },
        };

        this.hooks = {
            "before:offline:start:init": () => this.start(),
            "after:offline:start:end": () => this.stop(),
            "offline-sns:start:init": () => {
                this.start();
                return this.waitForSigint();
            },
            "offline-sns:start:end": () => this.stop(),
        };
    }

    public init() {
        process.env = _.extend({}, this.serverless.service.provider.environment, process.env);
        this.config = this.serverless.service.custom["serverless-offline-sns"] || {};
        this.port = this.config.port || 4002;
        this.accountId = this.config.accountId || "123456789012";
        const offlineConfig = this.serverless.service.custom["serverless-offline"] || {};
        this.location = process.cwd();
        if (offlineConfig.location) {
            this.location = process.cwd() + "/" + offlineConfig.location;
        } else if (this.serverless.config.servicePath) {
            this.location = this.serverless.config.servicePath;
        }
        if (this.serverless.service.provider.region) {
            this.region = this.serverless.service.provider.region;
        } else {
            this.region = "us-east-1";
        }
    }

    public async start() {
        this.init();
        await this.listen();
        await this.serve();
        await this.subscribeAll();
        return this.snsAdapter;
    }

    public async waitForSigint() {
        return new Promise(res => {
            process.on("SIGINT", () => {
                this.log("Halting offline-sns server");
                res();
            });
        });
    }

    public async serve() {
        this.snsServer = new SNSServer((msg, ctx) => this.debug(msg, ctx), this.app, this.region, this.accountId);
    }

    public async subscribeAll() {
        this.snsAdapter = new SNSAdapter(this.port, this.serverless.service.provider.region, this.config["sns-endpoint"], (msg, ctx) => this.debug(msg, ctx), this.app, this.serverless.service.service, this.serverless.service.provider.stage, this.accountId);
        await this.unsubscribeAll();
        this.debug("subscribing");
        await Promise.all(Object.keys(this.serverless.service.functions).map(fnName => {
            const fn = this.serverless.service.functions[fnName];
            return Promise.all(fn.events.filter(event => event.sns != null).map(event => {
                return this.subscribe(fnName, event.sns);
            }));
        }));
    }

    public async unsubscribeAll() {
        const subs = await this.snsAdapter.listSubscriptions();
        this.debug("subs!: " + JSON.stringify(subs));
        await Promise.all(
            subs.Subscriptions
                .filter(sub => sub.Endpoint.indexOf(":" + this.port) > -1)
                .map(sub => this.snsAdapter.unsubscribe(sub.SubscriptionArn)));
    }

    public async subscribe(fnName, snsConfig) {
        this.debug("subscribe: " + fnName);
        // name = event.sns ||
        // name = event.sns.topicName ||
        // arn = event.sns.arn ||
        // arn = event.sns.arn && topicName = event.sns.topicName
        const fn = this.serverless.service.functions[fnName];

        if (typeof snsConfig === "string" || typeof snsConfig.topicName === "string") {
            this.log(`Creating topic: "${snsConfig}" for fn "${fnName}"`);
            let topicName = snsConfig;
            if (snsConfig.topicName && typeof snsConfig.topicName === "string") {
                topicName = snsConfig.topicName;
            }
            const data = await this.snsAdapter.createTopic(topicName);
            this.debug("topic: " + JSON.stringify(data));
            await this.snsAdapter.subscribe(fn, () => this.createHandler(fn), data.TopicArn);
        } else if (typeof snsConfig.arn === "string") {
            await this.snsAdapter.subscribe(fn, () => this.createHandler(fn), snsConfig.arn);
        } else {
            this.log("unsupported config: " + snsConfig);
            return Promise.resolve("unsupported config: " + snsConfig);
        }
    }

    public createHandler(fn) {
        this.debug(process.cwd());
        this.debug("require(" + this.location + "/" + fn.handler.split(".")[0] + ")[" + fn.handler.split("/").pop().split(".")[1] + "]");
        const handler = require(this.location + "/" + fn.handler.split(".")[0])[fn.handler.split("/").pop().split(".")[1]];
        return handler;
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
        return new Promise(res => {
            this.server = this.app.listen(this.port, host, () => {
                this.debug(`listening on ${host}:${this.port}`);
                res();
            });
        });
    }

    public async stop() {
        this.init();
        this.debug("stopping plugin");
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = ServerlessOfflineSns;

import {SNSAdapter} from "./sns-adapter";
import * as express from "express";
import { ISNSAdapter } from "./types";
import {SNSServer} from "./sns-server";

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

    constructor(serverless: any, options: any) {
        this.app = express();
        this.config = serverless.service.custom["offline-sns"] || {};
        this.serverless = serverless;
        this.port = this.config.port || 4002;
        this.commands = {
            "offline-sns": {
                usage: "Listens to offline SNS events and passes them to configured Lambda fns",
                lifecycleEvents: [
                    "start",
                ],
                start: {
                    lifecycleEvents: [
                        "init",
                        "end",
                    ],
                },
            },
        };

        this.hooks = {
            "before:offline:start:init": () => this.start(),
            "after:offline:start:end": () => this.stop(),
            "offline-sns:start:init": () => this.start(),
            "offline-sns:start:end": () => this.stop(),

        };
    }

    public async start() {
        this.debug("starting plugin");
        await this.listen();
        await this.serve();
        await this.subscribeAll();
        return this.snsAdapter;
    }

    public async serve() {
        this.snsServer = new SNSServer((msg, ctx) => this.debug(msg, ctx), this.app);
    }

    public async subscribeAll() {
        this.snsAdapter = new SNSAdapter(this.port, this.serverless.service.provider.region, this.config["sns-endpoint"], (msg, ctx) => this.debug(msg, ctx), this.app);
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
        // arn = event.sns.arn ||
        // arn = event.sns.arn && topicName = event.sns.topicName
        const fn = this.serverless.service.functions[fnName];
        const handler = this.createHandler(fn);

        if (typeof snsConfig === "string") {
            this.log(`Creating topic: "${snsConfig}" for fn "${fnName}"`);
            const data = await this.snsAdapter.createTopic(snsConfig);
            this.debug("topic: " + JSON.stringify(data));
            await this.snsAdapter.subscribe(fnName, handler, data.TopicArn);
        } else if (typeof snsConfig.arn === "string") {
            await this.snsAdapter.subscribe(fnName, handler, snsConfig.arn);
        } else {
            this.log("unsupported config: " + snsConfig);
            return Promise.resolve("unsupported config: " + snsConfig);
        }
    }

    public createHandler(fn) {
        this.debug(process.cwd());
        this.debug("require(" + process.cwd() + "/" + fn.handler.split(".")[0] + ")[" + fn.handler.split("/").pop().split(".")[1] + "]");
        const handler = require(process.cwd() + "/" + fn.handler.split(".")[0])[fn.handler.split("/").pop().split(".")[1]];
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
        return new Promise( res => {
            this.server = this.app.listen(this.port, () => {
                this.debug(`listening on ${this.port}`);
                res();
            });
        });
    }

    public stop() {
        this.debug("stopping plugin");

        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = ServerlessOfflineSns;

import * as AWS from "aws-sdk";
import { ListSubscriptionsResponse, CreateTopicResponse } from "aws-sdk/clients/sns.d";
import { ISNSAdapter, IDebug } from "./types";
import fetch from "node-fetch";

const createLambdaContext = (fun, cb?) => {
    const functionName = fun.name;
    const endTime = new Date().getTime() + (fun.timeout ? fun.timeout * 1000 : 6000);
    const done = typeof cb === "function" ? cb : ((x, y) => x || y); // eslint-disable-line no-extra-parens

    return {
        /* Methods */
        done,
        succeed: res => done(null, res),
        fail: err => done(err, null),
        getRemainingTimeInMillis: () => endTime - new Date().getTime(),

        /* Properties */
        functionName,
        memoryLimitInMB: fun.memorySize || 1536,
        functionVersion: `offline_functionVersion_for_${functionName}`,
        invokedFunctionArn: `offline_invokedFunctionArn_for_${functionName}`,
        awsRequestId: `offline_awsRequestId_${Math.random().toString(10).slice(2)}`,
        logGroupName: `offline_logGroupName_for_${functionName}`,
        logStreamName: `offline_logStreamName_for_${functionName}`,
        identity: {},
        clientContext: {},
    };
};

export class SNSAdapter implements ISNSAdapter {
    private sns: AWS.SNS;
    private pluginDebug: IDebug;
    private port: number;
    private server: any;
    private app: any;

    constructor(port, region = "us-east-1", snsEndpoint, debug, app) {
        this.pluginDebug = debug;
        this.port = port;
        this.app = app;
        const endpoint = snsEndpoint || `http://127.0.0.1:${port}`;
        this.debug("using endpoint: " + endpoint);
        if (!AWS.config.credentials) {
            AWS.config.update({
                accessKeyId: "AKID",
                secretAccessKey: "SECRET",
                region,
            });
        }
        this.sns = new AWS.SNS({
            endpoint,
            region,
        });
    }

    public async listSubscriptions(): Promise<ListSubscriptionsResponse> {
        this.debug("listing subs");
        const req = this.sns.listSubscriptions({});
        this.debug(JSON.stringify(req.httpRequest));

        return await new Promise(res => {
            this.sns.listSubscriptions({}, (err, subs) => {
                if (err) {
                    this.debug(err, err.stack);
                } else {
                    this.debug(JSON.stringify(subs));
                }
                res(subs);
            });
        });
    }

    public async unsubscribe(arn) {
        this.debug("unsubscribing: " + arn);
        await new Promise(res => {
            this.sns.unsubscribe({
                SubscriptionArn: arn,
            }, (err, data) => {
                if (err) {
                    this.debug(err, err.stack);
                } else {
                    this.debug("unsubscribed: " + JSON.stringify(data));
                }
                res();
            });
        });
    }

    public async createTopic(topicName) {
        return new Promise(res => this.sns.createTopic({ Name: topicName }, (err, data) => {
            if (err) {
                this.debug(err, err.stack);
            } else {
                this.debug("arn: " + JSON.stringify(data));
            }
            res(data);
        }));
    }

    public async subscribe(fnName, getHandler, arn) {
        const subscribeEndpoint = "http://127.0.0.1:" + this.port + "/" + fnName;
        this.debug("subscribe: " + fnName + " " + arn);
        this.debug("subscribeEndpoint: " + subscribeEndpoint);
        this.app.post("/" + fnName, (req, res) => {
            this.debug("calling fn: " + fnName + " 1");
            getHandler()(req.body, createLambdaContext({name: fnName}), (data) => {
                res.send(data);
            });
        });
        const params = {
            Protocol: "http",
            TopicArn: arn,
            Endpoint: subscribeEndpoint,
        };

        await new Promise(res => {
            this.sns.subscribe(params, (err, data) => {
                if (err) {
                    this.debug(err, err.stack);
                } else {
                    this.debug(`successfully subscribed fn "${fnName}" to topic: "${arn}"`);
                }
                res();
            });
        });
    }

    public async publish(topicArn: string, message: string, type: string = "json") {
        await new Promise(res => this.sns.publish({
            Message: message,
            MessageStructure: type,
            TopicArn: topicArn,
        }, res));
    }

    public debug(msg, stack?: any) {
        this.pluginDebug(msg, "adapter");
    }
}

import * as AWS from "aws-sdk";
import { ListSubscriptionsResponse, CreateTopicResponse, MessageAttributeMap } from "aws-sdk/clients/sns.d";
import { ISNSAdapter, IDebug } from "./types";
import fetch from "node-fetch";

export class SNSAdapter implements ISNSAdapter {
    private sns: AWS.SNS;
    private pluginDebug: IDebug;
    private port: number;
    private server: any;
    private app: any;
    private serviceName: string;
    private stage: string;
    private endpoint: string;

    constructor(port, region, snsEndpoint, debug, app, serviceName, stage) {
        this.pluginDebug = debug;
        this.port = port;
        this.app = app;
        this.serviceName = serviceName;
        this.stage = stage;
        this.endpoint = snsEndpoint || `http://127.0.0.1:${port}`;
        this.debug("using endpoint: " + this.endpoint);
        if (!AWS.config.credentials) {
            AWS.config.update({
                accessKeyId: "AKID",
                secretAccessKey: "SECRET",
                region,
            });
        }
        this.sns = new AWS.SNS({
            endpoint: this.endpoint,
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

    public async subscribe(fn, getHandler, arn) {
        const subscribeEndpoint = this.endpoint + "/" + fn.name;
        this.debug("subscribe: " + fn.name + " " + arn);
        this.debug("subscribeEndpoint: " + subscribeEndpoint);
        this.app.post("/" + fn.name, (req, res) => {
            this.debug("calling fn: " + fn.name + " 1");
            getHandler()(req.body, this.createLambdaContext(fn), (data) => {
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
                    this.debug(`successfully subscribed fn "${fn.name}" to topic: "${arn}"`);
                }
                res();
            });
        });
    }

    public async publish(topicArn: string, message: string, type: string = "json", messageAttributes: MessageAttributeMap = {}) {
        await new Promise(res => this.sns.publish({
            Message: message,
            MessageStructure: type,
            TopicArn: topicArn,
            MessageAttributes: messageAttributes,
        }, res));
    }

    public debug(msg, stack?: any) {
        this.pluginDebug(msg, "adapter");
    }

    private createLambdaContext(fun, cb?) {
        const functionName = `${this.serviceName}-${this.stage}-${fun.name}`;
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
    }

}

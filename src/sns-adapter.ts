import {SNS} from "aws-sdk";
import {ListSubscriptionsResponse, CreateTopicResponse} from "aws-sdk/clients/sns.d";
import { ISNSAdapter, IDebug } from "./types";

export class SNSAdapter implements ISNSAdapter {
    private sns: SNS;
    private pluginDebug: IDebug;
    private port: number;
    private server: any;
    private app: any;

    constructor(port, region = "us-east-1", snsEndpoint, debug, app) {
        this.pluginDebug = debug;
        this.port = port;
        this.app = app;
        this.sns = new SNS({
            endpoint: snsEndpoint || `http://localhost:${port}`,
            region,
        });
    }

    public async listSubscriptions(): Promise<ListSubscriptionsResponse> {
        this.debug("listing subs");
        return await new Promise(res => {
            this.sns.listSubscriptions({}, (subsErr, subs) => {
                this.debug(JSON.stringify(subs));
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

    public async subscribe(fnName, handler, arn) {
        const subscribeEndpoint = "http://localhost:" + this.port + "/" + fnName;
        this.debug("subscribe: " + fnName + " " + arn);
        this.debug("subscribeEndpoint: " + subscribeEndpoint);
        this.app.post("/" + fnName, (req, res) => {
            this.debug("calling fn: " + fnName + " 1");
            handler(req.body, {}, (data) => {
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

    public async publish(topicArn, type, message) {
        await new Promise(res => this.sns.publish({
            Message: "STRING_VALUE",
            MessageStructure: "json",
            TopicArn: topicArn,
        }, res));
    }

    public debug(msg, stack?: any) {
        this.pluginDebug(msg, "adapter");
    }
}

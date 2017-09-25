import {ListSubscriptionsResponse, CreateTopicResponse} from "aws-sdk/clients/sns.d";

export type IDebug = (msg: any, stack?: any) => void;

export type SLSHandler = (event, ctx, cb) => void;

export interface ISNSAdapter {
    listSubscriptions(): Promise<ListSubscriptionsResponse>;
    unsubscribe(arn: string): Promise<void>;
    createTopic(topicName: string): Promise<CreateTopicResponse>;
    subscribe(fnName: string, handler: SLSHandler, arn: string): Promise<void>;
    publish(topicArn: string, type: string, message: string): Promise<void>;
}
export interface ISNSAdapterConstructable {
    new(endpoint: string, port: number, region: string, debug: IDebug): ISNSAdapter;
}

export interface ISNSServer {
    routes();
}
import { v4 as uuid } from "uuid";

export function createAttr() {
    return {
        _attr: {
            xmlns: "http://sns.amazonaws.com/doc/2010-03-31/",
        },
    };
}

export function createMetadata() {
    return {
        ResponseMetadata: [{
            RequestId: uuid(),
        }],
    };
}

export function arrayify(obj) {
    return Object.keys(obj).map(key => {
        const x = {};
        x[key] = obj[key];
        return x;
    });
}

export function parseMessageAttributes(body) {
    if (body.MessageStructure === "json") {
        return {};
    }

    const entries = Object.keys(body)
        .filter(key => key.startsWith("MessageAttributes.entry"))
        .reduce(
            (prev, key) => {
                const index = key.replace("MessageAttributes.entry.", "").match(/.*?(?=\.|$)/i)[0];
                return prev.includes(index) ? prev : [...prev, index];
            },
            [],
        );
    return entries
        .map(index => `MessageAttributes.entry.${index}`)
        .reduce(
            (prev, baseKey) => ({
                ...prev,
                [`${body[`${baseKey}.Name`]}`]: {
                    Type: body[`${baseKey}.Value.DataType`],
                    Value: body[`${baseKey}.Value.BinaryValue`] || body[`${baseKey}.Value.StringValue`],
                },
            }),
            {},
        );
}

export function createSnsEvent(topicArn, subscriptionArn, subject, message, messageAttributes?) {
    return {
        Records: [
            {
                EventVersion: "1.0",
                EventSubscriptionArn: subscriptionArn,
                EventSource: "aws:sns",
                Sns: {
                    SignatureVersion: "1",
                    Timestamp: new Date().toISOString(),
                    Signature: "EXAMPLE",
                    SigningCertUrl: "EXAMPLE",
                    MessageId: uuid(),
                    Message: message,
                    MessageAttributes: messageAttributes || {},
                    Type: "Notification",
                    UnsubscribeUrl: "EXAMPLE",
                    TopicArn: topicArn,
                    Subject: subject,
                },
            },
        ],
    };
}

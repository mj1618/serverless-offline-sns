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

export function parseFilterPolicies(body) {
    const entries = Object.keys(body)
        .filter(key => key.startsWith("Attributes.entry"))
        .reduce(
            (prev, key) => {
                const index = key.replace("Attributes.entry.", "").match(/.*?(?=\.|$)/i)[0];
                return prev.includes(index) ? prev : [...prev, index];
            },
            [],
        );
    for (const key of entries.map(index => `Attributes.entry.${index}`)) {
        if ((body[`${key}.key`]) === "FilterPolicy") {
            return JSON.parse(body[`${key}.value`]);
        }
    }
}

export function createSnsEvent(topicArn, subscriptionArn, subject, message, messageId, messageAttributes?) {
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
                    MessageId: messageId,
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

export function createMessageId() {
    return uuid();
}

const phoneNumberValidator = /^\++?[1-9]\d{1,14}$/;

export function validatePhoneNumber(phoneNumber) {
    if (!phoneNumberValidator.test(phoneNumber)) {
        throw new Error(`PhoneNumber ${phoneNumber} is not valid to publish`);
    }
    return phoneNumber;
}

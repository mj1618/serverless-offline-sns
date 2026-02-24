import { v4 as uuid } from "uuid";
import { MessageAttributes } from "./types.js";

export function createAttr() {
  return {
    _attr: {
      xmlns: "http://sns.amazonaws.com/doc/2010-03-31/",
    },
  };
}

export function createMetadata() {
  return {
    ResponseMetadata: [
      {
        RequestId: uuid(),
      },
    ],
  };
}

export function arrayify(obj: Record<string, unknown>) {
  return Object.keys(obj).map((key) => {
    const x: Record<string, unknown> = {};
    x[key] = obj[key];
    return x;
  });
}

export function parseMessageAttributes(body: Record<string, string>): MessageAttributes {
  if (body.MessageStructure === "json") {
    return {};
  }

  const entries = Object.keys(body)
    .filter((key) => key.startsWith("MessageAttributes.entry"))
    .reduce<string[]>((prev, key) => {
      const index = key
        .replace("MessageAttributes.entry.", "")
        .match(/.*?(?=\.|$)/i)![0];
      return prev.includes(index) ? prev : [...prev, index];
    }, []);
  return entries
    .map((index) => `MessageAttributes.entry.${index}`)
    .reduce<MessageAttributes>(
      (prev, baseKey) => ({
        ...prev,
        [`${body[`${baseKey}.Name`]}`]: {
          Type: body[`${baseKey}.Value.DataType`],
          Value:
            body[`${baseKey}.Value.BinaryValue`] ||
            body[`${baseKey}.Value.StringValue`],
        },
      }),
      {}
    );
}

export function parseAttributes(body: Record<string, string>): Record<string, string> {
  const indices = Object.keys(body)
    .filter((key) => key.startsWith("Attributes.entry"))
    .reduce<string[]>((prev, key) => {
      const index = key
        .replace("Attributes.entry.", "")
        .match(/.*?(?=\.|$)/i)![0];
      return prev.includes(index) ? prev : [...prev, index];
    }, []);
  const attrs: Record<string, string> = {};
  for (const key of indices.map((index) => `Attributes.entry.${index}`)) {
    attrs[body[`${key}.key`]] = body[`${key}.value`];
  }
  return attrs;
}

export function createSnsLambdaEvent(
  topicArn: string,
  subscriptionArn: string,
  subject: string,
  message: string,
  messageId: string,
  messageAttributes?: MessageAttributes,
  messageGroupId?: string
) {
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
          ...(messageGroupId && { MessageGroupId: messageGroupId }),
          Type: "Notification",
          UnsubscribeUrl: "EXAMPLE",
          TopicArn: topicArn,
          Subject: subject,
        },
      },
    ],
  };
}

export function createSnsTopicEvent(
  topicArn: string,
  subscriptionArn: string,
  subject: string,
  message: string,
  messageId: string,
  messageStructure: string,
  messageAttributes?: MessageAttributes,
  messageGroupId?: string
) {
  return {
    SignatureVersion: "1",
    Timestamp: new Date().toISOString(),
    Signature: "EXAMPLE",
    SigningCertUrl: "EXAMPLE",
    MessageId: messageId,
    Message: message,
    MessageStructure: messageStructure,
    MessageAttributes: messageAttributes || {},
    ...(messageGroupId && { MessageGroupId: messageGroupId }),
    Type: "Notification",
    UnsubscribeUrl: "EXAMPLE",
    TopicArn: topicArn,
    Subject: subject,
  };
}

export function createMessageId() {
  return uuid();
}

const phoneNumberValidator = /^\++?[1-9]\d{1,14}$/;

export function validatePhoneNumber(phoneNumber: string) {
  if (!phoneNumberValidator.test(phoneNumber)) {
    throw new Error(`PhoneNumber ${phoneNumber} is not valid to publish`);
  }
  return phoneNumber;
}

// the topics name is that last part of the ARN:
// arn:aws:sns:<REGION>:<ACCOUNT_ID>:<TOPIC_NAME>
export const topicNameFromArn = (arn: string) => {
  const arnParts = arn.split(":");
  return arnParts[arnParts.length - 1];
};

export const topicArnFromName = (name: string, region: string, accountId: string) =>
  `arn:aws:sns:${region}:${accountId}:${name}`;

export const formatMessageAttributes = (
  messageAttributes: MessageAttributes
) => {
  const newMessageAttributes: Record<string, { DataType: string; StringValue: string }> = {};
  for (const [key, value] of Object.entries(messageAttributes)) {
    newMessageAttributes[key] = {
      DataType: value.Type,
      StringValue: value.Value,
    };
  }
  return newMessageAttributes;
};

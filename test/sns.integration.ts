import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import {
  SQSClient,
  CreateQueueCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";
import { expect } from "chai";
import { spawn, ChildProcess } from "child_process";
import Redis from "ioredis";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCALSTACK_ENDPOINT = "http://127.0.0.1:4566";
const REDIS_KEY = "sns-results";
const SLS_CONFIG = path.join(__dirname, "integration", "serverless.yml");
const SLS_CWD = path.join(__dirname, "integration");

const awsConfig = {
  endpoint: LOCALSTACK_ENDPOINT,
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
};

interface SnsLambdaEvent {
  Records: Array<{ Sns: { Message: string } }>;
}

let slsProcess: ChildProcess;
let redis: Redis;

async function waitForPorts(ports: number[], timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (const port of ports) {
    while (Date.now() < deadline) {
      try {
        await fetch(`http://127.0.0.1:${port}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for port ${port}`);
    }
  }
}

describe("SNS integration tests", function () {
  this.timeout(60000);

  before(async function () {
    redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
    await redis.del(REDIS_KEY);

    // Create SQS queue in LocalStack before serverless starts so the
    // config.subscriptions wiring in the plugin can subscribe to it.
    const sqs = new SQSClient(awsConfig);
    const queueUrl = `${LOCALSTACK_ENDPOINT}/000000000000/integration-queue`;
    await sqs.send(new CreateQueueCommand({ QueueName: "integration-queue" }));
    await sqs.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));

    slsProcess = spawn(
      process.execPath,
      [
        path.join(__dirname, "integration", "node_modules", "serverless", "run.js"),
        "offline",
        "--config", SLS_CONFIG,
      ],
      {
        cwd: SLS_CWD,
        stdio: "pipe",
        detached: true,
        env: {
          ...process.env,
          NODE_OPTIONS: "",
          AWS_ACCESS_KEY_ID: "test",
          AWS_SECRET_ACCESS_KEY: "test",
          AWS_REGION: "us-east-1",
        },
      }
    );

    slsProcess.stdout?.on("data", (d) =>
      process.stdout.write(`[sls] ${d}`)
    );
    slsProcess.stderr?.on("data", (d) =>
      process.stderr.write(`[sls] ${d}`)
    );

    await waitForPorts([3002, 4002]);
    // Give the plugin time to finish wiring subscriptions after ports are up.
    await new Promise((r) => setTimeout(r, 2000));
  });

  after(async function () {
    if (slsProcess && slsProcess.pid && !slsProcess.killed) {
      process.kill(-slsProcess.pid, "SIGKILL");
    }
    await redis.quit();
  });

  it("SNS → Lambda: both subscribers receive the event with correct message content", async function () {
    await redis.del(REDIS_KEY);
    const sns = new SNSClient(awsConfig);
    const message = `integration-test-${Date.now()}`;

    await sns.send(
      new PublishCommand({
        TopicArn: "arn:aws:sns:us-east-1:000000000000:integration-topic",
        Message: message,
      })
    );

    const events: SnsLambdaEvent[] = [];
    for (let i = 0; i < 2; i++) {
      const result = await redis.blpop(REDIS_KEY, 15);
      if (!result) throw new Error(`Timed out waiting for SNS→Lambda delivery (got ${i}/2)`);
      events.push(JSON.parse(result[1]) as SnsLambdaEvent);
    }

    for (const event of events) {
      expect(event).to.have.property("Records").with.lengthOf(1);
      expect(event.Records[0].Sns.Message).to.equal(message);
    }
  });

  it("SNS → SQS: message routed to queue via plugin subscription", async function () {
    const sns = new SNSClient(awsConfig);
    const sqs = new SQSClient(awsConfig);
    const message = `sqs-test-${Date.now()}`;

    await sns.send(
      new PublishCommand({
        TopicArn: `arn:aws:sns:us-east-1:000000000000:integration-sqs-topic`,
        Message: message,
      })
    );

    const deadline = Date.now() + 5000;
    let received: Message | null = null;

    while (Date.now() < deadline) {
      const result = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: `${LOCALSTACK_ENDPOINT}/000000000000/integration-queue`,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 1,
        })
      );
      if (result.Messages && result.Messages.length > 0) {
        received = result.Messages[0];
        break;
      }
    }

    expect(received).to.not.be.null;
    const body = JSON.parse(received.Body);
    expect(body.Message).to.equal(message);
  });
});

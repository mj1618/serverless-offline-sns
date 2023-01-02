export interface Store {
  sms: SmsMessage[],
}

export interface SmsMessage {
  messageId: string,
  destination: string,
  subject: string,
  body: string,
  at: number,
}

const store: Store = {
  sms: [],
};

export default store;
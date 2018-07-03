import { setEvent, setPongs, setResult } from "./mock.state";

let nPongs = 0;

export const resetPongs = () => {
    nPongs = 0;
    setPongs(0);
};

export const pongHandler = (evt, ctx, cb) => {
    nPongs += 1;
    setPongs(nPongs);
    setEvent(evt);
    cb("{}");
};

export const envHandler = (evt, ctx, cb) => {
    setResult(process.env["MY_VAR"]);
    cb("{}");
};

export const pseudoHandler = (evt, ctx, cb) => {
    setResult(evt.Records[0].Sns.TopicArn);
    cb("{}");
};

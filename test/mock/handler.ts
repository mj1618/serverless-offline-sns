let nPongs = 0;
let event;
let result = "";

export const resetResult = () => result = "";
export const getResult = () => result;
export const getPongs = () => nPongs;
export const resetPongs = () => nPongs = 0;
export const getEvent = () => event;
export const resetEvent = () => event = undefined;
export const pongHandler = (evt, ctx, cb) => {
    nPongs += 1;
    event = evt;
    cb("{}");
};

export const envHandler = (evt, ctx, cb) => {
    result = process.env["MY_VAR"];
    cb("{}");
};

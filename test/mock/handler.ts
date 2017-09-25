let nPongs = 0;

export const getPongs = () => nPongs;
export const resetPongs = () => nPongs = 0;
export const pongHandler = (event, ctx, cb) => {
    nPongs += 1;
    cb("{}");
};

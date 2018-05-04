let hits = 0;

export const resetHits = () => hits = 0;
export const getHits = () => hits;

export const itsGotDots = (evt, ctx, cb) => {
    hits += 1;
    cb("{}");
};

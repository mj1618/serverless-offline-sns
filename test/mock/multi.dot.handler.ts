import { setPongs } from "./mock.state";

let nPongs = 0;

export const itsGotDots = (evt, ctx, cb) => {
    nPongs += 1;
    setPongs(nPongs);
    cb(null, "{}");
};

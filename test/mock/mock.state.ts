let nPongs = 0;
let event;
let result = "";

export const resetResult = () => result = "";
export const getResult = () => result;
export const setResult = value => result = value;
export const getPongs = () => nPongs;
export const setPongs = value => nPongs = value;
export const getEvent = () => event;
export const setEvent = evt => event = evt;
export const resetEvent = () => event = undefined;
export const addPong = () => {
    nPongs += 1;
};

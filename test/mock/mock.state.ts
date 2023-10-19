let nPongs = 0;
let event;
let resolve;
let deferred;

export const resetResult = () =>
  (deferred = new Promise((res) => (resolve = (result) => res(result))));
export const getResult = async () => deferred;
export const setResult = (value) => {
  resolve(value);
};
export const getPongs = () => nPongs;
export const setPongs = (value) => (nPongs = value);
export const getEvent = () => event;
export const setEvent = (evt) => (event = evt);
export const resetEvent = () => (event = undefined);
export const addPong = () => {
  nPongs += 1;
};

let nPongs = 0;
let event;
let _resolve;
let _deferred;

export const resetResult = () =>
  (_deferred = new Promise((res) => (_resolve = (result) => res(result))));
export const getResult = async () => _deferred;
export const setResult = (value) => {
  _resolve(value);
};
export const getPongs = () => nPongs;
export const setPongs = (value) => (nPongs = value);
export const getEvent = () => event;
export const setEvent = (evt) => (event = evt);
export const resetEvent = () => (event = undefined);
export const addPong = () => {
  nPongs += 1;
};

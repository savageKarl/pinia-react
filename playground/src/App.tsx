import { defineStore } from "../../src";

export const useCounterStore = defineStore("counter", {
  state: () => {
    return { count: 0 };
  },
  actions: {
    increment() {
      this.count++;
    },
  },
});

export function App() {
  const store = useCounterStore();
  return (
    <>
      <h1>hello, world!</h1>
      <p>{store.count}</p>
      <button onClick={() => store.increment()}>increate</button>
    </>
  );
}

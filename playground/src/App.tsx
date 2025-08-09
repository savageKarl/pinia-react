import { defineStore } from "../../src";

export const useCounterStore = defineStore("counter", {
  state: () => {
    return { count: 0 };
  },
  actions: {
    increment() {
      // 这里的问题，类型提示不见了，不过这不是优先需要处理的
      this.count++;

      setTimeout(() => {
        console.log(this.count)
      })
    },
  },
});

export function App() {
  const store = useCounterStore();
  return (
    <>
      <h1>{store.count}</h1>
      <button onClick={() => store.increment()}>increate</button>
    </>
  );
}

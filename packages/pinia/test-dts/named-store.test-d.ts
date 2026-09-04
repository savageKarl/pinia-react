import { defineStore, expectType, type TypeEqual } from '.'

const { useMainStore, getMainStore } = defineStore('main', {
  state: () => ({
    count: 0
  }),
  actions: {
    increment() {
      this.count++
    }
  }
})

type MainStore = ReturnType<typeof getMainStore>

expectType<() => MainStore>(useMainStore)
expectType<() => MainStore>(getMainStore)
expectType<number>(getMainStore().count)
expectType<TypeEqual<ReturnType<typeof getMainStore>, ReturnType<typeof useMainStore>>>(true)

const { useUserProfileStore, getUserProfileStore } = defineStore('userProfile', {
  state: () => ({
    name: 'Developer'
  })
})

type UserProfileStore = ReturnType<typeof getUserProfileStore>

expectType<() => UserProfileStore>(useUserProfileStore)
expectType<() => UserProfileStore>(getUserProfileStore)
expectType<string>(getUserProfileStore().name)

const { useStore, getStore } = defineStore('legacy', {
  state: () => ({
    value: true
  })
})

expectType<boolean>(getStore().value)
expectType<() => ReturnType<typeof getStore>>(useStore)

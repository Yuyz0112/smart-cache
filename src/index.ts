import { StoreValue } from 'apollo-utilities'
import {
  InMemoryCache,
  NormalizedCacheObject,
  defaultDataIdFromObject,
} from 'apollo-cache-inmemory'
import { DepTrackingCache } from 'apollo-cache-inmemory/lib/depTrackingCache'
import { ApolloClient, OperationVariables } from 'apollo-client'
import { DocumentNode } from 'graphql'
import { QueryInfo } from 'apollo-client/core/QueryManager'

export type TypeFieldMap = Map<
  string,
  { dependentTypes: Set<string>; dependentQueries: Set<string> }
>

type GetVariables = (
  document: DocumentNode,
  variables?: OperationVariables
) => OperationVariables

// same as defaultDataIdFromObject
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IdGetterObj = any

declare module 'apollo-cache-inmemory' {
  interface InMemoryCache {
    delete(typeName: string, value?: IdGetterObj): void
    typeFieldMap: TypeFieldMap
    setTypeFieldMap: (v: TypeFieldMap) => void
  }
}

declare module 'apollo-client' {
  interface ApolloClient<TCacheShape> {
    deleteCache(typeName: string, value?: IdGetterObj): void
  }
}

const checkValueFromAnyObject = (
  target: string,
  valueToBeChecked: StoreValue
) => {
  let flag = false
  let queue = [valueToBeChecked]
  while (!flag && queue.length) {
    const currentValue = queue.shift()
    if (typeof currentValue !== 'object' || !currentValue) {
      continue
    }
    flag = Object.values(currentValue).some(value => {
      if (
        value === target &&
        'id' in currentValue &&
        currentValue.id === target
      ) {
        return true
      }
      if (value && typeof value === 'object') {
        queue.push(value)
      }
      return false
    })
  }
  return flag
}

const basicInvalidateCache = (
  store: DepTrackingCache,
  cache: NormalizedCacheObject,
  deletedKeys: string[]
) => {
  let deletedTopKeys = [...deletedKeys]
  let keysNeedToBeCheck = [...deletedKeys]
  let flag = true
  while (flag) {
    flag = false
    const temp = [...keysNeedToBeCheck]
    keysNeedToBeCheck = []
    for (const key of temp) {
      for (const topKey of Object.keys(cache)) {
        if (
          topKey !== 'ROOT_QUERY' &&
          checkValueFromAnyObject(key, cache[topKey])
        ) {
          store.delete(topKey)
          deletedTopKeys.push(topKey)
          keysNeedToBeCheck.push(topKey)
          flag = true
        }
      }
    }
  }

  const deletedQueryNames = []
  const rootQuery = cache['ROOT_QUERY']!
  for (const queryName of Object.keys(rootQuery)) {
    for (const deletedKey of deletedTopKeys) {
      if (checkValueFromAnyObject(deletedKey, rootQuery[queryName])) {
        store.delete(`ROOT_QUERY.${queryName}`)
        deletedQueryNames.push(queryName.split('(')[0])
      }
    }
  }

  for (const key of deletedQueryNames) {
    for (const queryName of Object.keys(rootQuery)) {
      if (queryName.includes(key)) {
        delete rootQuery[queryName]
      }
    }
  }
}

export function patch(
  ApolloClientClass: typeof ApolloClient,
  InMemoryCacheClass: typeof InMemoryCache
) {
  InMemoryCacheClass.prototype.setTypeFieldMap = function(v: TypeFieldMap) {
    this.typeFieldMap = v
  }

  InMemoryCache.prototype.delete = function(
    this: InMemoryCache,
    typeName: string,
    value: IdGetterObj
  ) {
    const store: DepTrackingCache = this['data']
    const cacheData: NormalizedCacheObject = store['data']
    const dataIdFromObjectFn =
      this['config'].dataIdFromObject || defaultDataIdFromObject

    const originKeyToBeDeleted = value && dataIdFromObjectFn(value)
    let deletedTopKeys = []

    if (
      originKeyToBeDeleted &&
      Object.keys(cacheData).includes(originKeyToBeDeleted)
    ) {
      store.delete(originKeyToBeDeleted)
      deletedTopKeys.push(originKeyToBeDeleted)
    } else {
      const filedsForDelete = this.typeFieldMap.get(typeName)
      if (!filedsForDelete) {
        throw new Error('Error: No Such Type')
      }
      for (const query of Object.keys(cacheData['ROOT_QUERY']!)) {
        const currentQuery = query.split('(')[0]
        if (filedsForDelete.dependentQueries.has(currentQuery)) {
          store.delete(`ROOT_QUERY.${query}`)
        }
      }
      for (const topKey of Object.keys(cacheData)) {
        const currentTopKeyType = topKey.split(':')[0]
        if (filedsForDelete.dependentTypes.has(currentTopKeyType)) {
          store.delete(topKey)
          deletedTopKeys.push(topKey)
        }
      }
    }

    basicInvalidateCache(store, cacheData, deletedTopKeys)
  }

  ApolloClientClass.prototype.deleteCache = function(
    typeName: string,
    value?: IdGetterObj
  ) {
    ;(this.cache as InMemoryCache).delete.call(this.cache, typeName, value)
    const queries: Map<string, QueryInfo> = this.queryManager['queries']

    // Step 1
    queries.forEach(({ observableQuery }) => {
      // Step 2-1
      if (!observableQuery) {
        return
      }

      // Step 2-2
      const { fetchPolicy, query, variables } = observableQuery.options
      if (fetchPolicy === 'network-only' || fetchPolicy === 'no-cache') {
        return
      }

      // Step 2-3
      const cacheQuery = this.queryManager.transform(query).document
      const getVariables: GetVariables = this.queryManager['getVariables']
      const cacheVariables = getVariables.call(
        this.queryManager,
        cacheQuery,
        variables
      )
      const { complete } = this.cache.diff({
        query: cacheQuery,
        variables: cacheVariables,
        returnPartialData: true,
        optimistic: false,
      })

      if (!complete) {
        // Step 3
        observableQuery.resetLastResults()
        observableQuery.refetch()
      }
    })
  }
}

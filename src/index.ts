import { StoreValue, IdValue } from 'apollo-utilities'
import {
  InMemoryCache,
  NormalizedCacheObject,
  StoreObject,
  defaultDataIdFromObject,
} from 'apollo-cache-inmemory'
import { DepTrackingCache } from 'apollo-cache-inmemory/lib/depTrackingCache'
import { ApolloClient, OperationVariables } from 'apollo-client'
import { DocumentNode } from 'graphql'
import { QueryInfo } from 'apollo-client/core/QueryManager'

interface CacheSelector {
  typename?: string
  value?: IdGetterObj
  query?: string
}

interface CacheDeleteOptions {
  refetch?: boolean
}

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
    delete(typename?: string, value?: IdGetterObj, query?: string): void
    typeFieldMap: TypeFieldMap
    setTypeFieldMap: (v: TypeFieldMap) => void
  }
}

declare module 'apollo-client' {
  interface ApolloClient<TCacheShape> {
    deleteCache(
      cacheSelector: CacheSelector,
      options?: CacheDeleteOptions
    ): void
  }
}

// If the scalar value is a JSON blob, type will be { type: 'json', json: value }
const isIdValue = (value: StoreValue): value is IdValue => {
  if (typeof value !== 'object' || !value) {
    return false
  }
  if ('type' in value) {
    return value.type === 'id'
  }
  return false
}

const isIdValueArray = (value: StoreValue): value is IdValue[] => {
  if (!Array.isArray(value) || !value.length) {
    return false
  }
  return isIdValue(value[0]) // union value can only include Object types, so no need to check every item in arrary
}

// if dependentTypes exist, sort keys in dependentTypes before
function sort(keys: string[], dependentTypes?: Set<string>) {
  if (!dependentTypes) return keys.sort()

  const inDependentTypes = (key: string) => {
    const type = key.split(':')[0]
    return dependentTypes.has(type)
  }

  return keys.sort((a, b) => {
    const _a = inDependentTypes(a)
    const _b = inDependentTypes(b)

    if (_a && !_b) {
      return -1
    } else if (!_a && _b) {
      return 1
    } else {
      return a.localeCompare(b)
    }
  })
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function omit(obj: any, remove: string[] | string) {
  const result: any = {}
  const removeSet = new Set(
    Array.isArray(remove) ? remove : [].slice.call(arguments, 1)
  )

  for (const prop in obj) {
    if (!obj.hasOwnProperty || obj.hasOwnProperty(prop)) {
      if (!removeSet.has(prop)) {
        result[prop] = obj[prop]
      }
    }
  }
  return result
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function extractIds(obj: StoreValue, ids: Set<string>) {
  if (obj && typeof obj === 'object') {
    if ('id' in obj) {
      ids.add(obj.id)
      if ((obj as { type: string }).type === 'id') {
        return
      }
    }
    Object.values(obj).forEach(value => extractIds(value, ids))
  }
}

function createTopKeyIdMap(
  obj: NormalizedCacheObject | StoreObject
): Map<string, Set<string>> {
  const idMap = new Map<string, Set<string>>()

  for (const key in obj) {
    const ids = new Set<string>()
    extractIds(obj[key], ids)

    if (ids.size) idMap.set(key, ids)
  }

  return idMap
}

const basicInvalidateCache = (
  store: DepTrackingCache,
  cache: NormalizedCacheObject,
  deletedKeys: string[]
) => {
  const topKeyIdMap = createTopKeyIdMap(cache)

  const deletedTopKeys = new Set(deletedKeys)
  let keysNeedToBeCheck = [...deletedKeys]

  const checkedKeys = new Set<string>()
  for (let i = 0; i < keysNeedToBeCheck.length; i++) {
    const key = keysNeedToBeCheck[i]
    if (checkedKeys.has(key)) {
      continue
    }
    topKeyIdMap.forEach((idSet, topKey) => {
      if (deletedTopKeys.has(topKey)) {
        return
      }
      if (topKey !== 'ROOT_QUERY' && idSet.has(key)) {
        store.delete(topKey)
        deletedTopKeys.add(topKey)
        keysNeedToBeCheck.push(topKey)
      }
    })
    checkedKeys.add(key)
  }

  // clear them to release memory ASAP
  keysNeedToBeCheck = []
  checkedKeys.clear()
  topKeyIdMap.clear()

  const rootQuery = cache['ROOT_QUERY']!
  const rootQueryKeyIdMap = createTopKeyIdMap(rootQuery)

  const omitKeys = new Set<string>()
  const deletedQueryNames = new Set<string>()
  rootQueryKeyIdMap.forEach((idSet, queryName) => {
    if (omitKeys.has(queryName)) {
      return
    }
    for (const deletedKey of deletedTopKeys) {
      if (idSet.has(deletedKey)) {
        omitKeys.add(queryName)
        deletedQueryNames.add(queryName.split('(')[0])
      }
    }
  })

  // clear them to release memory ASAP
  deletedTopKeys.clear()
  rootQueryKeyIdMap.clear()

  for (const key of deletedQueryNames) {
    for (const queryName of Object.keys(rootQuery)) {
      if (queryName.includes(key)) {
        omitKeys.add(queryName)
      }
    }
  }

  const storeObject = store.get('ROOT_QUERY')
  store.set('ROOT_QUERY', omit(storeObject, Array.from(omitKeys)))
  omitKeys.clear()
}

export function patch(
  ApolloClientClass: typeof ApolloClient,
  InMemoryCacheClass: typeof InMemoryCache
) {
  InMemoryCache.prototype.typeFieldMap = new Map()

  InMemoryCacheClass.prototype.setTypeFieldMap = function (v: TypeFieldMap) {
    this.typeFieldMap = v
  }

  InMemoryCache.prototype.delete = function (
    this: InMemoryCache,
    typename?: string,
    value?: IdGetterObj,
    query?: string
  ) {
    const store: DepTrackingCache = this['data']
    const cacheData: NormalizedCacheObject = store['data']
    const dataIdFromObjectFn =
      this['config'].dataIdFromObject || defaultDataIdFromObject

    const originKeyToBeDeleted = value && dataIdFromObjectFn(value)
    let deletedTopKeys: string[] = []

    const deleteQueryInRoot = (queryInRoot: string) => {
      const storeObject = store.get('ROOT_QUERY')
      const queryResult = storeObject[queryInRoot]
      if (isIdValueArray(queryResult)) {
        queryResult.forEach(e => store.delete(e.id))
      } else if (isIdValue(queryResult)) {
        store.delete(queryResult.id)
      }
      store.set('ROOT_QUERY', omit(storeObject, queryInRoot))
    }

    const cacheKeys = Object.keys(cacheData)
    if (originKeyToBeDeleted && cacheKeys.includes(originKeyToBeDeleted)) {
      store.delete(originKeyToBeDeleted)
      deletedTopKeys.push(originKeyToBeDeleted)
    } else if (typename) {
      const filedsForDelete = this.typeFieldMap.get(typename)
      if (!filedsForDelete) {
        throw new Error('Error: No Such Type')
      }
      for (const query of Object.keys(cacheData['ROOT_QUERY']!)) {
        const currentQuery = query.split('(')[0]
        if (filedsForDelete.dependentQueries.has(currentQuery)) {
          deleteQueryInRoot(query)
        }
      }
      for (const topKey of cacheKeys) {
        const currentTopKeyType = topKey.split(':')[0]
        if (filedsForDelete.dependentTypes.has(currentTopKeyType)) {
          store.delete(topKey)
          deletedTopKeys.push(topKey)
        }
      }
    }

    if (query) {
      for (const queryInRoot of Object.keys(cacheData['ROOT_QUERY']!)) {
        const currentQuery = queryInRoot.split('(')[0]
        if (query === currentQuery) {
          deleteQueryInRoot(query)
        }
      }
    }

    if (deletedTopKeys.length) {
      basicInvalidateCache(store, cacheData, deletedTopKeys)
    }
  }

  // compared to cache.delete above, this, client.delete,  will refetch deleted active cache
  ApolloClientClass.prototype.deleteCache = function (
    cacheSelector: CacheSelector,
    options?: CacheDeleteOptions
  ) {
    const { typename, value, query } = cacheSelector
    ;(this.cache as InMemoryCache).delete.call(
      this.cache,
      typename,
      value,
      query
    )

    if (options && options.refetch === false) {
      return
    }

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

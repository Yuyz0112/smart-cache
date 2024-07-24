import { readFileSync } from 'fs'
import { join } from 'path'
import * as Benchmark from 'benchmark'
import { SchemaLink } from 'apollo-link-schema'
import { makeExecutableSchema } from 'graphql-tools'
import { ApolloClient } from 'apollo-client'
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory'
import { patch } from '../src/index'
import { typeFieldMap } from './fixture/typeFieldMap'
import { generateFakeData } from './utils'

const typeDefs = readFileSync(
  join(__dirname, './fixture/schema.graphql'),
  'utf8'
)

patch(ApolloClient, InMemoryCache)

const getClientInstance = () => {
  const link = new SchemaLink({
    schema: makeExecutableSchema({
      typeDefs,
      resolvers: {},
    }),
  })

  const cache = new InMemoryCache()
  cache.setTypeFieldMap(typeFieldMap)
  const client = new ApolloClient({
    link,
    cache,
  })
  return client
}

const suite = new Benchmark.Suite()

const benchmark = (
  description: string,
  fns:
    | {
        benchmarkFn: (done: () => void) => void
      }
    | {
        prepare: () => {
          client: ApolloClient<NormalizedCacheObject>
          cacheData: NormalizedCacheObject
        }
        benchmarkFn: (
          done: () => void,
          data: {
            client: ApolloClient<NormalizedCacheObject>
            cacheData: NormalizedCacheObject
          }
        ) => void
      }
) => {
  const name = description
  console.log('Adding benchmark: ', name)

  if ('prepare' in fns) {
    const { benchmarkFn, prepare } = fns
    const client = prepare()
    suite.add(name, {
      defer: true,
      fn: (deferred: any) => {
        const done = () => {
          deferred.resolve()
        }
        benchmarkFn(done, client)
      },
    })
    return
  }

  const { benchmarkFn } = fns
  suite.add(name, {
    defer: true,
    fn: (deferred: any) => {
      const done = () => {
        deferred.resolve()
      }
      benchmarkFn(done)
    },
  })
}

benchmark('baseline', {
  benchmarkFn: (done: () => void) => {
    let arr = Array.from({ length: 100 }, () => Math.random())
    arr.sort()
    done()
  },
})

benchmark('deleteCache 10x data', {
  prepare: () => {
    const cacheData = generateFakeData(10)
    const client = getClientInstance()
    console.log(
      `deleteCache 10x data: check keys count ${
        Object.keys(cacheData).length
      }\n`
    )
    return { client, cacheData }
  },
  benchmarkFn: (done, { client, cacheData }) => {
    const typename = 'User'
    client.cache.restore(cacheData)
    client.deleteCache({ typename })
    done()
  },
})

benchmark('deleteCache 100x data', {
  prepare: () => {
    const cacheData = generateFakeData(100)
    const client = getClientInstance()
    console.log(
      `deleteCache 100x data: check keys count ${
        Object.keys(cacheData).length
      }\n`
    )
    return { client, cacheData }
  },
  benchmarkFn: (done, { client, cacheData }) => {
    const typename = 'User'
    client.cache.restore(cacheData)
    client.deleteCache({ typename })
    done()
  },
})

benchmark('deleteCache 500x data', {
  prepare: () => {
    const cacheData = generateFakeData(500)
    const client = getClientInstance()
    console.log(
      `deleteCache 500x data: check keys count ${
        Object.keys(cacheData).length
      }\n`
    )
    return { client, cacheData }
  },
  benchmarkFn: (done, { client, cacheData }) => {
    const typename = 'User'
    client.cache.restore(cacheData)
    client.deleteCache({ typename })
    done()
  },
})

benchmark('deleteCache 1000x data', {
  prepare: () => {
    const cacheData = generateFakeData(1000)
    const client = getClientInstance()
    console.log(
      `deleteCache 1000x data: check keys count ${
        Object.keys(cacheData).length
      }\n`
    )
    return { client, cacheData }
  },
  benchmarkFn: (done, { client, cacheData }) => {
    const typename = 'User'
    client.cache.restore(cacheData)
    client.deleteCache({ typename })
    done()
  },
})

suite
  .on('error', (error: any) => {
    console.log('Error: ', error)
  })
  .on('cycle', (event: any) => {
    console.log('Mean time in ms: ', event.target.stats.mean * 1000)
    console.log(String(event.target))
    console.log('')
  })
  .run({ async: true })

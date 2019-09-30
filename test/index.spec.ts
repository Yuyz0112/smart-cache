import { readFileSync } from 'fs'
import { join } from 'path'
import { expect } from 'chai'
import gql from 'graphql-tag'
import { SchemaLink } from 'apollo-link-schema'
import { makeExecutableSchema } from 'graphql-tools'
import { ApolloClient } from 'apollo-client'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { patch } from '../src/index'
import { typeFieldMap } from './fixture/typeFieldMap'

const typeDefs = readFileSync(
  join(__dirname, './fixture/schema.graphql'),
  'utf8'
)
const fixture = {
  posts: [{ id: '1', title: 'Post 1' }, { id: '2', title: 'Post 2' }],
  users: [
    {
      id: '1',
      posts: [{ id: '2', title: 'Post 2' }],
    },
    {
      id: '2',
      posts: [],
    },
  ],
  fuzzy: [
    {
      id: '1',
      posts: 'fuzzy key',
      content: 'Post:1',
    },
  ],
  noIds: [{ id: 'a', content: 'no id' }],
  pureText: 'abc',
}
let db = JSON.parse(JSON.stringify(fixture)) as typeof fixture
function restoreDB() {
  db = JSON.parse(JSON.stringify(fixture))
}

const link = new SchemaLink({
  schema: makeExecutableSchema({
    typeDefs,
    resolvers: {
      Query: {
        getUser(parent, args) {
          return db.users.find(u => u.id === args.id)
        },
        getPosts(parent, args) {
          const limit = 1
          const { page } = args
          return db.posts.slice((page - 1) * limit, page * limit)
        },
        fuzzy() {
          return db.fuzzy
        },
        nested() {
          return {
            id: '1',
            users: db.users,
            posts: db.posts,
            fuzzy: db.fuzzy,
          }
        },
        noId() {
          return db.noIds[0]
        },
        emptyUsers() {
          return []
        },
        pureText() {
          return db.pureText
        },
      },
      Mutation: {
        deletePost(parent, args) {
          db.posts = db.posts.filter(p => p.id !== args.id)
          return args.id
        },
      },
    },
  }),
})

patch(ApolloClient, InMemoryCache)

const cache = new InMemoryCache()
cache.setTypeFieldMap(typeFieldMap)
const client = new ApolloClient({
  link,
  cache,
})

function haveProps(object: object, props: string[]) {
  props.forEach(prop => expect(object).to.have.nested.property(prop))
}
function notHaveProps(object: object, props: string[]) {
  props.forEach(prop => expect(object).to.not.have.nested.property(prop))
}

describe('cache invalidation', () => {
  beforeEach(() => {
    restoreDB()
    client.cache.reset()
  })

  it('can delete an entity and corresponding queries', async () => {
    await client.query({
      query: gql`
        query {
          getUser(id: "1") {
            id
            posts {
              id
              title
            }
          }
        }
      `,
    })
    haveProps(client.cache.extract(), [
      'ROOT_QUERY.getUser({"id":"1"})',
      'User:1',
      'Post:2',
    ])
    client.deleteCache({
      typename: 'User',
      value: {
        __typename: 'User',
        id: '1',
      },
    })
    haveProps(client.cache.extract(), ['Post:2'])
    notHaveProps(client.cache.extract(), [
      'ROOT_QUERY.getUser({"id":"1"})',
      'User:1',
    ])
  })

  it('can delete an deep dependent entity and corresponding queries', async () => {
    await client.query({
      query: gql`
        query {
          getUser(id: "1") {
            id
            posts {
              id
              title
            }
          }
        }
      `,
    })
    haveProps(client.cache.extract(), [
      'ROOT_QUERY.getUser({"id":"1"})',
      'User:1',
      'Post:2',
    ])
    client.deleteCache({
      typename: 'Post',
      value: {
        __typename: 'Post',
        id: '2',
      },
    })
    notHaveProps(client.cache.extract(), [
      'ROOT_QUERY.getUser({"id":"1"})',
      'User:1',
      'Post:2',
    ])
  })

  it('can delete pagination data when any dependent entity was removed', async () => {
    await client.query({
      query: gql`
        query {
          getPosts(page: 1) {
            id
            title
          }
        }
      `,
    })
    await client.query({
      query: gql`
        query {
          getPosts(page: 2) {
            id
            title
          }
        }
      `,
    })
    haveProps(client.cache.extract(), [
      'ROOT_QUERY.getPosts({"page":1})',
      'ROOT_QUERY.getPosts({"page":2})',
      'Post:1',
      'Post:2',
    ])
    client.deleteCache({
      typename: 'Post',
      value: { __typename: 'Post', id: '2' },
    })
    haveProps(client.cache.extract(), ['Post:1'])
    notHaveProps(client.cache.extract(), [
      'ROOT_QUERY.getPosts({"page":1})',
      'ROOT_QUERY.getPosts({"page":2})',
      'Post:2',
    ])
  })

  it('can delete a type of entities and there corresponding queries', async () => {
    await client.query({
      query: gql`
        query {
          getUser(id: "1") {
            id
            posts {
              id
              title
            }
          }
        }
      `,
    })
    await client.query({
      query: gql`
        query {
          getPosts(page: 1) {
            id
            title
          }
        }
      `,
    })
    await client.query({
      query: gql`
        query {
          getPosts(page: 2) {
            id
            title
          }
        }
      `,
    })
    haveProps(client.cache.extract(), [
      'ROOT_QUERY.getUser({"id":"1"})',
      'ROOT_QUERY.getPosts({"page":1})',
      'ROOT_QUERY.getPosts({"page":2})',
      'User:1',
      'Post:1',
      'Post:2',
    ])
    client.deleteCache({ typename: 'Post' })
    notHaveProps(client.cache.extract(), [
      'ROOT_QUERY.getUser({"id":"1"})',
      'ROOT_QUERY.getPosts({"page":1})',
      'ROOT_QUERY.getPosts({"page":2})',
      'User:1',
      'Post:1',
      'Post:2',
    ])
  })

  it('should not match field value', async () => {
    await client.query({
      query: gql`
        query {
          fuzzy {
            id
            posts
            content
          }
        }
      `,
    })
    await client.query({
      query: gql`
        query {
          getPosts(page: 1) {
            id
            title
          }
        }
      `,
    })
    haveProps(client.cache.extract(), [
      'ROOT_QUERY.fuzzy',
      'ROOT_QUERY.getPosts({"page":1})',
      'Fuzzy:1',
      'Post:1',
    ])
    client.deleteCache({ typename: 'Post' })
    haveProps(client.cache.extract(), ['ROOT_QUERY.fuzzy', 'Fuzzy:1'])
    notHaveProps(client.cache.extract(), [
      'ROOT_QUERY.getPosts({"page":1})',
      'Post:1',
    ])
  })

  it('handle nested value', async () => {
    await client.query({
      query: gql`
        query {
          nested {
            id
            users {
              id
              posts {
                id
                title
              }
            }
            posts {
              id
              title
            }
            fuzzy {
              id
              posts
              content
            }
          }
        }
      `,
    })
    haveProps(client.cache.extract(), [
      'ROOT_QUERY.nested',
      'Nested:1',
      'User:1',
      'User:2',
      'Post:1',
      'Post:2',
      'Fuzzy:1',
    ])
    client.deleteCache({ typename: 'Post' })
    haveProps(client.cache.extract(), ['Fuzzy:1'])
    notHaveProps(client.cache.extract(), [
      'ROOT_QUERY.nested',
      'Nested:1',
      'User:1',
      'User:2',
      'Post:1',
      'Post:2',
    ])
  })

  it('can delete entity without id', async () => {
    await client.query({
      query: gql`
        query {
          noId {
            # id
            content
          }
        }
      `,
    })
    expect(client.cache.extract()).to.have.property('$ROOT_QUERY.noId')
    haveProps(client.cache.extract(), ['ROOT_QUERY.noId'])
    client.deleteCache({ typename: 'NoId' })
    expect(client.cache.extract()).to.not.have.property('$ROOT_QUERY.noId')
    notHaveProps(client.cache.extract(), ['ROOT_QUERY.noId'])
  })

  it('can delete query directly', async () => {
    await client.query({
      query: gql`
        query {
          pureText
        }
      `,
    })
    haveProps(client.cache.extract(), ['ROOT_QUERY.pureText'])
    client.deleteCache({ query: 'pureText' })
    expect(client.cache.extract()).to.not.have.property('ROOT_QUERY.pureText')
  })
})

/**
 * Since our test resolvers will resolve instantly, all the watchQuery
 * will be notified in a microtask.
 * So we can use setTimeout(() => {}, 0) to construct a macrotask
 * and do the assertions.
 */
describe('refetch when cache removed', () => {
  it('will refetch active query when cache removed', done => {
    let callTime = 0
    client
      .watchQuery({
        query: gql`
          query {
            getUser(id: "1") {
              id
              posts {
                id
                title
              }
            }
          }
        `,
      })
      .subscribe(result => {
        callTime++
        expect(result.data.getUser.id).to.equal('1')
        switch (callTime) {
          case 1:
            client.deleteCache({
              typename: 'User',
              value: { __typename: 'User', id: '1' },
            })
            break
          case 2:
            done()
            break
          default:
            break
        }
      })
  })

  it('will not notify query which does not use cache', done => {
    let callTime = 0
    client
      .watchQuery({
        query: gql`
          query {
            getUser(id: "1") {
              id
              posts {
                id
                title
              }
            }
          }
        `,
        fetchPolicy: 'network-only',
      })
      .subscribe(result => {
        callTime++
        expect(result.data.getUser.id).to.equal('1')
        client.deleteCache({
          typename: 'User',
          value: { __typename: 'User', id: '1' },
        })
        setTimeout(() => {
          expect(callTime).to.equal(1)
          done()
        }, 0)
      })
  })

  it('will not notify unactive query', done => {
    let callTime = 0
    const handler = client
      .watchQuery({
        query: gql`
          query {
            getUser(id: "1") {
              id
              posts {
                id
                title
              }
            }
          }
        `,
      })
      .subscribe(result => {
        callTime++
        expect(result.data.getUser.id).to.equal('1')
        if (callTime === 1) {
          handler.unsubscribe()
          client.deleteCache({
            typename: 'User',
            value: { __typename: 'User', id: '1' },
          })
          setTimeout(() => {
            expect(callTime).to.equal(1)
            done()
          }, 0)
        }
      })
  })

  it('will not notify active query with complete cache data', done => {
    let callTime = 0
    client
      .watchQuery({
        query: gql`
          query {
            getPosts(page: 1) {
              id
              title
            }
          }
        `,
      })
      .subscribe(result => {
        callTime++
        expect(result.data.getPosts.length).to.equal(1)
        client.deleteCache({
          typename: 'User',
          value: { __typename: 'User', id: '1' },
        })
        setTimeout(() => {
          expect(callTime).to.equal(1)
          done()
        }, 0)
      })
  })

  it('will notify active query which has empty result before', done => {
    let callTime = 0
    client
      .watchQuery({
        query: gql`
          query {
            emptyUsers {
              id
            }
          }
        `,
      })
      .subscribe(result => {
        callTime++
        expect(result.data.emptyUsers).to.deep.equal([])
        switch (callTime) {
          case 1:
            client.deleteCache({ typename: 'User' })
            break
          case 2:
            done()
            break
          default:
            break
        }
      })
  })

  it('will refetch after cache without id is deleted', done => {
    let callTime = 0
    client
      .watchQuery({
        query: gql`
          query {
            noId {
              # id
              content
            }
          }
        `,
      })
      .subscribe(result => {
        callTime++
        expect(result.data.noId.content).to.not.be.undefined
        switch (callTime) {
          case 1:
            client.deleteCache({ typename: 'NoId' })
            break
          case 2:
            done()
            break
          default:
            break
        }
      })
  })

  it('will refetch after query is deleted directly', done => {
    let callTime = 0
    client
      .watchQuery({
        query: gql`
          query {
            pureText
          }
        `,
      })
      .subscribe(result => {
        callTime++
        expect(result.data.pureText).to.not.be.undefined
        switch (callTime) {
          case 1:
            client.deleteCache({ query: 'pureText' })
            break
          case 2:
            done()
            break
          default:
            break
        }
      })
  })

  it('will not refetch after query is deleted directly', done => {
    let callTime = 0
    client
      .watchQuery({
        query: gql`
          query {
            pureText
          }
        `,
      })
      .subscribe(result => {
        callTime++
        switch (callTime) {
          case 1:
            expect(result.data.pureText).to.not.be.undefined
            client.deleteCache({ query: 'pureText' }, { refetch: false })
            break
          default:
            break
        }
        setTimeout(() => {
          expect(callTime).to.equal(1)
          done()
        }, 0)
      })
  })
})

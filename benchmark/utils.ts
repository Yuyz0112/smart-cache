import { NormalizedCacheObject } from 'apollo-cache-inmemory'
import { ListValue } from 'apollo-utilities'

export const generateFakeData = (size: number) => {
  if (size < 1)
    return {
      ROOT_QUERY: {},
    }

  const data: NormalizedCacheObject = {
    ROOT_QUERY: {
      getNestedes: [],
      getUsers: [],
      getPosts: [],
      getPost: { id: '1', title: 'Post 1', __typename: 'Post' },
      getNested: {
        type: 'id',
        generated: false,
        id: 'Nested:1',
        typename: 'Nested',
      },
      getUser: {
        type: 'id',
        generated: false,
        id: 'User:1',
        typename: 'User',
      },
    },
  }

  const numbers = new Array(size).fill(null).map((_, i) => i + 1)
  const rand = () => Math.random() * 10000;

  numbers.forEach(n => {
    const NestedId = rand();
    const UserId = rand();
    const PostId = rand();
    const FuzzId = rand();

    data[`Nested:${NestedId}`] = {
      __typename: 'Nested',
      prop1: 'prop1',
      prop2: 'prop2',
      prop3: 'prop3',
      id: `${NestedId}`,
      users: [
        {
          type: 'id',
          generated: false,
          id: `User:${UserId}`,
          typename: 'User',
        }
      ],
      posts: [
        {
          type: 'id',
          generated: false,
          id: `Post:${PostId}`,
          typename: 'Post',
        }
      ],
      fuzzy: [
        {
          type: 'id',
          generated: false,
          id: `Fuzzy:${FuzzId}`,
          typename: 'Fuzzy',
        }
      ],
    }

    data[`User:${UserId}`] = {
      __typename: 'User',
      prop1: 'prop1',
      prop2: 'prop2',
      prop3: 'prop3',
      id: `${UserId}`,
      posts: [
        {
          type: 'id',
          generated: false,
          id: `Post:${PostId}`,
          typename: 'Post',
        }
      ],
    }

    data[`Post:${PostId}`] = {
      __typename: 'Post',
      prop1: 'prop1',
      prop2: 'prop2',
      prop3: 'prop3',
      id: `${PostId}`,
      title: `Post ${PostId}`,
    }

    data[`Fuzzy:${FuzzId}`] = {
      __typename: 'Fuzzy',
      prop1: 'prop1',
      prop2: 'prop2',
      prop3: 'prop3',
      id: `${FuzzId}`,
      content: 'Post:1',
      posts: 'fuzzy key',
    }

    ;(data.ROOT_QUERY?.getNestedes as ListValue)?.push({
      type: 'id',
      generated: false,
      id: `Nested:${NestedId}`,
      typename: 'Nested',
    })
    ;(data.ROOT_QUERY?.getUsers as ListValue)?.push({
      type: 'id',
      generated: false,
      id: `User:${UserId}`,
      typename: 'User',
    })
    ;(data.ROOT_QUERY?.getPosts as ListValue)?.push({
      type: 'id',
      generated: false,
      id: `Post:${PostId}`,
      typename: 'Post',
    })
  })

  return data;
}

export type TypeFieldMap = Map<
  string,
  { dependentTypes: Set<string>; dependentQueries: Set<string> }
>

export const typeFieldMap: TypeFieldMap = new Map<
  string,
  { dependentTypes: Set<string>; dependentQueries: Set<string> }
>([
  [
    'User',
    {
      dependentTypes: new Set(['User', 'Nested']),
      dependentQueries: new Set(['getUser', 'nested']),
    },
  ],
  [
    'Post',
    {
      dependentTypes: new Set(['Post', 'User', 'Nested']),
      dependentQueries: new Set(['getUser', 'getPosts', 'nested']),
    },
  ],
  [
    'Fuzzy',
    {
      dependentTypes: new Set(['Fuzzy', 'Nested']),
      dependentQueries: new Set(['fuzzy', 'nested']),
    },
  ],
  [
    'Nested',
    {
      dependentTypes: new Set(['Nested']),
      dependentQueries: new Set(['nested']),
    },
  ],
  [
    'NoId',
    {
      dependentTypes: new Set(['NoId']),
      dependentQueries: new Set(['noId']),
    },
  ],
])

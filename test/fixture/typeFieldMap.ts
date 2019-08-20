export type TypeFieldMap = Map<
  string,
  { relatedTypes: Set<string>; relatedQueries: Set<string> }
>

export const typeFieldMap: TypeFieldMap = new Map<
  string,
  { relatedTypes: Set<string>; relatedQueries: Set<string> }
>([
  [
    'User',
    {
      relatedTypes: new Set(['User', 'Nested']),
      relatedQueries: new Set(['getUser', 'nested']),
    },
  ],
  [
    'Post',
    {
      relatedTypes: new Set(['Post', 'User', 'Nested']),
      relatedQueries: new Set(['getUser', 'getPosts', 'nested']),
    },
  ],
  [
    'Fuzzy',
    {
      relatedTypes: new Set(['Fuzzy', 'Nested']),
      relatedQueries: new Set(['fuzzy', 'nested']),
    },
  ],
  [
    'Nested',
    {
      relatedTypes: new Set(['Nested']),
      relatedQueries: new Set(['nested']),
    },
  ],
])

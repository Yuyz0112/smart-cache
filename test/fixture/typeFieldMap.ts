
export type TypeFieldMap = Map<
  string,
  { dependentTypes: Set<string>; dependentQueries: Set<string> }
>;

export const typeFieldMap: TypeFieldMap = new Map<
  string,
  { dependentTypes: Set<string>; dependentQueries: Set<string> }
>([
    
    [
      "User",
      {
        dependentTypes: new Set(["User","Nested"]),
        dependentQueries: new Set(["getUser","nested","emptyUsers"])
      }
    ],
    [
      "Post",
      {
        dependentTypes: new Set(["Post","User","Nested"]),
        dependentQueries: new Set(["getUser","getPosts","nested","emptyUsers"])
      }
    ],
    [
      "Fuzzy",
      {
        dependentTypes: new Set(["Fuzzy","Nested","BookRelated","Fuzzy","NoId"]),
        dependentQueries: new Set(["fuzzy","nested","noId","bookRelateds"])
      }
    ],
    [
      "Nested",
      {
        dependentTypes: new Set(["Nested"]),
        dependentQueries: new Set(["nested"])
      }
    ],
    [
      "NoId",
      {
        dependentTypes: new Set(["NoId","BookRelated","Fuzzy","NoId"]),
        dependentQueries: new Set(["fuzzy","noId","bookRelateds"])
      }
    ],
    [
      "BookRelated",
      {
        dependentTypes: new Set(["BookRelated"]),
        dependentQueries: new Set(["bookRelateds"])
      }
    ]
]);

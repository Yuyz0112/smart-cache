# smart-cache

## Usage

### patch apollo-client in memory cache

```typescript
import { ApolloClient } from 'apollo-client'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { patch } from 'smart-cache'

patch(ApolloClient, InMemoryCache)

const cache = new InMemoryCache()

// you can maintain the type field map manually or use our codegen CLI to generate one
cache.setTypeFieldMap(typeFieldMap)
const client = new ApolloClient({
  link,
  cache,
})

// after the patch, you can access the powerful deleteCache method from your apollo-client instance
client.deleteCache(typename, idGetterObj)
```

### generate type field map with CLI

```shell
npm i -g smart-cache

smart-cache SCHEMA_PATH OUTPUT_PATH
# example: smart-cache ./test/fixuture/schema.graphql ./test/fixture/typeFieldMap.ts
```

### use the codegen module programatically

```javascript
const { parse } = require('graphql')
const { constructTypeFieldMap } = require('smart-cache/codegen')

constructTypeFieldMap(parse(typeDef))
```

import { visit, DocumentNode } from 'graphql'

export interface Relation {
  typename: string
  dependentTypes: string[]
  dependentQueries: string[]
}

const getDependentTypes = (doc: DocumentNode, typeName: string) => {
  const dependentTypes: string[] = [typeName]
  visit(doc, {
    ObjectTypeDefinition(objectNode) {
      if (
        objectNode.fields &&
        !['Query', 'Mutation', 'Subscription'].includes(objectNode.name.value)
      ) {
        for (const field of objectNode.fields) {
          visit(field, {
            NamedType(namedTypeNode) {
              if (namedTypeNode.name.value === typeName) {
                dependentTypes.push(objectNode.name.value)
              }
            },
          })
        }
      }
    },
  })
  return dependentTypes
}

const getDependentQueries = (doc: DocumentNode, typeName: string[]) => {
  const dependentQueries: string[] = []
  visit(doc, {
    ObjectTypeDefinition(objectNode) {
      if (objectNode.fields && objectNode.name.value === 'Query') {
        for (const field of objectNode.fields) {
          visit(field, {
            NamedType(namedTypeNode) {
              if (typeName.includes(namedTypeNode.name.value)) {
                dependentQueries.push(field.name.value)
              }
            },
          })
        }
      }
    },
  })
  return dependentQueries
}

const template = (relations: Relation[]) => {
  return `
export type TypeFieldMap = Map<
  string,
  { dependentTypes: Set<string>; dependentQueries: Set<string> }
>;

export const typeFieldMap: TypeFieldMap = new Map<
  string,
  { dependentTypes: Set<string>; dependentQueries: Set<string> }
>([
    ${relations.map(
      relation => `
    [
      "${relation.typename}",
      {
        dependentTypes: new Set(${JSON.stringify(relation.dependentTypes)}),
        dependentQueries: new Set(${JSON.stringify(relation.dependentQueries)})
      }
    ]`
    )}
]);
`
}

const addExtraRelation = (
  baseRelation: Relation[],
  extraRelation: Relation[]
) => {
  let finalRelation = [...baseRelation]
  const baseTypeIndexMap: Map<string, number> = new Map()
  baseRelation.forEach((v, idx) => {
    baseTypeIndexMap.set(v.typename, idx)
  })
  for (const relation of extraRelation) {
    const { typename, dependentTypes, dependentQueries } = relation
    const idx = baseTypeIndexMap.get(typename)
    if (idx) {
      finalRelation[idx].dependentTypes = finalRelation[idx].dependentTypes.concat(dependentTypes)
      finalRelation[idx].dependentQueries = finalRelation[idx].dependentQueries.concat(dependentQueries)
    } else {
      finalRelation = finalRelation.concat(relation)
    }
  }
  return finalRelation
}

// get the most related fields, as for recursive related fields, it will be found in the recursive process of delete
export const constructTypeFieldMap = (
  doc: DocumentNode,
  extraRelation?: Relation[]
) => {
  let relations: Relation[] = []
  visit(doc, {
    ObjectTypeDefinition(objectNode) {
      const currentTypeName = objectNode.name.value
      if (!['Query', 'Mutation', 'Subscription'].includes(currentTypeName)) {
        const dependentTypes = getDependentTypes(doc, currentTypeName)
        const dependentQueries = getDependentQueries(
          doc,
          Array.from(dependentTypes)
        )
        relations.push({
          typename: currentTypeName,
          dependentTypes,
          dependentQueries,
        })
      }
    },
  })
  if (extraRelation) {
    relations = addExtraRelation(relations, extraRelation)
  }
  return template(relations)
}

import { QueryBuilder } from '@orbit/data'

import { Query, Queries, Term, Expression, Options } from './types'

export const getExpression = (query: Query): Expression => {
  const queryBuilder = new QueryBuilder()

  return query(queryBuilder).expression as Expression
}

export const getTerms = (queries: Queries): Term[] => {
  const queryBuilder = new QueryBuilder()

  return Object.keys(queries).sort().map((key) =>
    ({ key, expression: queries[key](queryBuilder).expression as Expression })
  )
}

export const getTermsOrExpression = (queryOrQueries: Query | Queries) => {
  return typeof queryOrQueries === 'function'
    ? getExpression(queryOrQueries)
    : getTerms(queryOrQueries)
}

export const hashQueryIdentifier = (termsOrExpression: Term[] | Expression, options?: Options) => {
  return options
    ? JSON.stringify({ termsOrExpression, options })
    : JSON.stringify(termsOrExpression)
}

export const validateOptions = (termsOrExpression: Term[] | Expression, options?: Options) => {
  if (!options) return
  if (Array.isArray(termsOrExpression) && !Array.isArray(options)) {
    throw new Error(
      'Options are invalid. When making multiple queries' +
      'the options must be an array of objects with a "queryKey" property that refers to the query to which the options apply'
    )
  } else if (!Array.isArray(termsOrExpression) && Array.isArray(options)) {
    throw new Error('Options are invalid.')
  }
}
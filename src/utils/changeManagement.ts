import { RecordOperation, RecordIdentity } from '@orbit/data'
import { Expression, Term, Options } from './types'

interface Operation {
  record: RecordIdentity
  relatedRecord?: RecordIdentity
  relatedRecords?: RecordIdentity[]
}

export const getUpdatedRecords = (operations: RecordOperation[]) => {
  const records: RecordIdentity[] = []
  const relatedRecords: RecordIdentity[] = []

  operations.forEach((operation: Operation) => {
    records.push(operation.record)
    operation.relatedRecord && relatedRecords.push(operation.relatedRecord)
    operation.relatedRecords && operation.relatedRecords.forEach(record => relatedRecords.push(record))
  })

  return { records, relatedRecords }
}

export const shouldUpdate = (
  termsOrExpression: Term[] | Expression | { termsOrExpression: Term[] | Expression, options: Options },
  records: RecordIdentity[],
  relatedRecords: RecordIdentity[]
) => {

  if (Array.isArray(termsOrExpression)) {
    return termsOrExpression.some(({ expression }) => hasChanged(expression, records, relatedRecords))
  }

  else if (termsOrExpression['op']) {
    return hasChanged(termsOrExpression as Expression, records, relatedRecords)
  }

  else {
    // @ts-ignore
    return shouldUpdate(termsOrExpression.termsOrExpression, records, relatedRecords)
  }
}

export const hasChanged = (
  expression: Expression,
  records: RecordIdentity[],
  relatedRecords: RecordIdentity[]) => {
  if (expression.op === 'findRecords') {
    return records.some(({ type }) => type === expression.type) ||
      relatedRecords.some(({ type }) => type === expression.type)
  }

  return records.some(record => !!identityIsEqual(expression.record, record))
    // @todo find a way to check for identity for relationships
    || relatedRecords.some(record => record.type === expression.record.type)
}

export const identityIsEqual = (a: RecordIdentity, b: RecordIdentity) =>
  (a.type === b.type && a.id === b.id)
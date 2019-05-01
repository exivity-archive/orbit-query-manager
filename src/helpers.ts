import { RecordIdentity } from '@orbit/data'
import { Term } from './types';

export const identityIsEqual = (a: RecordIdentity | null, b: RecordIdentity | null) =>
  (!a && !b) || (a && b && a.type === b.type && a.id === b.id)

export const shouldUpdate = (
  terms: Term[],
  records: RecordIdentity[],
  relatedRecords: RecordIdentity[]
) => {
  return terms.some(({ expression }) => {
    if (expression.op === 'findRecords') {
      return records.some(({ type }) => type === expression.type) ||
        relatedRecords.some(({ type }) => type === expression.type)
    }

    return records.some(record => !!identityIsEqual(expression.record, record))
      // @todo find a way to check for identity for relationships
      || relatedRecords.some(record => record.type === expression.record.type)
  })
}
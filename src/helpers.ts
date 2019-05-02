import { RecordIdentity, RecordOperation } from '@orbit/data'
import { Term, Listener } from './types'

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

export const getUpdatedRecords = (operations: RecordOperation[]) => {
  const records: RecordIdentity[] = []
  const relatedRecords: RecordIdentity[] = []

  operations.forEach(operation => {
    operation && operation.record && records.push(operation.record)

    switch (operation.op) {
      case 'addToRelatedRecords':
      case 'removeFromRelatedRecords':
      case 'replaceRelatedRecord':
        operation.relatedRecord && relatedRecords.push(operation.relatedRecord)
        break

      case 'replaceRelatedRecords':
        operation.relatedRecords.forEach(record => relatedRecords.push(record))
        break
    }
  })

  return { records, relatedRecords }
}

export const addLabel = (objects: ({ label?: string })[], item: { label?: string }, prefix: string) => {
  let i = 1
  while (true) {
    const currentLabel = `${prefix}_${i}`
    if (!objects.some(listener => listener.label === currentLabel)) {
      item.label = currentLabel
      break
    }
    i++
  }
}

export const filterByLabel = <T extends { label?: string }> (arr: T[], label: string) => {
  return arr.filter((item) => item.label !== label)
}
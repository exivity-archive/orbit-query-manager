import { QueryBuilder, Schema, ModelDefinition, AddRecordOperation, Transform, ReplaceRecordOperation, RemoveRecordOperation, ReplaceKeyOperation, ReplaceAttributeOperation, AddToRelatedRecordsOperation, RemoveFromRelatedRecordsOperation, ReplaceRelatedRecordsOperation, ReplaceRelatedRecordOperation } from '@orbit/data'
import { QueryManager } from '../QueryManager'
import Store from '@orbit/store'
import { Dict } from '@orbit/utils'
import { Expression } from '../types';


const modelDefenition: Dict<ModelDefinition> = {
  account: {
    attributes: {
      test: { type: 'string' }
    },
    relationships: {
      profile: { type: 'hasOne', inverse: 'account', model: 'profile' },
      services: { type: 'hasMany', inverse: 'subscribers', model: 'service' }
    }
  },
  profile: {
    attributes: {
      test: { type: 'string' }
    },
    relationships: {
      account: { type: 'hasOne', inverse: 'profile', model: 'account' }
    }
  },
  service: {
    attributes: {
      test: { type: 'string' }
    },
    relationships: {
      subscribers: { type: 'hasMany', inverse: 'services', model: 'account' }
    }
  }
}

const store = new Store({
  schema: new Schema({ models: modelDefenition })
})

let manager: QueryManager
beforeEach(() => {
  manager = new QueryManager(store.fork())
})

describe('subscribe(...)', () => {
  test('returns an unsubscribe function that stops listening for events if there are no subscriptions left', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)
    const listener = jest.fn()

    const unsubscribe = manager.subscribe(query, listener)

    expect(Object.keys(manager._subscriptions).length).toBe(1)
    expect(manager._store.listeners('transform').length).toBe(1)

    unsubscribe()

    expect(Object.keys(manager._subscriptions).length).toBe(0)
    expect(manager._store.listeners('transform').length).toBe(0)
  })
})

describe('query(...)', () => {
  test('Makes a new query when no queries are going on', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    manager.query(query)

    expect(Object.keys(manager._fetchManager._queryRefs).length).toBe(1)
  })

  test('Sets isLoading to true when a query is made', () => {
    const account = { type: 'account', id: '1' }


    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    const query = (q: QueryBuilder) => q.findRecord(account)

    manager.query(query)

    expect(manager._fetchManager._queryRefs[id].isLoading).toBe(true)
  })

  test('Makes a new _afterQueryQueue when a query gets added', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    manager.query(query)

    expect(Object.keys(manager._fetchManager._afterQueryQueue).length).toBe(1)
  })

  test('No new query will be made when an identical query already exists', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    manager.query(query)
    manager.query(query)

    expect(Object.keys(manager._fetchManager._queryRefs).length).toBe(1)
  })

  test('Able to pass in options to make a unique query', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    const options = { test: 'test' }

    manager.query(query)
    manager.query(query, options)

    expect(Object.keys(manager._fetchManager._queryRefs).length).toBe(2)
  })
})

describe('queryCache(...)', () => {
  test('isError is true when no match is found (single query)', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    const data = manager.queryCache(query)

    expect(data[1].isError).toBe(true)
  })

  test('isError is true when one or more matches are not found (multiple queries)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }

    const query = {
      Bob: (q: QueryBuilder) => q.findRecord(account1),
      Steve: (q: QueryBuilder) => q.findRecord(account2)
    }

    await manager._store.update(t => [t.addRecord(account2)])

    const data = manager.queryCache(query)

    expect(data[1].isError).toBe(true)
    done()
  })

  test('Returns a record for a single query if a match is found', async (done) => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    await manager._store.update(t => t.addRecord(account))

    const data = manager.queryCache(query)

    expect(data[0]).toBe(account)
    done()
  })

  test('Returns record if a match is found (single query)', async (done) => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    const data = manager.queryCache(query)

    expect(data[0]).toBe(null)
    done()
  })

  test('Returns null an an error if no match is found (single query)', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    const data = manager.queryCache(query)

    expect(data[0]).toBe(null)
  })

  test('Returns a record object if all matches are found (multiple queries)', async (done) => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }

    const query = {
      Bob: (q: QueryBuilder) => q.findRecord(account1),
      Steve: (q: QueryBuilder) => q.findRecord(account2)
    }

    await manager._store.update(t => [t.addRecord(account1), t.addRecord(account2)])

    const data = manager.queryCache(query)

    expect(data[0]).toMatchObject({ Bob: account1, Steve: account2 })
    done()
  })

  test('Returns null an an error if one or more of the matches are not found (multiple queries)', async (done) => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }

    const query = {
      Bob: (q: QueryBuilder) => q.findRecord(account1),
      Steve: (q: QueryBuilder) => q.findRecord(account2)
    }

    await manager._store.update(t => [t.addRecord(account2)])

    const data = manager.queryCache(query)

    expect(data[0]).toBe(null)
    done()
  })
})

describe('_compare(...)', () => {
  test(`doesn't notify when a subscriber is already fetching`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecord('account')
    const listener = jest.fn()

    manager.query(query)
    manager.subscribe(query, listener)

    const operation: AddRecordOperation = { op: 'addRecord', record: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).not.toBeCalled()
  })

  test(`notifies when a subscriber's subscribed-to record type is included and options were provided (single query)`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()
    const options = { test: 'test' }

    manager.subscribe(query, listener, options)

    const operation: AddRecordOperation = { op: 'addRecord', record: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included and options were provided multiple queries`, () => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }

    const query = {
      Account1: q => q.findRecord(account1),
      Account2: q => q.findRecord(account2)
    }
    const listener = jest.fn()
    const options = [{ queryKey: 'Account1', options: { test: 'test' } }]

    manager.subscribe(query, listener, options)

    const operation: AddRecordOperation = { op: 'addRecord', record: account1 }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a AddRecordOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: AddRecordOperation = { op: 'addRecord', record: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a AddRecordOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: AddRecordOperation = { op: 'addRecord', record: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a ReplaceRecordOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRecordOperation = { op: 'replaceRecord', record: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a ReplaceRecordOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRecordOperation = { op: 'replaceRecord', record: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a RemoveRecordOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: RemoveRecordOperation = { op: 'removeRecord', record: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a RemoveRecordOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: RemoveRecordOperation = { op: 'removeRecord', record: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a ReplaceKeyOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceKeyOperation = { op: 'replaceKey', record: account, key: 'testKey', value: 'test' }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a ReplaceKeyOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceKeyOperation = { op: 'replaceKey', record: account, key: 'testKey', value: 'test' }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a ReplaceAttributeOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceAttributeOperation = { op: 'replaceAttribute', record: account, attribute: 'test', value: 'test' }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a ReplaceAttributeOperation`, () => {
    const account = { type: 'account', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceAttributeOperation = { op: 'replaceAttribute', record: account, attribute: 'test', value: 'test' }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a AddToRelatedRecordsOperation (record perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: AddToRelatedRecordsOperation = { op: 'addToRelatedRecords', record: account, relationship: 'services', relatedRecord: service }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a AddToRelatedRecordsOperation (record perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: AddToRelatedRecordsOperation = { op: 'addToRelatedRecords', record: account, relationship: 'services', relatedRecord: service }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a AddToRelatedRecordsOperation (relation perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: AddToRelatedRecordsOperation = { op: 'addToRelatedRecords', record: service, relationship: 'subscribers', relatedRecord: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a AddToRelatedRecordsOperation (relation perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: AddToRelatedRecordsOperation = { op: 'addToRelatedRecords', record: service, relationship: 'subscribers', relatedRecord: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a RemoveFromRelatedRecordsOperation (record perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: RemoveFromRelatedRecordsOperation = { op: 'removeFromRelatedRecords', record: account, relationship: 'services', relatedRecord: service }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a RemoveFromRelatedRecordsOperation (record perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: RemoveFromRelatedRecordsOperation = { op: 'removeFromRelatedRecords', record: account, relationship: 'services', relatedRecord: service }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a RemoveFromRelatedRecordsOperation (relation perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: RemoveFromRelatedRecordsOperation = { op: 'removeFromRelatedRecords', record: service, relationship: 'subscriptions', relatedRecord: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a RemoveFromRelatedRecordsOperation (relation perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: RemoveFromRelatedRecordsOperation = { op: 'removeFromRelatedRecords', record: service, relationship: 'subscriptions', relatedRecord: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a ReplaceRelatedRecordsOperation (record perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '2' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRelatedRecordsOperation = { op: 'replaceRelatedRecords', record: account, relationship: 'services', relatedRecords: [service] }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a ReplaceRelatedRecordsOperation (record perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '2' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRelatedRecordsOperation = { op: 'replaceRelatedRecords', record: account, relationship: 'services', relatedRecords: [service] }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a ReplaceRelatedRecordsOperation (relation perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '2' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRelatedRecordsOperation = { op: 'replaceRelatedRecords', record: service, relationship: 'subscriptions', relatedRecords: [account] }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a ReplaceRelatedRecordsOperation (relation perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '2' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRelatedRecordsOperation = { op: 'replaceRelatedRecords', record: service, relationship: 'subscriptions', relatedRecords: [account] }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a ReplaceRelatedRecordOperation (record perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const profile = { type: 'profile', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRelatedRecordOperation = { op: 'replaceRelatedRecord', record: account, relationship: 'profile', relatedRecord: profile }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a ReplaceRelatedRecordOperation (record perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const profile = { type: 'profile', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()
    manager.subscribe(query, listener)

    const operation: ReplaceRelatedRecordOperation = { op: 'replaceRelatedRecord', record: account, relationship: 'profile', relatedRecord: profile }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included in a ReplaceRelatedRecordOperation (relation perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const profile = { type: 'profile', id: '1' }

    const query = q => q.findRecords('account')
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRelatedRecordOperation = { op: 'replaceRelatedRecord', record: profile, relationship: 'account', relatedRecord: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record is included in a ReplaceRelatedRecordOperation (relation perspective)`, () => {
    const account = { type: 'account', id: '1' }
    const profile = { type: 'profile', id: '1' }

    const query = q => q.findRecord(account)
    const listener = jest.fn()

    manager.subscribe(query, listener)

    const operation: ReplaceRelatedRecordOperation = { op: 'replaceRelatedRecord', record: profile, relationship: 'account', relatedRecord: account }
    const transform: Transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })
})



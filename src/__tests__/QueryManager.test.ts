import { QueryBuilder, Schema, ModelDefinition, FindRecord } from '@orbit/data'
import { QueryManager } from '../QueryManager'
import Store from '@orbit/store'
import { Dict } from '@orbit/utils'
import { Term } from '../types';
import { shouldUpdate } from '../helpers';

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
  manager = new QueryManager(store.fork(), { skip: ['account'] })
})

test('QueryManager._extractTerms(...) returns an ordered array of terms', () => {
  const account = { type: 'account', id: '1' }

  const query = (q: QueryBuilder) => q.findRecord(account)
  const queries = { Cccount: query, Account: query, Bccount: query, }

  const terms = manager._extractTerms(queries)

  expect(terms).toMatchObject([
    { key: 'Account', expression: { op: 'findRecord', record: account } },
    { key: 'Bccount', expression: { op: 'findRecord', record: account } },
    { key: 'Cccount', expression: { op: 'findRecord', record: account } }
  ])
})

test('QueryManager.registerQuery(...) creates a new subscription when called for the first time and a queryRef to access it', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.registerQuery(query)

  expect(queryRef).toBeDefined()
  expect(manager.subscriptions[queryRef]).toBeDefined()
  done()
})

test('QueryManager.subscribe(...) subscribes you to changes in the cache in records you\'re listening to', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.registerQuery(query)

  await manager._store.update(t => t.addRecord(account))

  const result = new Promise(resolve => {
    manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') })
    manager.query(queryRef)
  })

  expect(await result).toBe(' q(0_0)p ')
  done()
})

test('QueryManager.unsubscribe(...) delete result object when there are no listeners left', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef1 = manager.registerQuery(query)
  const queryRef2 = manager.registerQuery(query)
  const listener1 = () => { }
  const listener2 = () => { }

  manager.subscribe(queryRef1, listener1)
  manager.subscribe(queryRef2, listener2)

  expect(manager.subscriptions[queryRef1].listeners.length).toBe(2)

  manager.unsubscribe(queryRef1, listener1)
  manager.unsubscribe(queryRef2, listener2)

  expect(manager.subscriptions[queryRef1]).toBeUndefined()
  done()
})

test('QueryManager.unsubscribe(...) delete statuses object when there are no listeners left', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.registerQuery(query)

  const listener = () => { }
  listener.label = 'test'

  await manager._store.update(t => t.addRecord(account))

  const subscriptions = new Promise(resolve => {
    manager.subscribe(queryRef, resolve, { listenerLabel: 'test' })
  })

  manager.query(queryRef)

  expect(manager.statuses[queryRef]).toBeDefined()

  await subscriptions

  manager.unsubscribe(queryRef, listener)

  expect(manager.statuses[queryRef]).toBeUndefined()
  done()
})

test('QueryManager.queryCache(...) returns null if no match is found', () => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.registerQuery(query)

  manager.subscribe(queryRef, () => { })
  manager.query(queryRef)

  const terms = manager.subscriptions[queryRef].terms
  const result = manager.queryCache(terms)

  expect(result).toBe(null)
})

test('QueryManager.queryCache(...) returns an object when a match is found', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.registerQuery(query)


  const result = new Promise((resolve) => {
    const terms = manager.subscriptions[queryRef].terms
    const listener = () => resolve(manager.queryCache(terms))

    manager.subscribe(queryRef, listener)
  })

  manager._store.update(t => t.addRecord(account))

  expect(await result).toMatchObject({ Account: account })
  done()
})

test('QueryManager.queryCache(...) gets cancelled when beforeQuery returns true', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.registerQuery(query)
  const terms = manager.subscriptions[queryRef].terms

  const result = new Promise((resolve) => {
    const queryOptions = {
      beforeQuery: (expression: any, extensions: any) => {
        // extensions.skip: ['account'] as defined at the top of the file
        if (extensions.skip.includes((expression as FindRecord).record.type)) return true
      }
    }

    manager.subscribe(queryRef, () => {
      resolve(manager.queryCache(terms, queryOptions)
      )
    })
  })

  manager._store.update(t => t.addRecord(account))

  expect(await result).toBe(null)
  done()
})

test('QueryManager.queryCache(...) calls onQuery with the results', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.registerQuery(query)
  const terms = manager.subscriptions[queryRef].terms

  const result = new Promise((resolve) => {
    const queryOptions = { onQuery: resolve }
    manager.subscribe(queryRef, () => manager.queryCache(terms, queryOptions))
  })

  manager._store.update(t => t.addRecord(account))

  expect(await result).toMatchObject({ Account: account })
  done()
})

test('QueryManager.queryCache(...) calls onError when no matches are found', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.registerQuery(query)
  const terms = manager.subscriptions[queryRef].terms

  await manager._store.update(t => t.addRecord(account))

  const result = new Promise((resolve) => {
    manager.subscribe(queryRef, () => {
      const queryOptions = { onError: resolve }
      manager.queryCache(terms, queryOptions)
    })
  })

  manager._store.update(t => t.removeRecord(account))

  expect(await result).toBeDefined()
  done()
})

describe('Listener gets called after', () => {
  test('AddRecordOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.addRecord(account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRecordOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => t.addRecord(account))

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRecord(account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('RemoveRecordOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => t.addRecord(account))

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.removeRecord(account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceKeyOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => t.addRecord(account))

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceKey(account, 'testKey', 'testValue'))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceAttributeOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => t.addRecord(account))


    const queryRef = manager.registerQuery(query)

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceAttribute(account, 'test', 'hello'))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('AddToRelatedRecordsOperation while listening to a type of record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [t.addRecord(account), t.addRecord({ type: 'service', id: '1' })])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.addToRelatedRecords(account, 'services', { type: 'service', id: '1' }))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('AddToRelatedRecordsOperation while listening to a type of record (relation perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [t.addRecord(account), t.addRecord(service)])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.addToRelatedRecords(service, 'subscribers', account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('RemoveFromRelatedRecordsOperation while listening to a type of record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service),
      t.addToRelatedRecords(account, 'services', service)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.removeFromRelatedRecords(account, 'services', service))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('RemoveFromRelatedRecordsOperation while listening to a type of record (relation perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service),
      t.addToRelatedRecords(service, 'subscribers', account)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.removeFromRelatedRecords(service, 'subscribers', account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRelatedRecordsOperation while listening to a type of record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service1 = { type: 'service', id: '1' }
    const service2 = { type: 'service', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service1),
      t.addRecord(service2),
      t.addToRelatedRecords(account, 'services', service1)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRelatedRecords(account, 'services', [service2]))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRelatedRecordsOperation while listening to a type of record (relation perspective)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account1),
      t.addRecord(account2),
      t.addRecord(service),
      t.addToRelatedRecords(service, 'subscribers', account1)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRelatedRecords(service, 'subscribers', [account2]))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRelatedRecordOperation while listening to a type of record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const profile1 = { type: 'profile', id: '1' }
    const profile2 = { type: 'profile', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(profile1),
      t.addRecord(profile2),
      t.replaceRelatedRecord(account, 'profile', profile1)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRelatedRecord(account, 'profile', profile2))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRelatedRecordOperation while listening to a type of record (relation perspective)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }
    const profile = { type: 'profile', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account1),
      t.addRecord(account2),
      t.addRecord(profile),
      t.replaceRelatedRecord(profile, 'account', account2)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRelatedRecord(profile, 'account', account2))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('AddRecordOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.addRecord(account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRecordOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => t.addRecord(account))

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRecord(account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('RemoveRecordOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => t.addRecord(account))

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.removeRecord(account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceKeyOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => t.addRecord(account))

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceKey(account, 'testKey', 'testValue'))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceAttributeOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => t.addRecord(account))

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceAttribute(account, 'test', 'hello'))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('AddToRelatedRecordsOperation while listening to a specific record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [t.addRecord(account), t.addRecord(service)])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.addToRelatedRecords(account, 'services', service))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('AddToRelatedRecordsOperation while listening to a specific record (relation perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [t.addRecord(account), t.addRecord(service)])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.addToRelatedRecords(service, 'subscribers', account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('RemoveFromRelatedRecordsOperation while listening to a specific record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service),
      t.addToRelatedRecords(account, 'services', service)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.removeFromRelatedRecords(account, 'services', service))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('RemoveFromRelatedRecordsOperation while listening to a specific record (relation perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service),
      t.addToRelatedRecords(service, 'subscribers', account)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.removeFromRelatedRecords(service, 'subscribers', account))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRelatedRecordsOperation while listening to a specific record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service1 = { type: 'service', id: '1' }
    const service2 = { type: 'service', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service1),
      t.addRecord(service2),
      t.addToRelatedRecords(account, 'services', service1)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRelatedRecords(account, 'services', [service2]))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRelatedRecordsOperation while listening to a specific record (relation perspective)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }
    const service = { type: 'service', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account1) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account1),
      t.addRecord(account2),
      t.addRecord(service),
      t.addToRelatedRecords(service, 'subscribers', account1)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRelatedRecords(service, 'subscribers', [account2]))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRelatedRecordOperation while listening to a specific record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const profile1 = { type: 'profile', id: '1' }
    const profile2 = { type: 'profile', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(profile1),
      t.addRecord(profile2),
      t.replaceRelatedRecord(account, 'profile', profile1)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRelatedRecord(account, 'profile', profile2))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })

  test('ReplaceRelatedRecordOperation while listening to a specific ecord (relation perspective)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }
    const profile = { type: 'profile', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account1) }

    const queryRef = manager.registerQuery(query)

    await manager._store.update(t => [
      t.addRecord(account1),
      t.addRecord(account2),
      t.addRecord(profile),
      t.replaceRelatedRecord(profile, 'account', account1)
    ])

    const result = new Promise(resolve => manager.subscribe(queryRef, () => { resolve(' q(0_0)p ') }))

    manager._store.update(t => t.replaceRelatedRecord(profile, 'account', account2))

    expect(await result).toBe(' q(0_0)p ')
    done()
  })
})


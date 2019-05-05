import { QueryBuilder, Schema, ModelDefinition } from '@orbit/data'
import { QueryManager } from '../QueryManager'
import Store from '@orbit/store'
import { Dict } from '@orbit/utils'

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

  const queryRef = manager.subscribe(query)

  expect(queryRef).toBeDefined()
  expect(manager._subscriptions[queryRef]).toBeDefined()
  expect(manager.statuses[queryRef]).toBeDefined()
  done()
})

test('QueryManager.query(...) makes a new query when no queries are going on', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.subscribe(query)

  await manager._store.update(t => t.addRecord(account))

  expect(manager._ongoingQueries[queryRef]).toBeUndefined()

  manager.query(queryRef)

  expect(manager._ongoingQueries[queryRef]).toBeDefined()

  await Promise.all(manager._ongoingQueries[queryRef].request)

  expect(manager._ongoingQueries[queryRef]).toBeUndefined()
  done()
})

test('QueryManager.query(...) can take a callback that runs after the request finishes', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  await manager._store.update(t => t.addRecord(account))

  const queryRef = manager.subscribe(query)

  const onFinishRequest = jest.fn()
  manager.query(queryRef, { listener: onFinishRequest })

  await Promise.all(manager._ongoingQueries[queryRef].request)

  expect(onFinishRequest).toHaveBeenCalledTimes(1)
  done()
})

test('QueryManager.unsubscribe(...) delete result object when there are no listeners left', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.subscribe(query)

  expect(manager._subscriptions[queryRef].subscriberCount).toBe(1)

  manager.unsubscribe(queryRef)

  expect(manager._subscriptions[queryRef]).toBeUndefined()
  done()
})

test('QueryManager.unsubscribe(...) delete statuses object when there are no listeners left', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.subscribe(query)

  expect(manager.statuses[queryRef]).toBeDefined()

  manager.unsubscribe(queryRef)

  expect(manager.statuses[queryRef]).toBeUndefined()
  done()
})

test('QueryManager.unsubscribe(...) waits for ongoing query to be done before deleting the results and statuses if no listeners are left', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const listener = () => { }
  listener.label = 'test'

  await manager._store.update(t => t.addRecord(account))

  const queryRef = manager.subscribe(query)
  manager.query(queryRef)
  manager.unsubscribe(queryRef)

  expect(manager.statuses[queryRef]).toBeDefined()
  expect(manager._subscriptions[queryRef]).toBeDefined()
  expect(manager._ongoingQueries[queryRef]).toBeDefined()

  await Promise.all(manager._ongoingQueries[queryRef].request)

  expect(manager.statuses[queryRef]).toBeUndefined()
  expect(manager._subscriptions[queryRef]).toBeUndefined()
  expect(manager._ongoingQueries[queryRef]).toBeUndefined()
  done()
})

test('The record object is null if no match is found', () => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.subscribe(query)

  expect(manager.statuses[queryRef].records).toBe(null)
})

test('The record object is null if the cache updates and no match is found', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.subscribe(query)

  await manager._store.update(t => t.addRecord(account))

  expect(manager.statuses[queryRef].records).toMatchObject({ Account: account })

  await manager._store.update(t => t.removeRecord(account))

  expect(manager.statuses[queryRef].records).toBe(null)
  done()
})

test('When the cache updates the records object is also updated if a match is found', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const queryRef = manager.subscribe(query)

  await manager._store.update(t => t.addRecord(account))

  expect(manager.statuses[queryRef].records).toMatchObject({ Account: account })
  done()
})

test('The beforeQuery event callback gets called before every request', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  await manager._store.update(t => t.addRecord(account))

  const beforeQuery = jest.fn()

  const queryRef = manager.subscribe(query)
  manager.query(queryRef, { beforeQuery })

  await Promise.all(manager._ongoingQueries[queryRef].request)

  expect(beforeQuery).toHaveBeenCalledTimes(1)
  expect(beforeQuery).toHaveBeenCalledWith(
    [{ key: 'Account', expression: { op: 'findRecord', record: account } }],
    { skip: ['account'] }
  )
  done()
})

test('The onQuery event callback gets called when a request finishes successfully', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  await manager._store.update(t => t.addRecord(account))

  const onQuery = jest.fn(() => 0)

  const queryRef = manager.subscribe(query)
  manager.query(queryRef, { onQuery })

  await Promise.all(manager._ongoingQueries[queryRef].request)

  expect(onQuery).toHaveBeenCalledTimes(1)
  expect(onQuery).toHaveBeenCalledWith({ Account: account }, { skip: ['account'] })
  done()
})

test('The onError event callback gets called when a request errors', async done => {
  const account = { type: 'account', id: '1' }

  // @ts-ignore
  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const onError = jest.fn()

  const queryRef = manager.subscribe(query)
  manager.query(queryRef, { onError })

  await Promise.all(manager._ongoingQueries[queryRef].request).catch(() => { })

  expect(onError).toHaveBeenCalledTimes(1)
  done()
})

test('The beforeQuery event callback gets called before every query to the cache', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const beforeQuery = jest.fn()

  manager.subscribe(query, { beforeQuery })

  await manager._store.update(t => t.addRecord(account))

  expect(beforeQuery).toHaveBeenCalledTimes(1)
  expect(beforeQuery).toHaveBeenCalledWith(
    [{ key: 'Account', expression: { op: 'findRecord', record: account } }],
    { skip: ['account'] }
  )
  done()
})

test('The onQuery event callback gets called when a query finishes successfully', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const onQuery = jest.fn()

  manager.subscribe(query, { onQuery })

  await manager._store.update(t => t.addRecord(account))

  expect(onQuery).toHaveBeenCalledTimes(1)
  expect(onQuery).toHaveBeenCalledWith({ Account: account }, { skip: ['account'] })
  done()
})

test('The onError event callback gets called when a query errors', async done => {
  const account = { type: 'account', id: '1' }

  const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

  const onError = jest.fn()

  await manager._store.update(t => t.addRecord(account))

  manager.subscribe(query, { onError })

  await manager._store.update(t => t.removeRecord(account))

  expect(onError).toHaveBeenCalledTimes(1)
  done()
})

describe('Listener gets called after', () => {
  test('AddRecordOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.addRecord(account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRecordOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => t.addRecord(account))

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRecord(account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('RemoveRecordOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => t.addRecord(account))

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.removeRecord(account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceKeyOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => t.addRecord(account))

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceKey(account, 'testKey', 'testValue'))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceAttributeOperation while listening to a type of record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => t.addRecord(account))

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceAttribute(account, 'test', 'hello'))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('AddToRelatedRecordsOperation while listening to a type of record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => [t.addRecord(account), t.addRecord({ type: 'service', id: '1' })])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.addToRelatedRecords(account, 'services', { type: 'service', id: '1' }))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('AddToRelatedRecordsOperation while listening to a type of record (relation perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => [t.addRecord(account), t.addRecord(service)])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.addToRelatedRecords(service, 'subscribers', account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('RemoveFromRelatedRecordsOperation while listening to a type of record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service),
      t.addToRelatedRecords(account, 'services', service)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.removeFromRelatedRecords(account, 'services', service))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('RemoveFromRelatedRecordsOperation while listening to a type of record (relation perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service),
      t.addToRelatedRecords(service, 'subscribers', account)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.removeFromRelatedRecords(service, 'subscribers', account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRelatedRecordsOperation while listening to a type of record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service1 = { type: 'service', id: '1' }
    const service2 = { type: 'service', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service1),
      t.addRecord(service2),
      t.addToRelatedRecords(account, 'services', service1)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRelatedRecords(account, 'services', [service2]))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRelatedRecordsOperation while listening to a type of record (relation perspective)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => [
      t.addRecord(account1),
      t.addRecord(account2),
      t.addRecord(service),
      t.addToRelatedRecords(service, 'subscribers', account1)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRelatedRecords(service, 'subscribers', [account2]))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRelatedRecordOperation while listening to a type of record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const profile1 = { type: 'profile', id: '1' }
    const profile2 = { type: 'profile', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(profile1),
      t.addRecord(profile2),
      t.replaceRelatedRecord(account, 'profile', profile1)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRelatedRecord(account, 'profile', profile2))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRelatedRecordOperation while listening to a type of record (relation perspective)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }
    const profile = { type: 'profile', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecords('account') }

    await manager._store.update(t => [
      t.addRecord(account1),
      t.addRecord(account2),
      t.addRecord(profile),
      t.replaceRelatedRecord(profile, 'account', account2)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRelatedRecord(profile, 'account', account2))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('AddRecordOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.addRecord(account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRecordOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => t.addRecord(account))

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRecord(account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('RemoveRecordOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => t.addRecord(account))

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.removeRecord(account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceKeyOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => t.addRecord(account))

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceKey(account, 'testKey', 'testValue'))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceAttributeOperation while listening to a specific record', async done => {
    const account = { type: 'account', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => t.addRecord(account))

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceAttribute(account, 'test', 'hello'))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('AddToRelatedRecordsOperation while listening to a specific record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => [t.addRecord(account), t.addRecord(service)])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.addToRelatedRecords(account, 'services', service))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('AddToRelatedRecordsOperation while listening to a specific record (relation perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => [t.addRecord(account), t.addRecord(service)])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.addToRelatedRecords(service, 'subscribers', account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('RemoveFromRelatedRecordsOperation while listening to a specific record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service),
      t.addToRelatedRecords(account, 'services', service)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.removeFromRelatedRecords(account, 'services', service))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('RemoveFromRelatedRecordsOperation while listening to a specific record (relation perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service = { type: 'service', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service),
      t.addToRelatedRecords(service, 'subscribers', account)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.removeFromRelatedRecords(service, 'subscribers', account))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRelatedRecordsOperation while listening to a specific record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const service1 = { type: 'service', id: '1' }
    const service2 = { type: 'service', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(service1),
      t.addRecord(service2),
      t.addToRelatedRecords(account, 'services', service1)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRelatedRecords(account, 'services', [service2]))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRelatedRecordsOperation while listening to a specific record (relation perspective)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }
    const service = { type: 'service', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account1) }

    await manager._store.update(t => [
      t.addRecord(account1),
      t.addRecord(account2),
      t.addRecord(service),
      t.addToRelatedRecords(service, 'subscribers', account1)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRelatedRecords(service, 'subscribers', [account2]))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRelatedRecordOperation while listening to a specific record (record perspective)', async done => {
    const account = { type: 'account', id: '1' }
    const profile1 = { type: 'profile', id: '1' }
    const profile2 = { type: 'profile', id: '2' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account) }

    await manager._store.update(t => [
      t.addRecord(account),
      t.addRecord(profile1),
      t.addRecord(profile2),
      t.replaceRelatedRecord(account, 'profile', profile1)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRelatedRecord(account, 'profile', profile2))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })

  test('ReplaceRelatedRecordOperation while listening to a specific ecord (relation perspective)', async done => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }
    const profile = { type: 'profile', id: '1' }

    const query = { Account: (q: QueryBuilder) => q.findRecord(account1) }

    await manager._store.update(t => [
      t.addRecord(account1),
      t.addRecord(account2),
      t.addRecord(profile),
      t.replaceRelatedRecord(profile, 'account', account1)
    ])

    const listener = jest.fn()
    manager.subscribe(query, { listener })

    await manager._store.update(t => t.replaceRelatedRecord(profile, 'account', account2))

    expect(listener).toHaveBeenCalledTimes(1)
    done()
  })
})


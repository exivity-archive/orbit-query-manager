import Store from '@orbit/store'
import { Dict } from '@orbit/utils'
import { QueryBuilder, Schema, ModelDefinition } from '@orbit/data'

import { CacheManager } from './CacheManager'

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

let manager: CacheManager
beforeEach(() => {
  manager = new CacheManager(store.fork())
})

describe('subscribe(...)', () => {
  test('returns an unsubscribe function that stops listening for events if there are no subscriptions left', () => {
    const id = 'test'
    const listener = jest.fn()

    const unsubscribe = manager.subscribe(id, listener)

    expect(Object.keys(manager._subscriptions).length).toBe(1)
    expect(manager._store.listeners('transform').length).toBe(1)

    unsubscribe()

    expect(Object.keys(manager._subscriptions).length).toBe(0)
    expect(manager._store.listeners('transform').length).toBe(0)
  })
})

describe('query(...)', () => {
  test('isError is true when no match is found (single query)', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    const data = manager.query(query)

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

    const data = manager.query(query)

    expect(data[1].isError).toBe(true)
    done()
  })

  test('Returns a record for a single query if a match is found', async (done) => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    await manager._store.update(t => t.addRecord(account))

    const data = manager.query(query)

    expect(data[0]).toBe(account)
    done()
  })

  test('Returns record if a match is found (single query)', async (done) => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    const data = manager.query(query)

    expect(data[0]).toBe(null)
    done()
  })

  test('Returns null an an error if no match is found (single query)', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    const data = manager.query(query)

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

    const data = manager.query(query)

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

    const data = manager.query(query)

    expect(data[0]).toBe(null)
    done()
  })
})

describe('_compare(...)', () => {
  test(`notifies when a subscriber's subscribed-to record type is inclduded as an operations record`, () => {
    const account = { type: 'account', id: '1' }

    const expression = { op: 'findRecord', record: account }

    const listener = jest.fn()
    const id = JSON.stringify(expression)

    manager.subscribe(id, listener)

    const operation = { op: 'addRecord', record: account }
    const transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is inclduded as an operations related record`, () => {
    const service = { type: 'service', id: '1' }
    const account = { type: 'account', id: '1' }

    const expression = { op: 'findRecord', record: account }

    const listener = jest.fn()
    const id = JSON.stringify(expression)

    manager.subscribe(id, listener)

    const operation = { op: 'replaceRelatedRecord', record: service, relatedRecord: account }
    const transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is inclduded in the operations relatedRecords array`, () => {
    const service = { type: 'service', id: '1' }
    const account = { type: 'account', id: '1' }

    const expression = { op: 'findRecord', record: account }

    const listener = jest.fn()
    const id = JSON.stringify(expression)

    manager.subscribe(id, listener)

    const operation = { op: 'replaceRelatedRecords', record: service, relatedRecords: [account] }
    const transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included and options were provided (single query)`, () => {
    const account = { type: 'account', id: '1' }


    const expression = { op: 'findRecord', record: account }
    const options = { test: 'test' }
    const identifier = { termsOrExpression: expression, options }

    const listener = jest.fn()
    const id = JSON.stringify(identifier)

    manager.subscribe(id, listener)

    const operation = { op: 'addRecord', record: account }
    const transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test(`notifies when a subscriber's subscribed-to record type is included and options were provided multiple queries`, () => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }

    const terms = [
      { key: 'Account1', expression: { op: 'findRecord', record: account1 } },
      { key: 'Account2', expression: { op: 'findRecord', record: account2 } }
    ]
    const options = [{ queryKey: 'Account1', options: { test: 'test' } }]
    const identifier = { termsOrExpression: terms, options }

    const listener = jest.fn()
    const id = JSON.stringify(identifier)

    manager.subscribe(id, listener)

    const operation = { op: 'addRecord', record: account1 }
    const transform = { operations: [operation], id: 'test' }

    manager._compare(transform)

    expect(listener).toHaveBeenCalledTimes(1)
  })
})



import Store from '@orbit/store'
import { Dict } from '@orbit/utils'
import { QueryBuilder, Schema, ModelDefinition } from '@orbit/data'

import { Subscription } from '../Subscription'
import { FetchManager } from './FetchManager'

import { Expression, Term } from '../utils/types'

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

let manager: FetchManager
beforeEach(() => {
  manager = new FetchManager(store.fork())
})

describe('subscribe(...)', () => {
  test('returns an unsubscribe function that stops listening for events if there are no subscriptions left', () => {
    const id = 'test'

    const listener = jest.fn()

    const unsubscribe = manager.subscribe(id, listener)

    expect(Object.keys(manager._subscriptions).length).toBe(1)

    unsubscribe()

    expect(Object.keys(manager._subscriptions).length).toBe(0)
  })
})

describe('query(...)', () => {
  test('Makes a new query when no queries are going on', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    manager.query(query)

    expect(Object.keys(manager._queryRefs).length).toBe(1)
  })

  test('Sets isLoading to true when a query is made', () => {
    const account = { type: 'account', id: '1' }


    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    const query = (q: QueryBuilder) => q.findRecord(account)

    manager.query(query)

    expect(manager._queryRefs[id].isLoading).toBe(true)
  })

  test('Makes a new _afterQueryQueue when a query gets added', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    manager.query(query)

    expect(Object.keys(manager._afterQueryQueue).length).toBe(1)
  })

  test('No new query will be made when an identical query already exists', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    manager.query(query)
    manager.query(query)

    expect(Object.keys(manager._queryRefs).length).toBe(1)
  })

  test('Able to pass in options to make a unique query', () => {
    const account = { type: 'account', id: '1' }

    const query = (q: QueryBuilder) => q.findRecord(account)

    const options = { test: 'test' }

    manager.query(query)
    manager.query(query, options)

    expect(Object.keys(manager._queryRefs).length).toBe(2)
  })
})

describe('_query(...)', () => {
  test('sets isLoading to false after the query', async (done) => {
    const account = { type: 'account', id: '1' }

    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    manager._subscriptions[id] = new Subscription()
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, expression)

    expect(manager._queryRefs[id].isLoading).toBe(false)
    done()
  })

  test('Sets isError as true on _queryRef if query fails (single query)', async (done) => {
    const account = { type: 'account', id: '1' }

    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    manager._subscriptions[id] = new Subscription()
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, expression)

    expect(manager._queryRefs[id].isError).toBe(true)
    done()
  })

  test('Sets isError as true on _queryRef if one of the queries fail (multiple queries)', async (done) => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }

    await manager._store.update(t => [t.addRecord(account1)])

    const terms: Term[] = [
      { key: 'Account1', expression: { op: 'findRecord', record: account1 } },
      { key: 'Account2', expression: { op: 'findRecord', record: account2 } }
    ]
    const id = JSON.stringify(terms)

    manager._subscriptions[id] = new Subscription()
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, terms)

    expect(manager._queryRefs[id].isError).toBe(true)
    done()
  })

  test('Notifies subscribers after query is finished', async (done) => {
    const account = { type: 'account', id: '1' }

    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    const listener = jest.fn()

    manager.subscribe(id, listener)
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, expression)

    expect(listener).toBeCalledTimes(1)
    done()
  })

  test('Notifies subscribers with record when one is found (single query)', async (done) => {
    const account = { type: 'account', id: '1' }

    await manager._store.update(t => t.addRecord(account))

    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    // returns record
    const listener = jest.fn(result => result[0])

    manager.subscribe(id, listener)
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, expression)

    expect(listener).toReturnWith(account)
    done()
  })

  test('Notifies subscriber with null when no record is found (single query)', async (done) => {
    const account = { type: 'account', id: '1' }

    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    // returns record
    const listener = jest.fn(result => result[0])

    manager.subscribe(id, listener)
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, expression)

    expect(listener).toReturnWith(null)
    done()
  })

  test('Notifies subscribers with record object if all are found (multiple queries)', async (done) => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }

    await manager._store.update(t => [t.addRecord(account1), t.addRecord(account2)])

    const terms: Term[] = [
      { key: 'Account1', expression: { op: 'findRecord', record: account1 } },
      { key: 'Account2', expression: { op: 'findRecord', record: account2 } }
    ]
    const id = JSON.stringify(terms)

    // returns record
    const listener = jest.fn(result => result[0])

    manager.subscribe(id, listener)
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, terms)

    expect(listener).toReturnWith({ Account1: account1, Account2: account2 })
    done()
  })

  test('Notifies subscriber with null when one or more records are not found (multiple queries)', async (done) => {
    const account1 = { type: 'account', id: '1' }
    const account2 = { type: 'account', id: '2' }

    await manager._store.update(t => [t.addRecord(account1)])

    const terms: Term[] = [
      { key: 'Account1', expression: { op: 'findRecord', record: account1 } },
      { key: 'Account2', expression: { op: 'findRecord', record: account2 } }
    ]
    const id = JSON.stringify(terms)

    // returns record
    const listener = jest.fn(result => result[0])

    manager.subscribe(id, listener)
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, terms)

    expect(listener).toReturnWith(null)
    done()
  })

  test('Calls callbacks in the _afterQueryQueue once the query is finished', async (done) => {
    const account = { type: 'account', id: '1' }

    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    const afterQueryCallback = jest.fn()

    manager._subscriptions[id] = new Subscription()
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = [afterQueryCallback, afterQueryCallback, afterQueryCallback]

    await manager._tryQuery(id, expression)

    expect(afterQueryCallback).toBeCalledTimes(3)
    done()
  })

  test('Deletes _afterQueryQueue once the query is finished', async (done) => {
    const account = { type: 'account', id: '1' }

    const expression: Expression = { op: 'findRecord', record: account }
    const id = JSON.stringify(expression)

    manager._subscriptions[id] = new Subscription()
    manager._queryRefs[id] = { isLoading: true, isError: null }
    manager._afterQueryQueue[id] = []

    await manager._tryQuery(id, expression)

    expect(manager._afterQueryQueue[id]).toBeUndefined()
    done()
  })
})

describe('_makeSingleQuery', () => {
  test('Returns a promise that resolves with a record', async (done) => {
    const account = { type: 'account', id: '1' }
    const expression: Expression = { op: 'findRecord', record: account }

    await manager._store.update(t => t.addRecord(account))

    const result = await manager._makeSingleQuery(expression)

    expect(result).toBe(account)
    done()
  })

  test('Can take a second options parameter', async (done) => {
    const account = { type: 'account', id: '1' }
    const expression: Expression = { op: 'findRecord', record: account }
    const options = { label: 'get account' }

    await manager._store.update(t => t.addRecord(account))

    const result = await manager._makeSingleQuery(expression, options)

    expect(result).toBe(account)
    done()
  })
})

describe('_makeMultipleQueries', () => {
  test('Returns a promise that resolves with a record object', async (done) => {
    const account = { type: 'account', id: '1' }
    const terms: Term[] = [{ key: 'Account', expression: { op: 'findRecord', record: account } }]

    await manager._store.update(t => t.addRecord(account))

    const result = await manager._makeMultipleQueries(terms)

    expect(result).toMatchObject({ Account: account })
    done()
  })

  test('Can take a second options parameter', async (done) => {
    const account = { type: 'account', id: '1' }
    const terms: Term[] = [{ key: 'Account', expression: { op: 'findRecord', record: account } }]

    await manager._store.update(t => t.addRecord(account))

    const result = await manager._makeMultipleQueries(terms)

    expect(result).toMatchObject({ Account: account })
    done()
  })
})





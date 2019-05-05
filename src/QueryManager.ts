import Store from '@orbit/store'

import {
  Term,
  OngoingQueries,
  Expressions,
  Queries,
  Subscriptions,
  Statuses,
  EventCallbacks,
  RecordObject
} from './types'
import { Transform, RecordOperation } from '@orbit/data'
import { shouldUpdate, getUpdatedRecords, removeEventCallback, addEventCallback } from './helpers'

export class QueryManager<E extends { [key: string]: any } = any>  {
  _extensions: E
  _store: Store
  _ongoingQueries: OngoingQueries<E>

  _subscriptions: Subscriptions<E>
  statuses: Statuses

  constructor (orbitStore: Store, extensions?: E) {
    this._extensions = extensions || {} as E
    this._store = orbitStore
    this._ongoingQueries = {}
    this._subscriptions = {}

    this.statuses = {}
  }

  _extractTerms (queries: Queries): Term[] {
    return Object.keys(queries).sort().map(
      (key) => ({ key, expression: queries[key](this._store.queryBuilder).expression as Expressions })
    )
  }

  subscribe (queries: Queries, { listener, beforeQuery, onQuery, onError }: EventCallbacks<E> = {}) {
    const terms = this._extractTerms(queries)
    const queryRef = JSON.stringify(terms)

    if (!this._subscriptions[queryRef]) {
      this._subscriptions[queryRef] = {
        listeners: [],
        terms,
        beforeQueries: [],
        onQueries: [],
        onErrors: [],
        subscriberCount: 0
      }

      this.statuses[queryRef] = {
        error: null,
        loading: false,
        records: null
      }

      this._store.on('transform', this._compare.bind(this, queryRef))
      this._queryCache(queryRef)
    }

    this._subscriptions[queryRef].subscriberCount++

    addEventCallback(listener, this._subscriptions[queryRef].listeners)
    addEventCallback(beforeQuery, this._subscriptions[queryRef].beforeQueries)
    addEventCallback(onQuery, this._subscriptions[queryRef].onQueries)
    addEventCallback(onError, this._subscriptions[queryRef].onErrors)

    return queryRef
  }

  unsubscribe (queryRef: string, eventCallbacks: EventCallbacks<E> = {}) {
    if (this._ongoingQueries[queryRef]) {
      addEventCallback(this._unsubscribe.bind(this, queryRef, eventCallbacks), this._ongoingQueries[queryRef].afterRequestQueue)
    } else {
      this._unsubscribe(queryRef, eventCallbacks)
    }
  }

  _unsubscribe (queryRef: string, { listener, beforeQuery, onQuery, onError }: EventCallbacks<E>) {
    this._subscriptions[queryRef].subscriberCount--

    removeEventCallback(listener, this._subscriptions[queryRef].listeners)
    removeEventCallback(beforeQuery, this._subscriptions[queryRef].beforeQueries)
    removeEventCallback(onQuery, this._subscriptions[queryRef].onQueries)
    removeEventCallback(onError, this._subscriptions[queryRef].onErrors)

    if (this._subscriptions[queryRef].subscriberCount === 0) {
      delete this._subscriptions[queryRef]
      delete this.statuses[queryRef]

      this._store.off('transform', this._compare.bind(this, queryRef))
    }
  }

  query (queryRef: string, { listener, beforeQuery, onQuery, onError }: EventCallbacks<E> = {}) {
    const queryExists = Boolean(this._ongoingQueries[queryRef])
    if (!queryExists) {
      this._ongoingQueries[queryRef] = {
        afterRequestQueue: [],
        beforeQueries: [],
        onQueries: [],
        onErrors: [],
      }
    }

    addEventCallback(listener, this._ongoingQueries[queryRef].afterRequestQueue)
    addEventCallback(beforeQuery, this._ongoingQueries[queryRef].beforeQueries)
    addEventCallback(onQuery, this._ongoingQueries[queryRef].onQueries)
    addEventCallback(onError, this._ongoingQueries[queryRef].onErrors)

    if (!queryExists) this._query(queryRef)
  }

  async _query (queryRef: string) {
    const terms = this._subscriptions[queryRef].terms

    this._ongoingQueries[queryRef].request = terms
      .map(({ key, expression }) =>
        new Promise((resolve, reject) => {
          this._store.query(expression)
            .then(record => resolve({ [key]: record }))
            .catch(reject)
        })
      )

    this.statuses[queryRef].loading = true

    this._ongoingQueries[queryRef].beforeQueries.forEach(fn => fn(terms, this._extensions))

    try {
      const result = await Promise.all(this._ongoingQueries[queryRef].request)
      const records = result.reduce((acc, result) => ({ ...acc, ...result }), {})

      this._ongoingQueries[queryRef].onQueries.forEach(fn => fn(records, this._extensions))

      this.statuses[queryRef].loading = false
    } catch (error) {
      this._ongoingQueries[queryRef].onErrors.forEach(fn => fn(error, this._extensions))

      this.statuses[queryRef].loading = false
      this.statuses[queryRef].error = error

    } finally {
      this._onRequestFinish(queryRef)
    }
  }

  _onRequestFinish (queryRef: string) {
    this._ongoingQueries[queryRef].afterRequestQueue.forEach(fn => fn())

    delete this._ongoingQueries[queryRef]
  }

  _queryCache (queryRef: string) {
    const terms = this._subscriptions[queryRef].terms

    this._subscriptions[queryRef].beforeQueries.forEach(beforeQuery => beforeQuery(terms, this._extensions))

    let records: RecordObject | null
    try {
      records = terms.map(({ key, expression }) => ({ [key]: this._store.cache.query(expression) }))
        .reduce((acc, result) => ({ ...acc, ...result }), {})

      this._subscriptions[queryRef].onQueries.forEach(onQuery => onQuery(records, this._extensions))
    } catch (err) {
      records = null

      this._subscriptions[queryRef].onErrors.forEach(onError => onError(err, this._extensions))
    }

    this.statuses[queryRef].records = records
  }

  _compare (queryRef: string, transform: Transform) {
    const { records, relatedRecords } = getUpdatedRecords(transform.operations as RecordOperation[])
    const terms = this._subscriptions[queryRef].terms

    if (shouldUpdate(terms, records, relatedRecords)) {
      this._queryCache(queryRef)
      this._subscriptions[queryRef].listeners.forEach(listener => listener())
    }
  }
}
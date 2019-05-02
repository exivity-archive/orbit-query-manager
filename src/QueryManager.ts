import Store from '@orbit/store'

import {
  Term,
  OngoingQueries,
  RecordObject,
  Expressions,
  Queries,
  Subscriptions,
  Statuses,
  EventCallbacks,
  Listener,
} from './types'
import { Transform, RecordOperation } from '@orbit/data'
import { shouldUpdate, getUpdatedRecords } from './helpers'

export class QueryManager<E extends { [key: string]: any } = any>  {
  _extensions: E
  _store: Store
  _ongoingQueries: OngoingQueries

  subscriptions: Subscriptions<E>
  statuses: Statuses

  constructor (orbitStore: Store, extensions?: E) {
    this._extensions = extensions || {} as E
    this._store = orbitStore
    this._ongoingQueries = {}

    this.subscriptions = {}
    this.statuses = {}
  }

  registerQuery (queries: Queries, { beforeQuery, onQuery, onError }: EventCallbacks<E> = {}) {
    const terms = this._extractTerms(queries)
    const queryRef = JSON.stringify(terms)

    if (!this.subscriptions[queryRef]) {
      this.subscriptions[queryRef] = { listeners: [], terms, beforeQueries: [], onQueries: [], onErrors: [] }
      this.statuses[queryRef] = { error: null, loading: false, records: null }
      this._store.on('transform', this._compare.bind(this, queryRef))
      this._queryCache(queryRef)
    }

    beforeQuery && this.subscriptions[queryRef].beforeQueries.push(beforeQuery)
    onQuery && this.subscriptions[queryRef].onQueries.push(onQuery)
    onError && this.subscriptions[queryRef].onErrors.push(onError)

    return queryRef
  }

  _extractTerms (queries: Queries): Term[] {
    return Object.keys(queries).sort().map(
      (key) => ({ key, expression: queries[key](this._store.queryBuilder).expression as Expressions })
    )
  }

  subscribe (queryRef: string, listener: Listener) {
    this.subscriptions[queryRef].listeners.push(listener)
  }

  unsubscribe (queryRef: string, listener: Listener, eventCallbacks: EventCallbacks<E> = {}) {
    if (this._ongoingQueries[queryRef]) {
      this._ongoingQueries[queryRef].afterRequestQueue.push(() => this._unsubscribe(queryRef, listener, eventCallbacks))
    } else {
      this._unsubscribe(queryRef, listener, eventCallbacks)
    }
  }

  _unsubscribe (queryRef: string, listener: Listener, { beforeQuery, onQuery, onError }: EventCallbacks<E>) {
    this.subscriptions[queryRef].listeners =
      this.subscriptions[queryRef].listeners.filter(item => item !== listener)

    if (beforeQuery) {
      this.subscriptions[queryRef].beforeQueries =
        this.subscriptions[queryRef].beforeQueries.filter(item => item !== beforeQuery)
    }

    if (onQuery) {
      this.subscriptions[queryRef].onQueries =
        this.subscriptions[queryRef].onQueries.filter(item => item !== onQuery)
    }

    if (onError) {
      this.subscriptions[queryRef].onErrors =
        this.subscriptions[queryRef].onErrors.filter(item => item !== onError)
    }

    if (this.subscriptions[queryRef].listeners.length === 0) {
      delete this.subscriptions[queryRef]
      delete this.statuses[queryRef]

      this._store.off('transform', this._compare.bind(this, queryRef))
    }
  }

  query (queryRef: string, onFinish?: () => void) {
    if (!this._ongoingQueries[queryRef]) {
      this._query(queryRef)
    }

    onFinish && this._ongoingQueries[queryRef].afterRequestQueue.push(onFinish)
  }

  _query (queryRef: string) {
    const terms = this.subscriptions[queryRef].terms

    const queries: Promise<RecordObject>[] = terms
      .map(({ key, expression }) =>
        new Promise((resolve, reject) => {
          this._store.query(expression)
            .then(record => resolve({ [key]: record }))
            .catch(reject)
        })
      )

    this.statuses[queryRef].loading = true

    this._ongoingQueries[queryRef] = { afterRequestQueue: [], request: queries }

    Promise.all(this._ongoingQueries[queryRef].request)
      .then(() => {
        this.statuses[queryRef].loading = false

        this.subscriptions[queryRef].listeners.forEach(listener => listener())
        this._ongoingQueries[queryRef].afterRequestQueue.forEach(fn => fn())

        delete this._ongoingQueries[queryRef]
      })
      .catch(error => {
        this.statuses[queryRef].loading = false
        this.statuses[queryRef].error = error

        this.subscriptions[queryRef].listeners.forEach(listener => listener())
        this._ongoingQueries[queryRef].afterRequestQueue.forEach(fn => fn())

        delete this._ongoingQueries[queryRef]
      })
  }

  _queryCache (queryRef: string) {

    const terms = this.subscriptions[queryRef].terms
    this.subscriptions[queryRef].beforeQueries.forEach(beforeQuery => beforeQuery(terms, this._extensions))

    try {
      const res = terms.map(({ key, expression }) => ({ [key]: this._store.cache.query(expression) }))
        .reduce((acc, result) => ({ ...acc, ...result }), {})

      this.subscriptions[queryRef].onQueries.forEach(onQuery => onQuery(res, this._extensions))
      this.statuses[queryRef].records = res
      return
    } catch (err) {
      this.subscriptions[queryRef].onErrors.forEach(onError => onError(err, this._extensions))
    }

    this.statuses[queryRef].records = null
  }

  _compare (queryRef: string, transform: Transform) {
    const { records, relatedRecords } = getUpdatedRecords(transform.operations as RecordOperation[])
    const terms = this.subscriptions[queryRef].terms

    if (shouldUpdate(terms, records, relatedRecords)) {
      this._queryCache(queryRef)
      this.subscriptions[queryRef].listeners.forEach(listener => listener())
    }
  }
}
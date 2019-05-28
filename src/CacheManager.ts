import { Observable } from './Observable'
import { Data, Listener, Query, Queries, Term, Expression, RecordData } from './types'
import Store from '@orbit/store';
import { getTermsOrExpression, getUpdatedRecords, shouldUpdate } from './helpers'
import { Record, Transform, RecordOperation } from '@orbit/data'

export class CacheManager extends Observable<Data> {

  _store: Store

  constructor (store: Store) {
    super()
    this._store = store
  }

  subscribe (id: string, listener: Listener<Data>) {

    // Should stay above the super.subscribe call since it depends on the length of subscriptions
    if (Object.keys(this._subscriptions).length === 0) {
      this._store.on('transform', this._compare)
    }

    const unsubscribe = super.subscribe(id, listener)

    return () => {
      unsubscribe()

      // Should stay below the super.subscribe call since it depends on the length of subscriptions
      if (Object.keys(this._subscriptions).length === 0) {
        this._store.off('transform', this._compare)
      }
    }
  }

  query (queryOrQueries: Query | Queries): Data {
    const termsOrExpression = getTermsOrExpression(queryOrQueries)

    return this._query(termsOrExpression)
  }

  _query (termsOrExpression: Term[] | Expression): Data {
    let data: RecordData = null
    let isError: boolean = false

    try {
      data = !Array.isArray(termsOrExpression)
        ? this._store.cache.query(termsOrExpression) as Record
        : termsOrExpression
          .map(({ key, expression }) => ({ [key]: this._store.cache.query(expression) }))
          .reduce((acc, record) => ({ ...acc, ...record }))

    } catch {
      isError = true
    }

    return [data, { isError, isLoading: false }]
  }

  _compare = (transform: Transform) => {
    const { records, relatedRecords } = getUpdatedRecords(transform.operations as RecordOperation[])

    Object.keys(this._subscriptions).forEach(id => {
      const termsOrExpression = JSON.parse(id)

      if (shouldUpdate(termsOrExpression, records, relatedRecords)) {
        const data = this._query(termsOrExpression)
        super.notify(id, data)
      }
    })
  }
}
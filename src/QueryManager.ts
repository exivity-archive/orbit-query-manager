import Store from '@orbit/store'
import { Transform, RecordOperation, Record } from '@orbit/data'

import { Observable } from './Observable'
import { getUpdatedRecords, shouldUpdate, getTermsOrExpression, hashQueryIdentifier, validateOptions } from './helpers'
import { Term, Queries, Expression, RecordData, Status, QueryRefs, Query, RecordObject, Options, SingleOptions, MultipleOptions, Data, Listener } from './types'
import { FetchManager } from './FetchManager'

export class QueryManager extends Observable<Data> {
  _store: Store
  _fetchManager: FetchManager

  constructor (store: Store) {
    super()
    this._store = store
    this._fetchManager = new FetchManager(store)
  }

  // @ts-ignore
  subscribe (queryOrQueries: Query | Queries, listener: Listener<Data>, options?: Options) {

    const termsOrExpression = getTermsOrExpression(queryOrQueries)

    validateOptions(termsOrExpression, options)

    const id = hashQueryIdentifier(termsOrExpression, options)

    if (Object.keys(this._subscriptions).length === 0) {
      this._store.on('transform', this._compare)
    }

    const unsubscribe = super.subscribe(id, listener)
    const unsubscribeToFetch = this._fetchManager.subscribe(id, listener)

    return () => {
      unsubscribe()
      unsubscribeToFetch()

      if (Object.keys(this._subscriptions).length === 0) {
        this._store.off('transform', this._compare)
      }
    }
  }

  query (queryOrQueries: Query | Queries, options?: Options) {
    return this._fetchManager.query(queryOrQueries, options)
  }

  queryCache (queryOrQueries: Query | Queries): [RecordData, Status] {
    const termsOrExpression = getTermsOrExpression(queryOrQueries)

    return this._queryCache(termsOrExpression)
  }

  _queryCache (termsOrExpression: Term[] | Expression): [RecordData, Status] {
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

      const isLoading = this._fetchManager._queryRefs[id] ? this._fetchManager._queryRefs[id].isLoading : false

      if (!isLoading && shouldUpdate(termsOrExpression, records, relatedRecords)) {
        const data = this._queryCache(termsOrExpression)
        super.notify(id, data)
      }
    })
  }
}
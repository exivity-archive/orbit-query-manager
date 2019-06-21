import Store from '@orbit/store'
import { Record } from '@orbit/data'

import { Observable } from '../Observer'

import {
  Query,
  Queries,
  Options,
  Data,
  Statuses,
  RecordData,
  Term,
  Expression,
  SingleOptions,
  MultipleOptions,
  RecordObject,
  Listener,
  Status
} from '../utils/types'
import { getTermsOrExpression, validateOptions, hashQueryIdentifier } from '../utils/parseQuery'


export class FetchManager extends Observable<Data> {

  _store: Store
  _queryRefs: Statuses = {}
  _afterQueryQueue: { [key: string]: Function[] } = {}

  constructor (store: Store) {
    super()
    this._store = store
  }

  subscribe (id: string, listener: Listener<Data>) {
    const unsubscribe = super.subscribe(id, listener)

    return () => {
      unsubscribe()

      if (this._queryRefs[id] && !this._subscriptions[id]) {
        this._afterQueryQueue[id].push(() => delete this._queryRefs[id])
      }
    }
  }

  query (queryOrQueries: Query | Queries, options?: Options): Data {

    const termsOrExpression = getTermsOrExpression(queryOrQueries)

    validateOptions(termsOrExpression, options)

    const id = hashQueryIdentifier(termsOrExpression, options)

    if (!this._queryRefs[id]) this._initQueryRef(id)

    if (!this._queryRefs[id].isLoading) {
      this._setupForQuery(id);
      this._tryQuery(id, termsOrExpression, options)
    }

    return [null, this._queryRefs[id]]
  }

  _setupForQuery (id: string) {
    this._queryRefs[id].isLoading = true;
    this._afterQueryQueue[id] = [];
  }

  async _tryQuery (id: string, termsOrExpression: Term[] | Expression, options?: Options) {

    let data: RecordData = null
    let isError: boolean = false
    try {
      data = await this._makeQuery(termsOrExpression, options)
    } catch  {
      isError = true
    } finally {
      this._updateStatus(id, { isError, isLoading: false })

      const status = this._getStatus(id)
      super.notify(id, [data, status])

      this._runAfterQueryQueue(id);
    }
  }

  _updateStatus (id: string, status: Status) {
    this._queryRefs[id] = status
  }

  _getStatus (id: string) {
    return this._queryRefs[id]
  }

  _runAfterQueryQueue (id: string) {
    this._afterQueryQueue[id].forEach(fn => fn());
    delete this._afterQueryQueue[id];
  }

  async _makeQuery (termsOrExpression, options: Options): Promise<Record | RecordObject> {
    return !Array.isArray(termsOrExpression)
      ? await this._makeSingleQuery(termsOrExpression, options as SingleOptions)
      : await this._makeMultipleQueries(termsOrExpression, options as MultipleOptions);
  }

  async _makeSingleQuery (expression: Expression, options?: SingleOptions) {
    return new Promise<Record>((resolve, reject) => {
      this._store.query(expression, options)
        .then(record => resolve(record))
        .catch(reject)
    })
  }

  async _makeMultipleQueries (terms: Term[], options: MultipleOptions = []) {
    const results = await Promise.all(terms.map(({ key, expression }) =>
      new Promise<RecordObject>((resolve, reject) => {

        const currentOptions = options.find(option => option.queryKey === key) || { options: {} }

        this._makeSingleQuery(expression, currentOptions.options)
          .then(record => resolve({ [key]: record }))
          .catch(reject)
      })
    ))

    return results.reduce((acc, record) => ({ ...acc, ...record }))
  }

  _initQueryRef (id: string) {
    this._queryRefs[id] = { isLoading: false, isError: false }
  }
}
import { Query, Queries, Options, Data, QueryRefs, RecordData, Term, Expression, SingleOptions, MultipleOptions, RecordObject, Listener } from './types';
import { getTermsOrExpression, validateOptions, hashQueryIdentifier } from './helpers';
import { Observable } from './Observable';
import Store from '@orbit/store';
import { Record } from '@orbit/data';

export class FetchManager extends Observable<Data> {

  _store: Store
  _queryRefs: QueryRefs = {}
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

    if (!this._queryRefs[id]) {
      this._queryRefs[id] = { isLoading: false, isError: false }
    }

    if (!this._queryRefs[id].isLoading) {
      this._queryRefs[id].isLoading = true
      this._afterQueryQueue[id] = []

      this._query(id, termsOrExpression, options)
    }

    return [null, this._queryRefs[id]]
  }


  async _query (id: string, termsOrExpression: Term[] | Expression, options?: Options) {

    let data: RecordData = null
    let isError: boolean = false
    try {
      data = !Array.isArray(termsOrExpression)
        ? await this._makeSingleQuery(termsOrExpression, options as SingleOptions)
        : await this._makeMultipleQueries(termsOrExpression, options as MultipleOptions)

    } catch  {
      isError = true
    } finally {
      const status = { isLoading: false, isError }
      this._queryRefs[id] = status
      super.notify(id, [data, status])

      this._afterQueryQueue[id].forEach(fn => fn())
      delete this._afterQueryQueue[id]
    }
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
}
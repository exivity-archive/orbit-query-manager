import Store from '@orbit/store'

import { getTermsOrExpression, hashQueryIdentifier, validateOptions } from './helpers'
import { Queries, Query, Options, Data, Listener } from './types'
import { FetchManager } from './FetchManager'
import { CacheManager } from './CacheManager';

export class QueryManager {

  _fetchManager: FetchManager
  _cacheManager: CacheManager

  constructor (store: Store) {
    this._fetchManager = new FetchManager(store)
    this._cacheManager = new CacheManager(store)
  }

  subscribe (queryOrQueries: Query | Queries, listener: Listener<Data>, options?: Options) {

    const termsOrExpression = getTermsOrExpression(queryOrQueries)

    validateOptions(termsOrExpression, options)

    const id = hashQueryIdentifier(termsOrExpression, options)

    const unsubscribeFromCache = this._cacheManager.subscribe(id, listener)
    const unsubscribeFromFetch = this._fetchManager.subscribe(id, listener)

    return () => {
      unsubscribeFromCache()
      unsubscribeFromFetch()
    }
  }

  query (queryOrQueries: Query | Queries, options?: Options) {
    return this._fetchManager.query(queryOrQueries, options)
  }

  queryCache (queryOrQueries: Query | Queries) {
    return this._cacheManager.query(queryOrQueries)
  }

}
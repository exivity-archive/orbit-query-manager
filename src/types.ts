import {
  Record,
  QueryBuilder,
  QueryTerm,
  QueryExpression,
  FindRecord,
  FindRelatedRecord,
  FindRecords,
  FindRelatedRecords
} from '@orbit/data'

export type BeforeCallback<E extends {}> = (expression: QueryExpression, extensions: Readonly<E>) => boolean | void

export type OnCallback<E extends {}> = (records: RecordObject, extensions: Readonly<E>) => void

export type OnErrorCallback<E extends {}> = (error: Error, extensions: Readonly<E>) => void

export interface QueryCacheOptions<E> {
  beforeQuery?: BeforeCallback<E>
  onQuery?: OnCallback<E>
  onError?: OnErrorCallback<E>
}

export interface SubscribeOptions { listenerLabel?: string }

export type Queries = { [key: string]: (q: QueryBuilder) => QueryTerm }

export type Expressions = FindRecord | FindRelatedRecord | FindRecords | FindRelatedRecords

export type Term = { key: string, expression: Expressions }

export type Listener = (() => void) & { label?: string }

export interface RecordObject {
  [key: string]: Record
}

export interface OngoingQueries {
  [key: string]: {
    request: Promise<RecordObject>[]
    afterRequestQueue: (() => void)[]
  }
}

export interface Status {
  error: null | Error,
  loading: boolean,
}

export interface Statuses {
  [key: string]: Status
}

export interface Subscription {
  terms: Term[]
  listeners: Listener[]
}

export interface Subscriptions {
  [key: string]: Subscription
}
import {
  Record,
  QueryBuilder,
  QueryTerm,
  FindRecord,
  FindRelatedRecord,
  FindRecords,
  FindRelatedRecords
} from '@orbit/data'

export type BeforeCallback<E extends {}> = ((expression: Term[], extensions: Readonly<E>) => boolean | void) & { label?: string }

export type OnCallback<E extends {}> = ((records: RecordObject, extensions: Readonly<E>) => void) & { label?: string }

export type OnErrorCallback<E extends {}> = ((error: Error, extensions: Readonly<E>) => void) & { label?: string }

export interface EventCallbacks<E> {
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
  error: null | Error
  loading: boolean
  records: RecordObject | null
}

export interface Statuses {
  [key: string]: Status
}

export interface Subscription<E> {
  terms: Term[]
  listeners: Listener[]
  beforeQueries: BeforeCallback<E>[]
  onQueries: OnCallback<E>[]
  onErrors: OnErrorCallback<E>[]
}

export interface Subscriptions<E> {
  [key: string]: Subscription<E>
}
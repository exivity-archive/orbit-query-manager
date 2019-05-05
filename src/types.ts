import {
  Record,
  QueryBuilder,
  QueryTerm,
  FindRecord,
  FindRelatedRecord,
  FindRecords,
  FindRelatedRecords
} from '@orbit/data'

export type BeforeCallback<E extends {}> = ((expression: Term[], extensions: Readonly<E>) => boolean | void)

export type OnCallback<E extends {}> = ((records: RecordObject, extensions: Readonly<E>) => void)

export type OnErrorCallback<E extends {}> = ((error: Error, extensions: Readonly<E>) => void)

export type Listener = (() => void)

export interface EventCallbacks<E> {
  beforeQuery?: BeforeCallback<E>
  onQuery?: OnCallback<E>
  onError?: OnErrorCallback<E>
  listener?: Listener
}

export type Queries = { [key: string]: (q: QueryBuilder) => QueryTerm }

export type Expressions = FindRecord | FindRelatedRecord | FindRecords | FindRelatedRecords

export type Term = { key: string, expression: Expressions }

export interface RecordObject {
  [key: string]: Record
}

export interface OngoingQueries<E> {
  [key: string]: {
    request?: Promise<RecordObject>[]
    afterRequestQueue: (() => void)[]
    beforeQueries: BeforeCallback<E>[]
    onQueries: OnCallback<E>[]
    onErrors: OnErrorCallback<E>[]
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
  subscriberCount: number
}

export interface Subscriptions<E> {
  [key: string]: Subscription<E>
}
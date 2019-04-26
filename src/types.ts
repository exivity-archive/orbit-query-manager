import { Record, QueryBuilder, QueryTerm, QueryExpression, RecordIdentity, FindRecord, FindRelatedRecord, FindRecords, FindRelatedRecords } from '@orbit/data'

export type BeforeCallback<E extends {}> = (expression: QueryExpression, extensions: Readonly<E>) => void

export type OnCallback<E extends {}> = (records: RecordObject, extensions: Readonly<E>) => void

export type OnErrorCallback<E extends {}> = (error: Error, extensions: Readonly<E>) => void

export interface Options<E extends {} = { [key: string]: any }> {
  beforeQuery?: BeforeCallback<E>
  onQuery?: OnCallback<E>
  onError?: OnErrorCallback<E>
  [key: string]: any
}

export type Queries = { [key: string]: (q: QueryBuilder) => QueryTerm }

export type Expressions = FindRecord | FindRelatedRecord | FindRecords | FindRelatedRecords

export type Term = { key: string, expression: Expressions }

export interface RecordObject {
  [key: string]: Record
}

export interface OngoingQuery {
  queries: Promise<RecordObject>[],
  listeners: number
  queryRef: string
}

export interface OngoingQueries {
  [key: string]: OngoingQuery
}

export interface Subscription {
  error: null | Error,
  loading: boolean,
  terms: Term[]
  listeners: number,
  result: null | RecordObject
}

export interface Subscriptions {
  [key: string]: Subscription
}

export interface RelatedRecords {
  owner: RecordIdentity
  relationship: string
  inverse: string
  identity: RecordIdentity | null
  type: 'hasOne' | 'hasMany'
}
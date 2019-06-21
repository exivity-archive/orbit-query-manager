import { getTerms, getExpression, hashQueryIdentifier, validateOptions } from './parseQuery';
import { Term, Expression, Options } from './types';

describe('getTerms(...)', () => {
  test('It should return an array of terms when a query object gets passed in', () => {
    const query = {
      Accounts: q => q.findRecords('account'),
      Services: q => q.findRecords('service')
    }

    const terms = getTerms(query)

    expect(terms).toMatchObject([
      { key: 'Accounts', expression: { op: 'findRecords', type: 'account' } },
      { key: 'Services', expression: { op: 'findRecords', type: 'service' } }
    ])
  })

  test('It should return an array of terms when a query object gets passed in', () => {
    const query = {
      Cccounts: q => q.findRecords('account'),
      Accounts: q => q.findRecords('account'),
      Bccounts: q => q.findRecords('account')
    }

    const terms = getTerms(query)

    expect(terms).toMatchObject([
      { key: 'Accounts', expression: { op: 'findRecords', type: 'account' } },
      { key: 'Bccounts', expression: { op: 'findRecords', type: 'account' } },
      { key: 'Cccounts', expression: { op: 'findRecords', type: 'account' } }
    ])
  })
})

describe('getExpression(...)', () => {
  test('It should return an expression for a single query function', () => {
    const query = q => q.findRecords('account')

    const expression = getExpression(query)

    expect(expression).toMatchObject({ op: 'findRecords', type: 'account' })
  })
})

describe('hashQueryIdentifier(...)', () => {
  test('It returns a hash of the termsOrExpression', () => {
    const terms: Term[] = [
      { key: 'Accounts', expression: { op: 'findRecords', type: 'account' } },
      { key: 'Services', expression: { op: 'findRecords', type: 'service' } }
    ]
    const expression: Expression = { op: 'findRecords', type: 'account' }

    const termsHash = hashQueryIdentifier(terms)
    const expressionHash = hashQueryIdentifier(expression)

    expect(JSON.parse(termsHash)).toMatchObject(terms)
    expect(JSON.parse(expressionHash)).toMatchObject(expression)
  })

  test('It returns a hash of the termsOrExpression with options if it has properties', () => {
    const expression: Expression = { op: 'findRecords', type: 'account' }
    const options = { test: 'test' }

    const expressionHash = hashQueryIdentifier(expression, options)

    expect(JSON.parse(expressionHash)).toMatchObject({ termsOrExpression: expression, options })
  })
})

describe('validateOptions(...)', () => {
  test(`doesn't throw an error when passed a term array and an options array`, () => {
    const terms: Term[] = [
      { key: 'Accounts', expression: { op: 'findRecords', type: 'account' } },
      { key: 'Services', expression: { op: 'findRecords', type: 'service' } }
    ]

    const options: Options = [
      {
        queryKey: 'Accounts',
        options: { test: 'test' }
      },
    ]

    let error = null
    try {
      validateOptions(terms, options)
    } catch (reason) {
      error = reason
    }

    expect(error).toBe(null)
  })

  test(`doesn't throw an error when passed an expression and an options object`, () => {
    const expression: Expression = { op: 'findRecords', type: 'account' }
    const options: Options = { test: 'test' }

    let error = null
    try {
      validateOptions(expression, options)
    } catch (reason) {
      error = reason
    }

    expect(error).toBe(null)
  })

  test(`throws an error when passed a term array and an options object`, () => {
    const terms: Term[] = [
      { key: 'Accounts', expression: { op: 'findRecords', type: 'account' } },
      { key: 'Services', expression: { op: 'findRecords', type: 'service' } }
    ]

    const options: Options = { test: 'test' }


    let error = null
    try {
      validateOptions(terms, options)
    } catch (reason) {
      error = reason
    }

    expect(error).toBeDefined()
    expect(error.message).toBe('Options are invalid. When making multiple queries' +
      'the options must be an array of objects with a "queryKey" property that refers to the query to which the options apply'
    )
  })

  test(`throws an error when passed an expression and an options array`, () => {
    const expression: Expression = { op: 'findRecords', type: 'account' }

    const options: Options = [
      {
        queryKey: 'Accounts',
        options: { test: 'test' }
      },
    ]

    let error = null
    try {
      validateOptions(expression, options)
    } catch (reason) {
      error = reason
    }

    expect(error).toBeDefined()
    expect(error.message).toBe('Options are invalid.')
  })
})
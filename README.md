# orbit-query-manager

=============

A manager for [Orbit](https://orbitjs.com/) that listens for changes in the cache and hooks queries into ongoing identical queries.

This package helps to keep the data in your app up to date in an efficient way by updating your records only when they have been changed and by hooking multiple identical queries into the same request

---

Installation
------------

_npm_

```
npm install --save orbit-query-manager
```

_yarn_

```
yarn add orbit-query-manager
```

API
---

### Initialize QueryManager

```js
import { QueryManager } from 'orbit-query-manager'

// First create a QueryManager.
// The query manager takes a regular orbit store as the first parameter.
// You pass in extensions as a optional second parameter.
// These extensions can be anything you want and
// will become accessible later inside the optional event callbacks.

const manager = new QueryManager(store,
  extensions: {
    dispatch: redux.dispatch,
    router: react.router,
    modal: modal
  }
)
```

### Use the QueryManager

```js
// By subscribing to a query you specify that your're interested in when the records you queried for change.
const query = { Accounts: q => q.findRecords('account')}
const listener = () => { console.log('An account got changed')}

const queryRef = manager.subscribe(query, { listener })

// Trigger a new fetch
manager.query(queryRef)

// All of these hook onto the request made by the query above resulting in only one request being made
manager.query(queryRef)
manager.query(queryRef)

// But the onFinish callbacks keep stacking
manager.query(queryRef, () => { console.log('I get called') })
manager.query(queryRef, () => { console.log('I get called too') })

// At any time you can access the current status with the queryRef
const { loading, error, records } = manager.statuses[queryRef]

// To stop listening to changes in the cache you can simply unsubscribe.
// Make sure that all the event callbacks that are passed to subscribe
// are also passed to unsubscribe for proper cleanup 
manager.unsubscribe(queryRef, { listener })

```

### Event callbacks
When subscribing to a query you can pass four different types of event callbacks. 
The event callbacks will stack when manager.subscribe(...) gets called multiple times for an identical query.
```js
// 1: listener: Gets called every time the cache updates (in react this function could be used to trigger a rerender for instance)
const listener = () => {
  /* some logic */
}

// 2: beforeQuery: Gets called before the query and is called with an array of terms and the extensions
const beforeQuery = (terms, extensions) => {
   /* some logic */
}

// 3: onQuery: Gets called if the query is successful and is called with the result and the extensions
const onQuery = (result, extensions) => {
  /* some logic */
}

// 4: onError: Gets called if the query fails and is called with the error and the extensions
const onError = (error, extensions) => {
  /* some logic */
}
```


License
-------

MIT
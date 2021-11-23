# @dhmk/atom-react

React bindings for [@dhmk/atom](https://github.com/dhmk083/dhmk-atom)

Install: `npm install @dhmk/atom-react`

## API

### `observer(Component: T): T`

Wraps either React's class component or functional component into observable component. Whenever an atom called inside render function is changed, the component will update.

### `<Observer>{() => ...}</Observer>`

Observable component.

### SSR

#### `enableStaticRendering(enable = true)`

Toggle atom observing.

#### `isUsingStaticRendering(): boolean`

Check atom observing status.

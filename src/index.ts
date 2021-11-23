import React from "react";
import { observe } from "@dhmk/atom";

let isSSR = false;

export function enableStaticRendering(enable = true) {
  isSSR = enable;
}

export const isUsingStaticRendering = () => isSSR;

const noop = () => {};

const useUpdate = () => React.useReducer((x) => (x + 1) & 0xffffffff, 0)[1];

const construct =
  Reflect?.construct ??
  ((ctor: any, args: any, target: any) => {
    const x = new ctor(...args);
    Object.setPrototypeOf(x, target.prototype);
    return x;
  });

/*
  Here, a most obvious form `return class extends C {...}` is not used,
  because in a user code, if `C` is a ES6 class, it will give an error:
  "TypeError: Class constructor cannot be invoked without 'new'".
  That's because typescript uses `C.call(this, ...args)` form and not `new C(...args)` for subsclassing.
  So, we need to use a hack with `construct` function.
*/
function classObserver(C) {
  return React.memo(
    (() => {
      function AtomObserver(this: never, ...args) {
        const self = construct(C, args, AtomObserver);

        let isRendering = false;
        let renderResult = null;
        let runEffect = noop;

        const C_didMount = self.componentDidMount;
        const C_render = self.render;

        self.componentDidMount = () => {
          C_didMount?.call(self);

          let run = noop;

          const effect = observe(
            () => {
              renderResult = C_render.call(self);
            },
            {
              attachToParent: false,
              checkStale: false,
              scheduler: (_run) => {
                run = _run;
                !isRendering && self.forceUpdate();
              },
            }
          );

          runEffect = () => {
            effect.invalidate(true);
            run();
          };

          const C_willUnmount = self.componentWillUnmount;

          self.componentWillUnmount = () => {
            effect();
            C_willUnmount?.call(self);
          };
        };

        self.render = () => {
          isRendering = true;
          runEffect();
          isRendering = false;
          return renderResult;
        };

        return self;
      }

      AtomObserver.prototype = Object.create(C.prototype);
      AtomObserver.prototype.constructor = AtomObserver;
      AtomObserver.displayName = C.displayName || C.name || "AtomObserver";

      return AtomObserver as any;
    })()
  ) as any;
}

function functionObserver(C) {
  function AtomObserverFC(props) {
    const state = React.useRef<any>({
      update: useUpdate(),
      effect: null,
      run: noop,
      renderResult: null,
      isRendering: false,
      currentProps: {},
    }).current;

    const createEffect = () =>
      observe(() => (state.renderResult = C(state.currentProps)), {
        attachToParent: false,
        checkStale: false,
        scheduler: (run) => {
          state.run = run;
          !state.isRendering && state.update();
        },
      });

    state.isRendering = true;

    if (!state.effect) {
      state.effect = createEffect();

      // mark effect
      ObserversGC.track(state.effect);
    }

    React.useEffect(() => {
      if (state.effect.isDisposed) {
        // recreate effect
        state.effect = createEffect();
      } else {
        // commit effect
        ObserversGC.untrack(state.effect);
      }

      return () => {
        state.update = noop;
      };
    }, []);

    state.currentProps = props;
    state.effect.invalidate(true);
    state.run();
    state.isRendering = false;
    return state.renderResult;
  }

  AtomObserverFC.displayName = C.displayName || C.name || "AtomObserverFC";

  return React.memo(AtomObserverFC);
}

export function observer<T>(C: T): T {
  if (isUsingStaticRendering()) return C;

  return React.Component.isPrototypeOf(C)
    ? classObserver(C)
    : functionObserver(C);
}

export function Observer({
  children,
}: {
  children: () => ReturnType<React.FC>;
}): ReturnType<React.FC> {
  const render = React.useRef(children as Function);
  render.current = children;
  return React.createElement(
    React.useState(() => observer(() => render.current()))[0] as any
  );
}

const ObserversGC = {
  items: new Map(),
  tid: 0 as any,
  thresholdMs: 10_000,

  queueCleanup() {
    this.tid = setTimeout(() => {
      this.tid = 0;
      const now = Date.now();
      this.items.forEach((t, o) => {
        if (now - t >= this.thresholdMs) {
          o();
          this.items.delete(o);
        }
      });
      if (this.items.size) this.queueCleanup();
    }, this.thresholdMs + 1000);
  },

  track(o) {
    this.items.set(o, Date.now());
    if (!this.tid) this.queueCleanup();
  },

  untrack(o) {
    this.items.delete(o);

    if (this.items.size === 0 && this.tid) {
      clearTimeout(this.tid);
      this.tid = 0;
    }
  },
};

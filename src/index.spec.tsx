import React from "react";
import { render, act } from "@testing-library/react";
import { atom } from "@dhmk/atom";

import { observer } from "./index";

describe("observer", () => {
  test("functional", () => {
    const c = atom(1);
    const Comp = observer(({ q }: { q: string }) => <p>{`${c()} ${q}`}</p>);
    const { container, rerender } = render(
      <React.StrictMode>
        <Comp q="test" />
      </React.StrictMode>
    );

    expect(container.textContent).toEqual("1 test");

    act(() => {
      c.set(2);
    });

    expect(container.textContent).toEqual("2 test");

    rerender(
      <React.StrictMode>
        <Comp q="best" />
      </React.StrictMode>
    );

    expect(container.textContent).toEqual("2 best");

    act(() => {
      c.set(3);
    });

    expect(container.textContent).toEqual("3 best");
  });

  test("class", () => {
    const c = atom(1);
    const Comp = observer(
      class extends React.Component<{ q: string }> {
        render() {
          return <p>{`${c()} ${this.props.q}`}</p>;
        }
      }
    );
    const { container, rerender } = render(
      <React.StrictMode>
        <Comp q="test" />
      </React.StrictMode>
    );

    expect(container.textContent).toEqual("1 test");

    act(() => {
      c.set(2);
    });

    expect(container.textContent).toEqual("2 test");

    rerender(
      <React.StrictMode>
        <Comp q="best" />
      </React.StrictMode>
    );

    expect(container.textContent).toEqual("2 best");

    act(() => {
      c.set(3);
    });

    expect(container.textContent).toEqual("3 best");
  });
});

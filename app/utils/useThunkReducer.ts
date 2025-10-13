import { useCallback, useReducer, useState } from "react";

export function useThunkReducer(reducer: any, initialState: any) {
  const [state, setState] = useState(initialState);
  const dispatch = useCallback(
    (action: any) => {
      if (typeof action === "function") {
        setState((prev: any) => {
          const nextState = reducer(prev, action(prev));
          return nextState;
        });
      } else {
        const nextState = reducer(state, action);
        setState(nextState);
      }
    },
    [state]
  );
  return [state, dispatch];
}

export const useBindReducer = useReducer.bind(null, reducer);

export function reducer(current: any, update: any) {
  return { ...current, ...update };
}

import { useComponentValue } from '@latticexyz/react';
import { singletonEntity } from '@latticexyz/store-sync/recs';

import { useMUD } from './MUDContext';

export const App = (): JSX.Element => {
  const {
    components: { Counter },
    systemCalls: { increment },
  } = useMUD();

  const counter = useComponentValue(Counter, singletonEntity);

  return (
    <>
      <div>
        Counter: <span>{counter?.value ?? '??'}</span>
      </div>
      <button
        type="button"
        onClick={async event => {
          event.preventDefault();
          // eslint-disable-next-line no-console
          console.log('new counter value:', await increment());
        }}
      >
        Increment
      </button>
    </>
  );
};

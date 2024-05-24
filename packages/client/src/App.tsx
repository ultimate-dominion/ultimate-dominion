import { Button, Text, VStack } from '@chakra-ui/react';
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
    <VStack mt={4}>
      <Text>
        Counter: <span>{counter?.value ?? '??'}</span>
      </Text>
      <Button
        type="button"
        onClick={async event => {
          event.preventDefault();
          // eslint-disable-next-line no-console
          console.log('new counter value:', await increment());
        }}
      >
        Increment
      </Button>
    </VStack>
  );
};

import { Stack, Text } from '@chakra-ui/react';

// enum ActionEvents {
//   Attack = 'attack',
//   Defend = 'defend against',
//   GainGold = 'gold',
//   GainExperience = 'experience',
// }

// type BattleEvent = {
//   type: ActionEvents;
//   monster: string;
//   amount: number;
// };

// type ResolutionEvent = {
//   type: ActionEvents;
//   amount: number;
// };

// const BATTLE_EVENTS: BattleEvent[] = [
//   {
//     type: ActionEvents.Defend,
//     amount: 1,
//     monster: 'Green Slime',
//   },
//   {
//     type: ActionEvents.Attack,
//     amount: 2,
//     monster: 'Green Slime',
//   },
// ];

// const RESOLUTION_EVENTS: ResolutionEvent[] = [
//   {
//     type: ActionEvents.GainGold,
//     amount: 2,
//   },
//   {
//     type: ActionEvents.GainExperience,
//     amount: 3,
//   },
// ];

export const ActionsPanel = (): JSX.Element => {
  return (
    <Stack spacing={8}>
      <Stack>
        <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
          You must spawn on the map to start battling.
        </Text>
      </Stack>
      {/* <Stack>
        {BATTLE_EVENTS.map((event, i) => (
          <Text
            key={`battle-event-${i}`}
            size={{ base: 'xs', sm: 'sm', lg: 'md' }}
          >
            You {event.type}{' '}
            <Text as="span" color="green">
              {event.monster}
            </Text>{' '}
            {event.type === ActionEvents.Attack ? 'for' : 'taking'}{' '}
            <Text as="span" color="red">
              {event.amount} damage
            </Text>
            .
          </Text>
        ))}
      </Stack>
      <Stack>
        {RESOLUTION_EVENTS.map((event, i) => (
          <Text
            key={`resolution-event-${i}`}
            size={{ base: 'xs', sm: 'sm', lg: 'md' }}
          >
            You gain {event.amount}{' '}
            <Text
              as="span"
              color={event.type === ActionEvents.GainGold ? 'yellow' : 'green'}
            >
              {event.type === ActionEvents.GainGold ? '$GOLD' : 'experience'}
            </Text>
            !
          </Text>
        ))}
      </Stack> */}
    </Stack>
  );
};

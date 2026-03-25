import {
  Box,
  Button,
  Divider,
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { formatEther } from 'viem';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';

const STAT_RESPEC_BASE_COST = 50n;
const RESPEC_COST_PER_LEVEL = 10n;

const StatRow = ({
  label,
  value,
  original,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  value: number;
  original: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  disabled: boolean;
}): JSX.Element => {
  const diff = value - original;

  return (
    <HStack justify="space-between" w="100%">
      <Text color="#C8A96E" fontSize="sm" fontWeight={600} w="40px">
        {label}
      </Text>
      <NumberInput
        isDisabled={disabled}
        max={max}
        min={min}
        onChange={(_, val) => onChange(Number.isNaN(val) ? original : val)}
        size="sm"
        value={value}
        w="100px"
      >
        <NumberInputField
          bg="#1A1612"
          borderColor="#3A3428"
          color="#E8DCC8"
          textAlign="center"
          _focus={{ borderColor: '#C8A96E' }}
        />
        <NumberInputStepper>
          <NumberIncrementStepper borderColor="#3A3428" color="#8A7E6A" />
          <NumberDecrementStepper borderColor="#3A3428" color="#8A7E6A" />
        </NumberInputStepper>
      </NumberInput>
      {diff !== 0 && (
        <Text color={diff > 0 ? 'green.400' : 'red.400'} fontSize="xs" w="40px">
          {diff > 0 ? `+${diff}` : diff}
        </Text>
      )}
      {diff === 0 && <Box w="40px" />}
    </HStack>
  );
};

export const RespecPanel = (): JSX.Element | null => {
  const { character, refreshCharacter } = useCharacter();
  const { currentBattle } = useBattle();
  const {
    systemCalls: { statRespec, fullRespec },
  } = useMUD();
  const { renderSuccess, renderWarning } = useToast();

  const respecTx = useTransaction({ actionName: 'stat respec' });
  const fullRespecTx = useTransaction({ actionName: 'full respec' });

  const isInBattle = currentBattle !== null && currentBattle.end === BigInt(0);

  const baseStr = Number(character?.baseStats?.strength ?? 0);
  const baseAgi = Number(character?.baseStats?.agility ?? 0);
  const baseInt = Number(character?.baseStats?.intelligence ?? 0);
  const totalPool = baseStr + baseAgi + baseInt;

  const [str, setStr] = useState(baseStr);
  const [agi, setAgi] = useState(baseAgi);
  const [int_, setInt] = useState(baseInt);

  const remaining = totalPool - (str + agi + int_);
  const hasChanges = str !== baseStr || agi !== baseAgi || int_ !== baseInt;

  const goldCost = useMemo(() => {
    if (!character) return 0n;
    return STAT_RESPEC_BASE_COST + BigInt(character.level) * RESPEC_COST_PER_LEVEL;
  }, [character]);

  const fullRespecCost = useMemo(() => {
    if (!character) return 0n;
    return goldCost * 5n;
  }, [goldCost, character]);

  const handleStatRespec = useCallback(async () => {
    if (!character || !hasChanges || remaining !== 0) return;

    const result = await respecTx.execute(() =>
      statRespec(character.characterId, str, agi, int_),
    );

    if (result) {
      renderSuccess('Stats redistributed.');
      await refreshCharacter();
    }
  }, [character, hasChanges, remaining, str, agi, int_, respecTx, statRespec, renderSuccess, refreshCharacter]);

  const handleFullRespec = useCallback(async () => {
    if (!character) return;

    renderWarning('Full respec will reset class, level, and equipment. This cannot be undone.');

    const result = await fullRespecTx.execute(() =>
      fullRespec(character.characterId),
    );

    if (result) {
      renderSuccess('Character fully reset.');
      await refreshCharacter();
    }
  }, [character, fullRespecTx, fullRespec, renderSuccess, renderWarning, refreshCharacter]);

  if (!character) return null;

  const disabled = isInBattle || respecTx.isLoading || fullRespecTx.isLoading;

  return (
    <VStack
      bg="#0C0A09"
      border="1px solid"
      borderColor="#3A3428"
      borderRadius="md"
      p={4}
      spacing={4}
      w="100%"
    >
      <Text color="#C8A96E" fontSize="md" fontWeight={700}>
        Redistribute Stats
      </Text>

      <VStack spacing={2} w="100%">
        <StatRow
          disabled={disabled}
          label="STR"
          max={totalPool - agi - int_}
          min={0}
          onChange={setStr}
          original={baseStr}
          value={str}
        />
        <StatRow
          disabled={disabled}
          label="AGI"
          max={totalPool - str - int_}
          min={0}
          onChange={setAgi}
          original={baseAgi}
          value={agi}
        />
        <StatRow
          disabled={disabled}
          label="INT"
          max={totalPool - str - agi}
          min={0}
          onChange={setInt}
          original={baseInt}
          value={int_}
        />
      </VStack>

      <HStack justify="space-between" w="100%">
        <Text color="#8A7E6A" fontSize="xs">
          Remaining: {remaining}
        </Text>
        <Text color="#8A7E6A" fontSize="xs">
          Cost: {formatEther(goldCost)} gold
        </Text>
      </HStack>

      <Button
        colorScheme="yellow"
        isDisabled={disabled || !hasChanges || remaining !== 0}
        isLoading={respecTx.isLoading}
        onClick={handleStatRespec}
        size="sm"
        variant="outline"
        w="100%"
      >
        Redistribute Stats
      </Button>

      <Divider borderColor="#3A3428" />

      <VStack spacing={2} w="100%">
        <Text color="#8A7E6A" fontSize="xs" textAlign="center">
          Full respec resets class, level, and all equipment.
          Cost: {formatEther(fullRespecCost)} gold.
        </Text>
        <Button
          colorScheme="red"
          isDisabled={disabled}
          isLoading={fullRespecTx.isLoading}
          onClick={handleFullRespec}
          size="sm"
          variant="outline"
          w="100%"
        >
          Full Reset
        </Button>
      </VStack>

      {isInBattle && (
        <Text color="red.400" fontSize="xs">
          Cannot respec during combat.
        </Text>
      )}
    </VStack>
  );
};

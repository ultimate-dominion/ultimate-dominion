import { Box, BoxProps, Text, Tooltip } from '@chakra-ui/react';

type EntityMarkProps = BoxProps & {
  code: string;
  label: string;
  tone?: string;
};

export function EntityMark({
  code,
  label,
  tone = '#C4B89E',
  ...props
}: EntityMarkProps): JSX.Element {
  return (
    <Tooltip
      aria-label={label}
      bg="#14120F"
      hasArrow
      label={label}
      shouldWrapChildren
    >
      <Box
        alignItems="center"
        aria-label={label}
        background="linear-gradient(145deg, rgba(255,255,255,0.04), rgba(0,0,0,0.18))"
        border="1px solid"
        borderColor={tone}
        boxSize="40px"
        display="flex"
        flexShrink={0}
        justifyContent="center"
        role="group"
        {...props}
      >
        <Text
          color={tone}
          fontFamily="'Fira Code', monospace"
          fontSize="10px"
          fontWeight={800}
          letterSpacing="0.08em"
          lineHeight={1}
          textTransform="uppercase"
        >
          {code}
        </Text>
      </Box>
    </Tooltip>
  );
}

export function getInitials(name?: string, fallback = 'PC'): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function CharacterMark({
  name,
  ...props
}: Omit<EntityMarkProps, 'code' | 'label'> & {
  name?: string;
}): JSX.Element {
  const label = name?.trim() || 'Adventurer';
  return (
    <EntityMark
      code={getInitials(name)}
      label={label}
      tone="#D4A54A"
      {...props}
    />
  );
}

export function MonsterMark({
  name,
  ...props
}: Omit<EntityMarkProps, 'code' | 'label'> & {
  name?: string;
}): JSX.Element {
  const label = name?.trim() || 'Unknown creature';
  return <EntityMark code="FOE" label={label} tone="#B85C3A" {...props} />;
}

export function FragmentMark({
  index,
  title,
  ...props
}: Omit<EntityMarkProps, 'code' | 'label'> & {
  index?: number;
  title?: string;
}): JSX.Element {
  const number = index != null ? Math.max(1, index) : null;
  return (
    <EntityMark
      code={number == null ? 'LORE' : toRoman(number)}
      label={title?.trim() || 'Lore fragment'}
      tone="#A8DEFF"
      {...props}
    />
  );
}

function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = Math.min(value, 20);
  let result = '';
  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result;
}

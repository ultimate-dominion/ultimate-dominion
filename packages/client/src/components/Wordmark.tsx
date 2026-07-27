import { Text, TextProps } from '@chakra-ui/react';

export function Wordmark(props: TextProps): JSX.Element {
  return (
    <Text
      color="#E8DCC8"
      fontFamily="'Cinzel', serif"
      fontSize={{ base: '17px', sm: '21px' }}
      fontWeight={600}
      letterSpacing="0.16em"
      lineHeight={1}
      textTransform="uppercase"
      whiteSpace="nowrap"
      {...props}
    >
      Ultimate{' '}
      <Text as="span" color="#C87A2A">
        Dominion
      </Text>
    </Text>
  );
}

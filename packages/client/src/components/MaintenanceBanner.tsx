import { Box, Text } from '@chakra-ui/react';

export const MaintenanceBanner = (): JSX.Element => {
  return (
    <Box
      bg="linear-gradient(90deg, #4A1A1A 0%, #3A0E0E 50%, #4A1A1A 100%)"
      borderBottom="1px solid #C83A2A"
      px={4}
      py={3}
      w="100%"
    >
      <Text
        color="#E8A54A"
        fontFamily="Cinzel, serif"
        fontSize={{ base: 'xs', md: 'sm' }}
        fontWeight="bold"
        textAlign="center"
        maxW="1200px"
        mx="auto"
      >
        System upgrade in progress — you may experience intermittent issues.
        Things will be back to normal shortly.
      </Text>
    </Box>
  );
};

import { Box, StackProps } from '@chakra-ui/react';
import { ReactNode } from 'react';

export const PolygonalCard = ({
  bgColor = '#1C1814',
  children,
  clipPath = 'polygon(40px 0%, 100% 0%, 100% calc(100% - 50px), calc(100% - 50px) 100%, 0% 100%, 0% 80px)',
  h = '100%',
  isModal = false,
  w = '100%',
  ...stackProps
}: {
  children?: ReactNode;
  clipPath?: string;
  isModal?: boolean;
} & StackProps): JSX.Element => {
  return (
    <Box
      bgColor="#3A3228"
      clipPath={clipPath}
      h={h}
      position={isModal ? 'absolute' : 'static'}
      py="5px"
      zIndex={isModal ? -1 : 'initial'}
      w={w}
    >
      <Box
        bgColor={bgColor}
        clipPath={clipPath}
        h="100%"
        ml="6px"
        py="5px"
        w="calc(100% - 12px)"
      >
        <Box
          bgColor="rgba(200,122,42,0.3)"
          clipPath={clipPath}
          h="100%"
          ml="6px"
          p="0.5px"
          w="calc(100% - 12px)"
        >
          <Box
            bgColor={bgColor}
            clipPath={clipPath}
            h="100%"
            ml=".25px"
            overflow="hidden"
            w="calc(100% - 0.5px)"
          >
            <Box {...stackProps} h="100%" w="100%">
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

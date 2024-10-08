import { Box, StackProps } from '@chakra-ui/react';
import { ReactNode } from 'react';

export const PolygonalCard = ({
  children,
  clipPath = 'polygon(40px 0%, 100% 0%, 100% calc(100% - 50px), calc(100% - 50px) 100%, 0% 100%, 0% 80px)',
  ...stackProps
}: { children: ReactNode; clipPath?: string } & StackProps): JSX.Element => {
  return (
    <Box bgColor="#1A244E" clipPath={clipPath} py="5px" {...stackProps}>
      <Box
        bgColor="#B3B9BE"
        clipPath={clipPath}
        ml="6px"
        py="5px"
        w="calc(100% - 12px)"
      >
        <Box
          bgColor="#3B82C4"
          clipPath={clipPath}
          ml="6px"
          p="0.5px"
          w="calc(100% - 12px)"
        >
          <Box
            bgColor="#B3B9BE"
            clipPath={clipPath}
            ml=".25px"
            w="calc(100% - 0.5px)"
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

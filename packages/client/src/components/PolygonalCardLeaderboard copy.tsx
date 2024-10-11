import { Box, StackProps } from '@chakra-ui/react';
import { ReactNode } from 'react';

export const PolygonalCardLeaderboard = ({
  children,
  clipPath = 'polygon(0% 0%, 50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, 0% 100%)',
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

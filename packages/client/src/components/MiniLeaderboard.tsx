import {
  Box,
  Button,
  Heading,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { type NearbyRanksResult } from '../hooks/useNearbyRanks';
import { LEADERBOARD_PATH } from '../Routes';
import { etherToFixedNumber } from '../utils/helpers';

import { PolygonalCard } from './PolygonalCard';

type MiniLeaderboardProps = Pick<NearbyRanksResult, 'nearby' | 'isLoading' | 'rankBy' | 'setRankBy'>;

export const MiniLeaderboard = ({ nearby, isLoading, rankBy, setRankBy }: MiniLeaderboardProps): JSX.Element | null => {
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const sorted = [...nearby].sort((a, b) => {
      const rankA = rankBy === 'stats' ? a.statsRank : a.goldRank;
      const rankB = rankBy === 'stats' ? b.statsRank : b.goldRank;
      return rankA - rankB;
    });
    return sorted.slice(0, 5);
  }, [nearby, rankBy]);

  if (isLoading || rows.length === 0) return null;

  return (
    <PolygonalCard className="data-dense" clipPath="none">
      <HStack
        bgColor="blue500"
        h={{ base: '36px', md: '36px' }}
        justify="space-between"
        px="12px"
        width="100%"
      >
        <Heading
          as="button"
          onClick={() => navigate(LEADERBOARD_PATH)}
          size="xs"
          _hover={{ textDecoration: 'underline', cursor: 'pointer' }}
        >
          Nearby Ranks
        </Heading>
        <HStack spacing={0}>
          <Button
            borderBottom={rankBy === 'stats' ? '2px solid #C87A2A' : '2px solid transparent'}
            borderRadius={0}
            color={rankBy === 'stats' ? '#E8DCC8' : '#5A5040'}
            fontSize="2xs"
            fontWeight={rankBy === 'stats' ? 700 : 400}
            h="36px"
            minW={0}
            onClick={() => setRankBy('stats')}
            px={2}
            variant="unstyled"
          >
            Stats
          </Button>
          <Button
            borderBottom={rankBy === 'gold' ? '2px solid #C87A2A' : '2px solid transparent'}
            borderRadius={0}
            color={rankBy === 'gold' ? '#E8DCC8' : '#5A5040'}
            fontSize="2xs"
            fontWeight={rankBy === 'gold' ? 700 : 400}
            h="36px"
            minW={0}
            onClick={() => setRankBy('gold')}
            px={2}
            variant="unstyled"
          >
            Gold
          </Button>
        </HStack>
      </HStack>

      <VStack spacing={0} w="100%">
        {rows.map((player, i) => (
          <Box key={player.characterId} w="100%">
            <HStack
              bg={player.isSelf ? 'rgba(212,165,74,0.06)' : 'transparent'}
              borderLeft={player.isSelf ? '3px solid #D4A54A' : '3px solid transparent'}
              cursor="pointer"
              onClick={() => navigate(`/characters/${player.characterId}`)}
              px={2}
              py={1}
              spacing={2}
              w="100%"
              _hover={{ bg: 'rgba(196,184,158,0.06)' }}
            >
              <Text
                color={
                  (rankBy === 'stats' ? player.statsRank : player.goldRank) <= 3
                    ? '#C87A2A'
                    : '#8A7E6A'
                }
                fontFamily="mono"
                fontWeight={700}
                minW="28px"
                size="xs"
              >
                #{rankBy === 'stats' ? player.statsRank : player.goldRank}
              </Text>
              <Text
                color={player.isSelf ? '#E8DCC8' : '#8A7E6A'}
                flex={1}
                fontWeight={player.isSelf ? 700 : 400}
                isTruncated
                size="xs"
              >
                {player.name}
              </Text>
              <Text color="#5A5040" fontFamily="mono" size="2xs">
                Lv {player.level}
              </Text>
              <Text color="#D4A54A" fontFamily="mono" fontWeight={600} size="xs" textAlign="right">
                {rankBy === 'stats'
                  ? player.totalStats
                  : etherToFixedNumber(player.totalGold)}
              </Text>
            </HStack>
            {i < rows.length - 1 && (
              <Box
                bg="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="1px"
                w="100%"
              />
            )}
          </Box>
        ))}
      </VStack>
    </PolygonalCard>
  );
};

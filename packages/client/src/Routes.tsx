import { Text, VStack } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { SyncStep } from '@latticexyz/store-sync';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { Route, Routes, useLocation } from 'react-router-dom';

import { useMUD } from './contexts/MUDContext';
import { CharacterPage } from './pages/Character';
import { CharacterCreation } from './pages/CharacterCreation';
import { GameBoard } from './pages/GameBoard';
import { Welcome } from './pages/Welcome';

const AppRoutes: React.FC = () => {
  const { pathname } = useLocation();
  const {
    components: { SyncProgress },
  } = useMUD();

  const syncProgress = useComponentValue(SyncProgress, singletonEntity);

  if (syncProgress && syncProgress.step !== SyncStep.LIVE && pathname !== '/') {
    return (
      <VStack justify="center" h="100%">
        <Text>
          {syncProgress.message} {Math.round(syncProgress.percentage)}%
        </Text>
      </VStack>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/character-creation" element={<CharacterCreation />} />
      <Route path="/game-board" element={<GameBoard />} />
      <Route path="/characters/:characterId" element={<CharacterPage />} />
    </Routes>
  );
};

export default AppRoutes;

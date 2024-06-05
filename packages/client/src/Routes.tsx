import { Route, Routes } from 'react-router-dom';

import { CharacterCreation } from './pages/CharacterCreation';
import { GameBoard } from './pages/GameBoard';
import { Welcome } from './pages/Welcome';
import { World } from './pages/World';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/character-creation" element={<CharacterCreation />} />
      <Route path="/game-board" element={<GameBoard />} />
      <Route path="/world" element={<World />} />
    </Routes>
  );
};

export default AppRoutes;

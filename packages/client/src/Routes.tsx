import { Route, Routes } from 'react-router-dom';

import { CharacterCreation } from './pages/CharacterCreation';
import { GameBoard } from './pages/GameBoard';
import { Welcome } from './pages/Welcome';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/character-creation" element={<CharacterCreation />} />
      <Route path="/game-board" element={<GameBoard />} />
    </Routes>
  );
};

export default AppRoutes;

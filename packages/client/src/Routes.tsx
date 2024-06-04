import { Route, Routes } from 'react-router-dom';

import { CharacterCreation } from './components/CharacterCreation';
import { Welcome } from './pages/Welcome';
import { World } from './pages/World';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/world" element={<World />} />
      <Route path="/character-creation" element={<CharacterCreation />} />
    </Routes>
  );
};

export default AppRoutes;

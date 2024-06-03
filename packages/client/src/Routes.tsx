import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { CharacterCreation } from './pages/CharacterCreation';
import { Welcome } from './pages/Welcome';
import { World } from './pages/World';

const AppRoutes: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/world" element={<World />} />
        <Route path="/character-creation" element={<CharacterCreation />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;

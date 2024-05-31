import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { CharacterCreation } from './components/CharacterCreation';
import { Welcome } from './components/Welcome';
import { World } from './components/World';

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

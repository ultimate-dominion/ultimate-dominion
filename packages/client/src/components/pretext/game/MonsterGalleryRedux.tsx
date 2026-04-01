import { MonsterGallery } from './MonsterGallery';
import { MONSTER_TEMPLATES_REDUX } from './monsterTemplatesRedux';

export function MonsterGalleryRedux() {
  return (
    <MonsterGallery
      templates={MONSTER_TEMPLATES_REDUX}
      galleryTitle="Zone 1 Monsters II"
    />
  );
}

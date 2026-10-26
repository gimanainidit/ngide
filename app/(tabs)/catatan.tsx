import { IdeaList } from '../../src/lib/IdeaList';
import { listMyIdeas } from '../../src/lib/api';

export default function Catatan() {
  return <IdeaList load={listMyIdeas} empty="Belum ada catatan. Tap Rekam untuk mulai." />;
}

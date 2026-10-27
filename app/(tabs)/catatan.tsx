import { IdeaList } from '../../src/lib/IdeaList';
import { PendingList } from '../../src/lib/PendingList';
import { listMyIdeas } from '../../src/lib/api';

export default function Catatan() {
  return <IdeaList load={listMyIdeas} header={<PendingList />} empty="Belum ada catatan. Tap Rekam untuk mulai." />;
}

import { router } from 'expo-router';
import { IdeaList } from '../../src/lib/IdeaList';
import { PendingList } from '../../src/lib/PendingList';
import { listMyIdeas } from '../../src/lib/api';

export default function Catatan() {
  return (
    <IdeaList
      load={listMyIdeas}
      header={<PendingList />}
      empty="Belum ada catatan. Ide pertamamu cukup satu tap."
      emptyAction={{ label: 'Rekam ide pertama', onPress: () => router.navigate('/') }}
    />
  );
}

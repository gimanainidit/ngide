import { router } from 'expo-router';
import { IdeaList } from '../../src/lib/IdeaList';
import { listTeamIdeas } from '../../src/lib/api';

export default function Tim() {
  return (
    <IdeaList
      load={listTeamIdeas}
      showAuthor
      empty="Belum ada ide yang dibagikan. Buka catatanmu lalu tap “Bagikan ke tim”."
      emptyAction={{ label: 'Buka Catatan Saya', onPress: () => router.navigate('/catatan') }}
    />
  );
}

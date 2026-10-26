import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IdeaList } from '../../src/lib/IdeaList';
import { listTeamIdeas } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';

export default function Tim() {
  return (
    <IdeaList
      load={listTeamIdeas}
      showAuthor
      empty="Belum ada ide yang dibagikan ke tim."
      header={
        <View style={s.header}>
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={s.out}>Keluar</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'flex-end', marginBottom: 4 },
  out: { color: '#c00', padding: 4 },
});

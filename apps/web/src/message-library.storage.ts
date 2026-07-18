export type MessageLibraryPreferences = {
  favorites: string[];
  recent: string[];
};

const storageKey = 'agm.message-library.preferences.v1';

export function readMessageLibraryPreferences(storage: Storage): MessageLibraryPreferences {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || '{}') as Partial<MessageLibraryPreferences>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((id): id is string => typeof id === 'string') : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter((id): id is string => typeof id === 'string').slice(0, 8) : [],
    };
  } catch {
    return { favorites: [], recent: [] };
  }
}

export function saveMessageLibraryPreferences(storage: Storage, preferences: MessageLibraryPreferences) {
  storage.setItem(storageKey, JSON.stringify({
    favorites: Array.from(new Set(preferences.favorites)),
    recent: Array.from(new Set(preferences.recent)).slice(0, 8),
  }));
}
